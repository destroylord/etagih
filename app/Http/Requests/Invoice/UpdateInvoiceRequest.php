<?php

namespace App\Http\Requests\Invoice;

use App\Models\Invoice;

/**
 * Aturan sama dengan StoreInvoiceRequest (termasuk validasi proyek di after()),
 * hanya invoice draft yang boleh diubah.
 */
class UpdateInvoiceRequest extends StoreInvoiceRequest
{
    public function authorize(): bool
    {
        $invoice = $this->route('invoice');

        return $this->user() !== null
            && $invoice instanceof Invoice
            && $invoice->status === 'draft';
    }
}
