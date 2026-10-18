<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentSchedule;
use App\Models\Quote;
use App\Support\Settings;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Wrapper HTTP client untuk WhatsApp gateway (Fonnte).
 * Docs: https://docs.fonnte.com/
 *
 * Endpoint yang dipakai:
 *   POST /send  → kirim pesan WhatsApp
 *
 * Auth: header `Authorization: <token>` (token akun Fonnte, bukan Bearer).
 * Body dikirim sebagai form-data (`target` = nomor tujuan, `message` = teks).
 *
 * Credentials (api_key, sender_number) dari .env via config('services.wa.*').
 * Template WA (`wa_template_*`) dari Settings DB — customizable per bisnis.
 */
class WhatsAppService
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            baseUrl: (string) config('services.wa.fonnte_base_url'),
            // Fonnte mengirim dari device yang terhubung ke token — nomor pengirim
            // (WA_SENDER_NUMBER) tidak perlu dikirim di request.
            apiKey: (string) config('services.wa.api_key', ''),
        );
    }

    /**
     * Kirim pengingat pembayaran (invoice full atau satu cicilan).
     * upcoming=true → pengingat sebelum jatuh tempo (template terpisah).
     * Dipakai oleh command `app:invoice-reminders`.
     */
    public function sendReminder(Invoice $invoice, ?PaymentSchedule $schedule = null, bool $upcoming = false): bool
    {
        $settings = Settings::current();

        $amount = $schedule !== null ? $schedule->amount : $invoice->remainingAmount();
        $dueDate = $schedule !== null ? $schedule->due_date : $invoice->due_date;

        $template = $upcoming
            ? ($settings->wa_template_reminder_upcoming ?: $this->defaultUpcomingReminderTemplate())
            : ($settings->wa_template_reminder ?: $this->defaultReminderTemplate());

        $rendered = $this->render($template, [
            'client_name' => $invoice->client->name ?? '',
            'company_name' => $settings->company_name ?? config('app.name'),
            'invoice_number' => $invoice->invoice_number,
            'project' => $invoice->project->full_name ?? '',
            'amount' => 'Rp '.number_format((float) $amount, 0, ',', '.'),
            'due_date' => $dueDate ? $dueDate->translatedFormat('d M Y') : '-',
            'installment' => $schedule ? 'Cicilan ke-'.$schedule->sequence : '',
            'public_link' => $invoice->publicUrl(),
        ]);

        return $this->send($invoice->client->phone, $rendered, $upcoming ? 'reminder-upcoming' : 'reminder', $invoice->id);
    }

    /**
     * Kirim pesan invoice baru ke client. Template di-render dengan data invoice.
     */
    public function sendNewInvoice(Invoice $invoice): bool
    {
        $settings = Settings::current();

        $template = $settings->wa_template_invoice ?: $this->defaultNewInvoiceTemplate();

        $rendered = $this->render($template, [
            'client_name' => $invoice->client->name ?? '',
            'company_name' => $settings->company_name ?? config('app.name'),
            'invoice_number' => $invoice->invoice_number,
            'project' => $invoice->project->full_name ?? '',
            'total' => 'Rp '.number_format((float) $invoice->total, 0, ',', '.'),
            'public_link' => $invoice->publicUrl(),
        ]);

        return $this->send($invoice->client->phone, $rendered, 'new-invoice', $invoice->id);
    }

    /**
     * Kirim penawaran harga ke client (link ke halaman /q/{token}).
     */
    public function sendNewQuote(Quote $quote): bool
    {
        $settings = Settings::current();

        $rendered = $this->render($this->defaultNewQuoteTemplate(), [
            'client_name' => $quote->client->name ?? '',
            'company_name' => $settings->company_name ?? config('app.name'),
            'quote_number' => $quote->quote_number,
            'project' => $quote->project->full_name ?? '',
            'total' => 'Rp '.number_format((float) $quote->total, 0, ',', '.'),
            'valid_until' => $quote->valid_until ? $quote->valid_until->translatedFormat('d M Y') : '-',
            'public_link' => $quote->publicUrl(),
        ]);

        return $this->send($quote->client->phone, $rendered, 'new-quote', $quote->id);
    }

    /**
     * Kirim pesan konfirmasi pembayaran berhasil ke client.
     */
    public function sendPaymentReceived(Payment $payment): bool
    {
        $settings = Settings::current();
        $invoice = $payment->invoice;

        $template = $settings->wa_template_payment_received ?: $this->defaultPaymentReceivedTemplate();

        $rendered = $this->render($template, [
            'client_name' => $invoice->client->name ?? '',
            'company_name' => $settings->company_name ?? config('app.name'),
            'invoice_number' => $invoice->invoice_number,
            'project' => $invoice->project->full_name ?? '',
            'amount' => 'Rp '.number_format((float) $payment->amount, 0, ',', '.'),
            'remaining' => 'Rp '.number_format((float) $invoice->remainingAmount(), 0, ',', '.'),
            'status' => $invoice->isFullyPaid() ? 'Lunas' : 'Sebagian terbayar',
        ]);

        return $this->send($invoice->client->phone, $rendered, 'payment-received', $payment->id);
    }

    /**
     * Kirim teks bebas (mis. pesan uji dari halaman Status sistem).
     */
    public function sendText(string $phone, string $message): bool
    {
        return $this->send($phone, $message, 'text', 0);
    }

    /**
     * Render template dengan placeholder {{key}} → value.
     */
    /**
     * @param  array<string, string|int|float>  $placeholders
     */
    public function render(string $template, array $placeholders): string
    {
        $pairs = [];
        foreach ($placeholders as $key => $value) {
            $pairs['{{'.$key.'}}'] = (string) $value;
        }

        return strtr($template, $pairs);
    }

    private function send(?string $phone, string $message, string $purpose, int $resourceId): bool
    {
        if (! $phone) {
            Log::warning('WhatsApp (Fonnte) skipped: no phone number', [
                'purpose' => $purpose,
                'resource_id' => $resourceId,
            ]);

            return false;
        }

        try {
            $response = $this->client()->asForm()->post('/send', [
                'target' => $this->normalizePhone($phone),
                'message' => $message,
            ]);

            $body = $response->json() ?? [];

            // Fonnte mengembalikan HTTP 200 + body {status: true/false, reason?: "..."}.
            // Cek body.status supaya "queued but failed" tidak dianggap sukses.
            $ok = $response->successful() && ($body['status'] ?? false) === true;

            if (! $ok) {
                Log::warning('WhatsApp (Fonnte) send rejected', [
                    'purpose' => $purpose,
                    'resource_id' => $resourceId,
                    'phone' => $phone,
                    'http_status' => $response->status(),
                    'body_status' => $body['status'] ?? null,
                    'reason' => $body['reason'] ?? $body['detail'] ?? null,
                ]);

                return false;
            }

            return true;
        } catch (Throwable $e) {
            Log::error('WhatsApp (Fonnte) exception', [
                'purpose' => $purpose,
                'resource_id' => $resourceId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function client(): PendingRequest
    {
        if ($this->apiKey === '') {
            throw new RuntimeException('WA_API_KEY belum di-set di .env.');
        }

        return Http::baseUrl($this->baseUrl)
            ->withHeaders(['Authorization' => $this->apiKey])
            ->timeout(30);
    }

    /**
     * Normalisasi nomor HP ke format 62xxx untuk Indonesia gateway.
     */
    private function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/[^0-9]/', '', $phone) ?? '';
        if (str_starts_with($phone, '0')) {
            $phone = '62'.substr($phone, 1);
        }
        if (str_starts_with($phone, '8')) {
            $phone = '62'.$phone;
        }

        return $phone;
    }

    private function defaultNewInvoiceTemplate(): string
    {
        return <<<'TXT'
Halo {{client_name}},

Invoice baru dari {{company_name}}:
Nomor : {{invoice_number}}
Total : {{total}}

Silakan bayar melalui link berikut:
{{public_link}}

Terima kasih atas kepercayaan Anda.
TXT;
    }

    private function defaultNewQuoteTemplate(): string
    {
        return <<<'TXT'
Halo {{client_name}},

Berikut penawaran harga dari {{company_name}}:
Nomor          : {{quote_number}}
Total          : {{total}}
Berlaku sampai : {{valid_until}}

Lihat detail dan setujui penawaran melalui link berikut:
{{public_link}}

Terima kasih.
TXT;
    }

    private function defaultPaymentReceivedTemplate(): string
    {
        return <<<'TXT'
Halo {{client_name}},

Pembayaran untuk invoice *{{invoice_number}}* telah kami terima.
Nominal : {{amount}}
Sisa    : {{remaining}}
Status  : {{status}}

Terima kasih.
TXT;
    }

    private function defaultReminderTemplate(): string
    {
        return <<<'TXT'
Halo {{client_name}},

Kami ingin mengingatkan bahwa pembayaran untuk invoice *{{invoice_number}}* sebesar {{amount}} belum kami terima.

Silakan selesaikan pembayaran melalui link berikut:
{{public_link}}

Terima kasih.
TXT;
    }

    private function defaultUpcomingReminderTemplate(): string
    {
        return <<<'TXT'
Halo {{client_name}},

Sekadar mengingatkan, tagihan *{{invoice_number}}* {{installment}} sebesar {{amount}} akan jatuh tempo pada {{due_date}}.

Pembayaran bisa dilakukan melalui link berikut:
{{public_link}}

Terima kasih.
TXT;
    }
}
