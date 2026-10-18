<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Support\ReceiptPdf;
use Illuminate\Http\Response;

/**
 * Unduh kuitansi (PDF) untuk pembayaran sukses.
 *
 * - Admin/staf: GET payments/{payment}/receipt
 * - Klien: GET /pay/{token}/receipts/{payment} — hanya pembayaran milik
 *   invoice dengan token tsb; selain itu 404.
 */
class ReceiptController extends Controller
{
    public function download(Payment $payment): Response
    {
        abort_unless($payment->isSuccess(), 404);

        return ReceiptPdf::make($payment)->download(ReceiptPdf::filename($payment));
    }

    public function public(string $token, Payment $payment): Response
    {
        $invoice = Invoice::where('public_token', $token)->firstOrFail();

        abort_unless($payment->invoice_id === $invoice->id && $payment->isSuccess(), 404);

        return ReceiptPdf::make($payment)->stream(ReceiptPdf::filename($payment));
    }
}
