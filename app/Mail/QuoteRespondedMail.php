<?php

namespace App\Mail;

use App\Models\Quote;
use App\Support\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Notifikasi ke pemilik/admin: klien menerima atau menolak penawaran.
 */
class QuoteRespondedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Quote $quote) {}

    public function envelope(): Envelope
    {
        $verb = $this->quote->status === 'accepted' ? 'diterima' : 'ditolak';

        return new Envelope(
            subject: "Penawaran {$this->quote->quote_number} {$verb} oleh {$this->quote->client->name}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.quote-responded',
            with: [
                'quote' => $this->quote,
                'setting' => Settings::current(),
                'accepted' => $this->quote->status === 'accepted',
                'adminUrl' => route('quotes.show', $this->quote),
            ],
        );
    }
}
