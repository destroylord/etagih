<?php

namespace App\Actions\Quote;

use App\Mail\QuoteMail;
use App\Models\Quote;
use App\Services\WhatsAppService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

/**
 * Kirim penawaran ke klien lewat WhatsApp + email (PDF terlampir).
 *
 * execute(): draft → sent lalu kirim notifikasi (idempotent: non-draft = no-op).
 * resend():  kirim ulang notifikasi penawaran yang masih menunggu jawaban.
 */
class SendQuote
{
    /**
     * @return array{quote: Quote, sent: bool, wa_sent: bool, email_sent: bool}
     */
    public function execute(Quote $quote): array
    {
        if ($quote->status !== 'draft') {
            return ['quote' => $quote, 'sent' => false, 'wa_sent' => false, 'email_sent' => false];
        }

        $quote->update(['status' => 'sent', 'sent_at' => now()]);

        return ['quote' => $quote->fresh() ?? $quote, 'sent' => true, ...$this->notify($quote)];
    }

    /**
     * @return array{wa_sent: bool, email_sent: bool}
     */
    public function resend(Quote $quote): array
    {
        if ($quote->status !== 'sent') {
            throw new RuntimeException('Hanya penawaran yang sudah dikirim dan menunggu jawaban yang bisa dikirim ulang.');
        }
        if ($quote->isPastValidity()) {
            throw new RuntimeException('Masa berlaku penawaran sudah lewat. Duplikat penawaran untuk membuat yang baru.');
        }

        return $this->notify($quote);
    }

    /**
     * @return array{wa_sent: bool, email_sent: bool}
     */
    private function notify(Quote $quote): array
    {
        $quote->loadMissing(['client', 'project.parent']);

        $waSent = false;
        try {
            $waSent = WhatsAppService::fromConfig()->sendNewQuote($quote);
        } catch (Throwable $e) {
            Log::warning('WhatsApp send exception during quote send', [
                'quote_id' => $quote->id,
                'error' => $e->getMessage(),
            ]);
        }

        $emailSent = false;
        if ($quote->client->email) {
            try {
                Mail::to($quote->client->email)->send(new QuoteMail($quote));
                $emailSent = true;
            } catch (Throwable $e) {
                Log::warning('Quote email failed', [
                    'quote_id' => $quote->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return ['wa_sent' => $waSent, 'email_sent' => $emailSent];
    }
}
