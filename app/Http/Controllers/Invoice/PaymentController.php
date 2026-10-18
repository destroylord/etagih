<?php

namespace App\Http\Controllers\Invoice;

use App\Actions\Invoice\RecordPayment;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentSchedule;
use App\Models\QrisAccount;
use App\Models\Setting;
use App\Services\PaymentStatus;
use App\Services\QrislyService;
use App\Support\InvoicePdf;
use App\Support\QrisStyle;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Halaman publik (no auth) untuk customer melihat & membayar invoice.
 * Akses via public_token (40 char random, unique per invoice).
 */
class PaymentController extends Controller
{
    /**
     * Testing mode = sandbox/dev only. Kalau salah satu aktif production (APP_ENV
     * atau QRISLY_IS_PRODUCTION), sembunyikan countdown + blok endpoint simulate.
     */
    private function isTestingMode(): bool
    {
        return ! app()->isProduction() && ! (bool) config('services.qrisly.is_production');
    }

    public function show(string $token): Response
    {
        $invoice = Invoice::where('public_token', $token)
            ->with(['client', 'project.parent', 'items.product', 'items.project', 'items.sessions', 'schedules', 'payments'])
            ->firstOrFail();

        // Draft belum dikirim ke klien — hanya admin yang boleh pratinjau.
        abort_if($invoice->status === 'draft' && ! auth()->check(), 404);

        $setting = Setting::first() ?? new Setting;

        return Inertia::render('pay/show', [
            'invoice' => $invoice,
            'isTesting' => $this->isTestingMode(),
            'company' => $setting->only([
                'company_name', 'company_address', 'company_phone', 'company_email',
                'bank_account_info', 'invoice_footer_text', 'company_logo_path',
            ]),
        ]);
    }

    /**
     * Poll status invoice buat deteksi payment_success (webhook) di halaman pay.
     * Sekaligus fallback Step-4: cek langsung ke QRISLY payment-status saat ada
     * payment pending (kalau webhook lambat/ilang, tetep bisa lunas).
     */
    public function status(string $token): JsonResponse
    {
        $invoice = Invoice::where('public_token', $token)->firstOrFail();

        if (! $invoice->isFullyPaid()) {
            $pending = Payment::where('invoice_id', $invoice->id)
                ->where('method', 'qris')
                ->where('status', 'pending')
                ->latest('id')
                ->first();

            if ($pending && $pending->external_id) {
                // Cooldown: jangan spam QRISLY tiap poll (network lambat & ngeblok
                // server single-thread). Cukup cek ~tiap 20 detik.
                $cacheKey = 'qrisly-reconcile-'.$invoice->id;
                $last = (int) Cache::get($cacheKey, 0);
                if (time() - $last >= 20) {
                    Cache::put($cacheKey, time(), now()->addMinutes(5));
                    $this->reconcileQrislyPayment($invoice, $pending);
                }
            }
        }

        return response()->json([
            'status' => $invoice->fresh()->status,
            'paid' => $invoice->fresh()->isFullyPaid(),
            'paid_amount' => (float) $invoice->fresh()->paid_amount,
        ]);
    }

