<?php

namespace App\Actions\Quote;

use App\Models\Quote;
use Carbon\CarbonImmutable;

/**
 * Salin penawaran menjadi draft baru bertanggal hari ini. Jarak terbit → berlaku
 * sampai dipertahankan.
 */
class DuplicateQuote
{
    public function __construct(private readonly CreateQuote $creator) {}

    public function execute(Quote $source): Quote
    {
        $source->loadMissing('items');

        $issue = CarbonImmutable::today();
        $validDays = $source->valid_until
            ? max(1, (int) $source->issue_date->diffInDays($source->valid_until))
            : Quote::DEFAULT_VALID_DAYS;

        return $this->creator->execute([
            'client_id' => $source->client_id,
            'project_id' => $source->project_id,
            'issue_date' => $issue->toDateString(),
            'valid_until' => $issue->addDays($validDays)->toDateString(),
            'discount_type' => $source->discount_type,
            'discount_value' => (float) $source->discount_value,
            'tax_rate' => (float) $source->tax_rate,
            'pph_rate' => (float) $source->pph_rate,
            'notes' => $source->notes,
            'terms' => $source->terms,
            'items' => $source->items->map(fn ($item) => [
                'description' => $item->description,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'product_id' => $item->product_id,
                'project_id' => $item->project_id,
            ])->values()->all(),
        ]);
    }
}
