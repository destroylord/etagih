<?php

namespace App\Jobs;

use App\Mail\ReceiptMail;
use App\Models\Payment;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Kirim WA konfirmasi pembayaran via queue (async) supaya RecordPayment
 * (dipanggil dari webhook) tidak diblokir menunggu response Fonnte.
 * Gagal kirim WA tidak menggagalkan status pembayaran — cukup di-log.
 * Sekaligus email kuitansi (PDF) ke klien bila punya email.
 */
class SendPaymentReceivedNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Payment $payment,
    ) {}

    public function handle(WhatsAppService $wa): void
    {
        try {
            $wa->sendPaymentReceived($this->payment);
        } catch (Throwable $e) {
            Log::warning('WhatsApp send confirmation failed (queued)', [
                'payment_id' => $this->payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        $this->sendReceiptEmail();
    }

    /**
     * Email kuitansi ke klien — sekali per pembayaran (webhook bisa terkirim
     * berulang). Gagal kirim hanya di-log, tidak pernah dilempar.
     */
    private function sendReceiptEmail(): void
    {
        $payment = $this->payment->fresh(['invoice.client']);
        $email = $payment?->invoice->client->email;

        if (! $payment || ! $payment->isSuccess() || ! $email) {
            return;
        }

        $sentKey = "receipt_mailed:{$payment->id}";
        if (! Cache::add($sentKey, true, now()->addDays(30))) {
            return;
        }

        try {
            Mail::to($email)->send(new ReceiptMail($payment));
        } catch (Throwable $e) {
            Cache::forget($sentKey);
            Log::warning('Receipt email failed (queued)', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