    /**
     * Fallback Step-4: cek langsung ke QRISLY payment-status saat ada payment pending.
     */
    private function reconcileQrislyPayment(Invoice $invoice, Payment $pending): void
    {
        if (! $pending->external_id) {
            return;
        }

        try {
            $remote = QrislyService::fromConfig()->checkStatus((string) $pending->external_id);
            $mapped = PaymentStatus::fromQrisly($remote['payment_status']);

            if ($mapped === 'success') {
                app(RecordPayment::class)->execute(
                    invoice: $invoice,
                    amount: $remote['amount'] ?: (float) $pending->amount,
                    externalId: (string) $pending->external_id,
                    scheduleId: $pending->schedule_id,
                    rawResponse: $remote,
                );
            } elseif (in_array($mapped, ['expired', 'failed'], true) && $pending->status !== 'success') {
                $pending->update([
                    'status' => $mapped,
                    'raw_response' => $remote,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('QRISLY status reconcile failed', [
                'external_id' => $pending->external_id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Customer klik "Bayar" → generate QRIS statis dan kirim kembali ke halaman
     * agar QR ditampilkan (sandbox Komerce tidak memakai redirect; konfirmasi via webhook).
     */
    public function pay(Request $request, string $token): JsonResponse|RedirectResponse
    {
        $invoice = Invoice::where('public_token', $token)->firstOrFail();

        // Klien Inertia (bundle lama / cache browser) tidak menerima JSON langsung;
        // redirect balik saja agar tidak menampilkan JSON mentah. Frontend baru
        // memakai fetch polos (tanpa header X-Inertia) → path JSON dipakai.
        if ($request->header('X-Inertia')) {
            return back()->with('error', 'Halaman sudah usang. Muat ulang untuk melihat QRIS.');
        }
        if (! $invoice->isPayable()) {
            $message = match (true) {
                $invoice->isCancelled() => 'Invoice ini sudah dibatalkan.',
                $invoice->status === 'draft' => 'Invoice belum diterbitkan.',
                default => 'Invoice sudah lunas.',
            };

            return response()->json(['error' => $message], 422);
        }

        $scheduleId = $request->integer('schedule_id') ?: null;
        $schedule = $scheduleId
            ? PaymentSchedule::where('invoice_id', $invoice->id)->where('id', $scheduleId)->first()
            : null;

        if ($invoice->isFullyPaid() && ! $schedule) {
            return response()->json(['error' => 'Invoice sudah lunas.'], 422);
        }

        if ($schedule && $schedule->status === 'paid') {
            return response()->json(['error' => 'Cicilan ini sudah dibayar.'], 422);
        }

        $amount = $schedule
            ? (float) $schedule->amount
            : $invoice->remainingAmount();

        // Dedup: kalau masih ada pending QRIS untuk nominal yang sama, pakai lagi —
        // KECUALI QRIS sudah kedaluwarsa (expiry_time lewat). Kalau kedaluwarsa,
        // tandai expired + generate baru supaya customer tidak dapat QR mati.
        $existingPending = Payment::where('invoice_id', $invoice->id)
            ->where('method', 'qris')
            ->where('status', 'pending')
            ->where('amount', $amount)
            ->where('schedule_id', $schedule?->id)
            ->first();

        if ($existingPending && ($cached = $existingPending->raw_response['qris_string'] ?? null)) {
            $expiryTs = $this->parseExpiry($existingPending->raw_response['expiry_time'] ?? null);

            if ($expiryTs === null || $expiryTs > time()) {
                $finalAmount = (float) ($existingPending->raw_response['final_amount'] ?? $amount);

                return response()->json([
                    'qris_string' => (string) $cached,
                    'qris_svg' => $this->styledQris((string) $cached, $finalAmount),
                    'history_id' => (string) $existingPending->external_id,
                    'final_amount' => $finalAmount,
                    'expiry_time' => (string) ($existingPending->raw_response['expiry_time'] ?? ''),
                ]);
            }

            $existingPending->update(['status' => 'expired']);
        }

        try {
            $qrisly = QrislyService::fromConfig();
            $qr = $qrisly->generate($amount);
        } catch (\Throwable $e) {
            Log::warning('QRISLY generate failed for invoice', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Gagal membuat QRIS. Periksa konfigurasi gateway.'], 502);
        }

        Payment::create([
            'invoice_id' => $invoice->id,
            'schedule_id' => $schedule?->id,
            'amount' => $amount,
            'method' => 'qris',
            'external_id' => $qr['history_id'],
            'status' => 'pending',
            'raw_response' => $qr,
        ]);

        return response()->json([...$qr, 'qris_svg' => $this->styledQris($qr['qris_string'], $qr['final_amount'])]);
    }

    /**
     * Kartu QRIS sesuai gaya di Pengaturan → QRIS (SVG).
     */
    private function styledQris(string $payload, float $amount): string
    {
        $setting = Settings::current();

        return QrisStyle::cardSvg(
            $payload,
            QrisStyle::fromSetting($setting),
            $amount,
            $setting->company_name ?: QrisAccount::active()?->merchant_name,
            InvoicePdf::imageDataUri($setting->company_logo_path, 300, 300),
        );
    }

    /**
     * Parse nilai expiry_time dari gateway (bisa epoch seconds atau string ISO/datetime).
     * Return null kalau tidak bisa di-parse → caller treat sebagai masih berlaku.
     */
    private function parseExpiry(mixed $expiry): ?int
    {
        if ($expiry === null || $expiry === '') {
            return null;
        }

        if (is_numeric($expiry)) {
            return (int) $expiry;
        }

        $ts = strtotime((string) $expiry);

        return $ts === false ? null : $ts;
    }

    /**
     * Simulasi pembayaran sukses — khusus mode testing, supaya bisa "lunas"
     * tanpa benar-benar scan/bayar. Memanggil RecordPayment (sama seperti webhook).
     */
    public function simulate(Request $request, string $token): JsonResponse|RedirectResponse
    {
        if ($request->header('X-Inertia')) {
            return back()->with('error', 'Silakan muat ulang halaman.');
        }

        if (! $this->isTestingMode()) {
            return response()->json(['error' => 'Simulasi hanya aktif di mode testing (sandbox).'], 403);
        }

        $invoice = Invoice::where('public_token', $token)->firstOrFail();
        $payment = Payment::where('invoice_id', $invoice->id)
            ->where('status', 'pending')
            ->latest('id')
            ->first();

        if (! $payment) {
            return response()->json(['error' => 'Tidak ada pembayaran pending. Klik "Bayar" dulu.'], 422);
        }

        // Cek konfirmasi asli ke QRISLY (bukan asal success). Pas countdown habis tapi
        // gateway/listener belum konfirmasi → transaksi GAGAL + info error.
        try {
            $remote = QrislyService::fromConfig()->checkStatus((string) $payment->external_id);
            $mapped = PaymentStatus::fromQrisly($remote['payment_status']);
        } catch (\Throwable $e) {
            Log::warning('QRISLY simulate status failed', [
                'external_id' => $payment->external_id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Tidak dapat memverifikasi pembayaran ke gateway. Coba lagi.'], 502);
        }

        if ($mapped !== 'success') {
            // Belum/kegagalan konfirmasi (unpaid/expired/failed) → tandai & info error.
            if (in_array($mapped, ['expired', 'failed'], true)) {
                $payment->update([
                    'status' => $mapped,
                    'raw_response' => $remote,
                ]);
            }
            $label = $mapped === 'expired' ? 'QRIS kedaluwarsa' : 'belum terkonfirmasi (tidak ada respons dari gateway/listener)';

            return response()->json(['error' => "Pembayaran gagal: $label. Silakan buat QRIS baru."], 422);
        }

        app(RecordPayment::class)->execute(
            invoice: $invoice,
            amount: $remote['amount'] ?: (float) $payment->amount,
            externalId: (string) $payment->external_id,
            scheduleId: $payment->schedule_id,
            rawResponse: $remote,
            method: 'qris',
        );

        return response()->json(['status' => 'ok']);
    }
}
