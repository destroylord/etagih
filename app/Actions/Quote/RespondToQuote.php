<?php

namespace App\Actions\Quote;

use App\Mail\QuoteRespondedMail;
use App\Models\Quote;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

/**
 * Jawaban atas penawaran: diterima / ditolak — oleh klien (halaman publik)
 * atau ditandai manual oleh admin. Jawaban klien memberi tahu pemilik & admin via email.
 */
class RespondToQuote
{
    public function accept(Quote $quote, ?string $name = null, ?string $note = null, bool $byClient = true): Quote
    {
        $quote = $this->transition($quote, $byClient, fn (Quote $q) => $q->update([
            'status' => 'accepted',
            'accepted_at' => now(),
            'accepted_by' => $name ?: null,
            'response_note' => $note ?: null,
            'declined_at' => null,
            'decline_reason' => null,
        ]));

        if ($byClient) {
            $this->notifyBusiness($quote);
        }

        return $quote;
    }

    public function decline(Quote $quote, ?string $reason = null, bool $byClient = true): Quote
    {
        $quote = $this->transition($quote, $byClient, fn (Quote $q) => $q->update([
            'status' => 'declined',
            'declined_at' => now(),
            'decline_reason' => $reason ?: null,
            'accepted_at' => null,
            'accepted_by' => null,
        ]));

        if ($byClient) {
            $this->notifyBusiness($quote);
        }

        return $quote;
    }

    /**
     * @param  callable(Quote): mixed  $apply
     */
    private function transition(Quote $quote, bool $byClient, callable $apply): Quote
    {
        return DB::transaction(function () use ($quote, $byClient, $apply) {
            /** @var Quote $fresh */
            $fresh = Quote::query()->lockForUpdate()->findOrFail($quote->id);

            if ($byClient) {
                if ($fresh->status !== 'sent') {
                    throw new RuntimeException('Penawaran ini sudah tidak menunggu jawaban.');
                }
                if ($fresh->isPastValidity()) {
                    throw new RuntimeException('Masa berlaku penawaran ini sudah habis.');
                }
            } elseif (! in_array($fresh->status, ['sent', 'accepted', 'declined', 'expired'], true)) {
                // Admin boleh mengoreksi jawaban (mis. klien setuju lewat telepon), tapi tidak untuk draft / sudah jadi invoice.
                throw new RuntimeException('Status penawaran ini tidak bisa diubah.');
            }

            $apply($fresh);

            return $fresh;
        });
    }

    private function notifyBusiness(Quote $quote): void
    {
        $quote->loadMissing('client');

        $recipients = User::query()
            ->whereIn('role', ['owner', 'admin'])
            ->where('is_active', true)
            ->pluck('email')
            ->filter()
            ->all();

        foreach ($recipients as $email) {
            try {
                Mail::to($email)->send(new QuoteRespondedMail($quote));
            } catch (Throwable $e) {
                Log::warning('Quote response notification failed', [
                    'quote_id' => $quote->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
