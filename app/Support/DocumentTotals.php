<?php

namespace App\Support;

use App\Models\Invoice;
use App\Models\Quote;

/**
 * Hitung diskon, PPN, PPh 23 dan total untuk dokumen (penawaran / invoice).
 * Rumus identik dengan InvoiceLineBuilder::applyTotals:
 *
 *   DPP   = subtotal − diskon
 *   PPN   = DPP × tax_rate
 *   PPh23 = DPP × pph_rate
 *   total = DPP + PPN − PPh23
 *
 * Nilai di-set ke model tanpa di-save.
 */
class DocumentTotals
{
    /**
     * @param  array<string, mixed>  $data
     */
    public static function apply(Invoice|Quote $doc, float $subtotal, array $data): void
    {
        $type = ($data['discount_type'] ?? 'amount') === 'percent' ? 'percent' : 'amount';
        $value = (float) ($data['discount_value'] ?? $data['discount'] ?? 0);
        $taxRate = (float) ($data['tax_rate'] ?? 0);
        $pphRate = (float) ($data['pph_rate'] ?? 0);

        $discount = $type === 'percent'
            ? round($subtotal * min($value, 100) / 100, 2)
            : $value;
        $discount = min(max(0, $discount), $subtotal);

        $taxable = round($subtotal - $discount, 2);
        $tax = round($taxable * max(0, $taxRate) / 100, 2);
        $pph = round($taxable * max(0, $pphRate) / 100, 2);

        $doc->subtotal = round($subtotal, 2);
        $doc->discount_type = $type;
        $doc->discount_value = $value;
        $doc->discount = $discount;
        $doc->tax_rate = $taxRate;
        $doc->tax_amount = $tax;
        $doc->pph_rate = $pphRate;
        $doc->pph_amount = $pph;
        $doc->total = max(0, round($taxable + $tax - $pph, 2));
    }
}
