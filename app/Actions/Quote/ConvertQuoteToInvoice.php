<?php

namespace App\Actions\Quote;

use App\Actions\Invoice\CreateInvoice;
use App\Models\Invoice;
use App\Models\Quote;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Ubah penawaran (terkirim / diterima) menjadi invoice DRAFT.
 *
 * Invoice tidak mengenal qty, jadi tiap baris menjadi item harga tetap dengan
 * unit_price = qty × harga; bila qty ≠ 1, qty & harga satuan ditulis di uraian
 * ("Desain logo (2 × Rp 500.000)"). Proyek, sub-proyek item, diskon, PPN & PPh
 * ikut dibawa sehingga total invoice = total penawaran.
 *
 * Idempotent: penawaran yang sudah dikonversi mengembalikan invoice yang ada.
 */
class ConvertQuoteToInvoice
{
    public function __construct(private readonly CreateInvoice $creator) {}

    /**
     * @return array{invoice: Invoice, created: bool}
     */
    public function execute(Quote $quote): array
    {
        return DB::transaction(function () use ($quote) {
            /** @var Quote $quote */
            $quote = Quote::query()->lockForUpdate()->findOrFail($quote->id);

            if ($quote->status === 'converted' && $quote->converted_invoice_id !== null) {
                $existing = Invoice::find($quote->converted_invoice_id);
                if ($existing) {
                    return ['invoice' => $existing, 'created' => false];
                }
            }

            if (! $quote->canConvert()) {
                throw new RuntimeException('Hanya penawaran yang sudah dikirim atau diterima yang bisa diubah menjadi invoice.');
            }

            $quote->load('items');

            $notes = trim('Berdasarkan penawaran '.$quote->quote_number.'.'
                .($quote->notes ? "\n\n".$quote->notes : ''));

            $invoice = $this->creator->execute([
                'client_id' => $quote->client_id,
                'project_id' => $quote->project_id,
                'invoice_mode' => 'fixed',
                'type' => 'full',
                'issue_date' => now()->toDateString(),
                'due_date' => null,
                'discount_type' => $quote->discount_type,
                'discount_value' => (float) $quote->discount_value,
                'tax_rate' => (float) $quote->tax_rate,
                'pph_rate' => (float) $quote->pph_rate,
                'notes' => Str::limit($notes, 4990, ''),
                'items' => $quote->items->map(fn ($item) => [
                    'description' => self::describe($item->description, (float) $item->quantity, (float) $item->unit_price),
                    'unit_price' => (float) $item->line_total,
                    'product_id' => $item->product_id,
                    'project_id' => $item->project_id,
                ])->values()->all(),
            ]);

            $quote->update([
                'status' => 'converted',
                'converted_invoice_id' => $invoice->id,
                // Dikonversi tanpa jawaban klien = dianggap diterima saat itu.
                'accepted_at' => $quote->accepted_at ?? now(),
            ]);

            return ['invoice' => $invoice, 'created' => true];
        });
    }

    /** "Desain logo (2 × Rp 500.000)" bila qty ≠ 1; maksimal 255 karakter. */
    public static function describe(string $description, float $qty, float $unitPrice): string
    {
        if (abs($qty - 1) < 0.001) {
            return Str::limit($description, 255, '');
        }

        $qtyText = rtrim(rtrim(number_format($qty, 2, ',', '.'), '0'), ',');
        $suffix = ' ('.$qtyText.' × Rp '.number_format($unitPrice, 0, ',', '.').')';

        return Str::limit($description, 254 - mb_strlen($suffix), '…').$suffix;
    }
}
