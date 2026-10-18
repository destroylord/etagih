<?php

namespace App\Actions\Invoice;

use App\Mail\InvoiceMail;
use App\Models\Invoice;
use App\Services\WhatsAppService;
use App\Support\Recurrence;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

/**
 * Kirim invoice ke klien lewat WhatsApp + email (PDF terlampir).
 *
 * execute(): draft → sent lalu kirim notifikasi. Idempotent: kalau status
 *            sudah bukan draft, return early tanpa efek.
 * resend():  kirim ulang notifikasi untuk invoice yang sudah terkirim.
 *
 * QRIS tidak di-generate di sini — dibuat on-demand saat klien mengklik
 * "Bayar" di halaman publik (lihat PaymentController::pay).
 */
class SendInvoice
{
    /**
     * @return array{invoice: Invoice, sent: bool, wa_sent: bool, email_sent: bool}
     */
    public function execute(Invoice $invoice): array
    {
        if ($invoice->status !== 'draft') {
            return ['invoice' => $invoice, 'sent' => false, 'wa_sent' => false, 'email_sent' => false];
        }

        $invoice->update([
            'status' => 'sent',
            // Invoice berulang: jadwal pembuatan berikutnya dihitung dari tanggal terbit.
            'recurrence_next_date' => $invoice->isRecurring() && ! $invoice->recurrence_next_date
                ? Recurrence::next($invoice->recurrence, $invoice->issue_date)
                : $invoice->recurrence_next_date,
        ]);

        return ['invoice' => $invoice->fresh(), 'sent' => true, ...$this->notify($invoice)];
    }

    /**
     * @return array{wa_sent: bool, email_sent: bool}
     */
    public function resend(Invoice $invoice): array
    {
        if (! in_array($invoice->status, ['sent', 'partial', 'overdue'], true)) {
            throw new RuntimeException('Hanya invoice yang sudah dikirim dan belum lunas yang bisa dikirim ulang.');
        }

        return $this->notify($invoice);
    }

    /**
     * @return array{wa_sent: bool, email_sent: bool}
     */
    private function notify(Invoice $invoice): array
    {
        $invoice->loadMissing('client');

        $waSent = false;
        try {
            $waSent = WhatsAppService::fromConfig()->sendNewInvoice($invoice);
        } catch (Throwable $e) {
            Log::warning('WhatsApp send exception during invoice send', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);
        }

        $emailSent = false;
        if ($invoice->client->email) {
            try {
                Mail::to($invoice->client->email)->send(new InvoiceMail($invoice));
                $emailSent = true;
            } catch (Throwable $e) {
                Log::warning('Invoice email failed', [
                    'invoice_id' => $invoice->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return ['wa_sent' => $waSent, 'email_sent' => $emailSent];
    }
}
