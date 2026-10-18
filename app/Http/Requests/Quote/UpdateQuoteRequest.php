<?php

namespace App\Http\Requests\Quote;

use App\Models\Quote;

/**
 * Aturan sama dengan StoreQuoteRequest; hanya penawaran draft yang boleh diubah.
 */
class UpdateQuoteRequest extends StoreQuoteRequest
{
    public function authorize(): bool
    {
        $quote = $this->route('quote');

        return $this->user() !== null
            && $quote instanceof Quote
            && $quote->status === 'draft';
    }
}
