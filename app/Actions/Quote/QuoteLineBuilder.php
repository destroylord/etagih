<?php

namespace App\Actions\Quote;

use App\Models\Quote;
use App\Models\QuoteItem;
use App\Support\DocumentTotals;

/**
 * Bangun item penawaran (qty × harga) lalu hitung total. Dipanggil di dalam
 * DB transaction oleh CreateQuote & UpdateQuote.
 */
class QuoteLineBuilder
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function buildItems(Quote $quote, array $data): void
    {
        $subtotal = 0.0;

        foreach (array_values((array) $data['items']) as $i => $row) {
            $qty = round((float) ($row['quantity'] ?? 1), 2);
            $unitPrice = round((float) ($row['unit_price'] ?? 0), 2);
            $lineTotal = round($qty * $unitPrice, 2);

            $itemProjectId = empty($row['project_id']) ? null : (int) $row['project_id'];
            // Item dengan proyek yang sama dengan proyek penawaran tidak perlu ditandai ulang.
            if ($itemProjectId !== null && $itemProjectId === $quote->project_id) {
                $itemProjectId = null;
            }

            QuoteItem::create([
                'quote_id' => $quote->id,
                'product_id' => empty($row['product_id']) ? null : (int) $row['product_id'],
                'project_id' => $itemProjectId,
                'description' => (string) $row['description'],
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
                'sort_order' => $i,
            ]);

            $subtotal += $lineTotal;
        }

        DocumentTotals::apply($quote, $subtotal, $data);
    }
}
