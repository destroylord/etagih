<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Support\InvoicePdf;
use Barryvdh\DomPDF\PDF as DomPdf;
use Illuminate\Http\Response;

class InvoicePdfController extends Controller
{
    public function download(Invoice $invoice): Response
    {
        return $this->render($invoice)->download($invoice->invoice_number.'.pdf');
    }

    public function stream(Invoice $invoice): Response
    {
        return $this->render($invoice)->stream($invoice->invoice_number.'.pdf');
    }

    private function render(Invoice $invoice): DomPdf
    {
        return InvoicePdf::make($invoice);
    }
}
