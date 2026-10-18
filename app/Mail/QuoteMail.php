<?php

namespace App\Mail;

use App\Models\Quote;
use App\Support\QuotePdf;
use App\Support\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email penawaran harga ke klien dengan lampiran PDF + link halaman penawaran.
 */
class QuoteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Quote $quote) {}

    public function envelope(): Envelope
    {
        $company = Settings::current()->company_name ?: config('app.name');

        return new Envelope(
            subject: "Penawaran {$this->quote->quote_number} dari {$company}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.quote',
            with: [
                'quote' => $this->quote,
                'setting' => Settings::current(),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $quote = $this->quote;

        return [
            Attachment::fromData(
                fn () => QuotePdf::make($quote)->output(),
                $quote->quote_number.'.pdf',
            )->withMime('application/pdf'),
        ];
    }
}
