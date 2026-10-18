<?php

namespace App\Mail;

use App\Models\Payment;
use App\Support\ReceiptPdf;
use App\Support\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email kuitansi pembayaran ke klien (PDF terlampir), dikirim otomatis
 * setelah pembayaran sukses lewat SendPaymentReceivedNotification.
 */
class ReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Payment $payment) {}

    public function envelope(): Envelope
    {
        $company = Settings::current()->company_name ?: config('app.name');
        $number = $this->payment->receipt_number ?: $this->payment->invoice->invoice_number;

        return new Envelope(
            subject: "Kuitansi {$number} dari {$company}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.receipt',
            with: [
                'payment' => $this->payment,
                'invoice' => $this->payment->invoice,
                'setting' => Settings::current(),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $payment = $this->payment;

        return [
            Attachment::fromData(
                fn () => ReceiptPdf::make($payment)->output(),
                ReceiptPdf::filename($payment),
            )->withMime('application/pdf'),
        ];
    }
}
