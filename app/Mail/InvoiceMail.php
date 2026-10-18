<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Support\InvoicePdf;
use App\Support\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email invoice ke klien dengan lampiran PDF + link bayar publik.
 */
class InvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Invoice $invoice, public bool $isReminder = false) {}

    public function envelope(): Envelope
    {
        $company = Settings::current()->company_name ?: config('app.name');
        $prefix = $this->isReminder ? 'Pengingat: ' : '';

        return new Envelope(
            subject: "{$prefix}Invoice {$this->invoice->invoice_number} dari {$company}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.invoice',
            with: [
                'invoice' => $this->invoice,
                'setting' => Settings::current(),
                'isReminder' => $this->isReminder,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $invoice = $this->invoice;

        return [
            Attachment::fromData(
                fn () => InvoicePdf::make($invoice)->output(),
                $invoice->invoice_number.'.pdf',
            )->withMime('application/pdf'),
        ];
    }
}
