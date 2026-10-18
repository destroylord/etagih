<?php

namespace App\Actions\Invoice;

use App\Models\Invoice;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Salin invoice menjadi draft baru (dipakai tombol "Duplikat" dan invoice berulang).
 *
 * - Item hourly yang berasal dari sessions disalin sebagai jam manual
 *   (sessions tetap milik invoice asal).
 * - Jarak terbit→jatuh tempo dan pola cicilan dipertahankan relatif ke tanggal terbit baru.
 */
class DuplicateInvoice
{
    public function __construct(private readonly CreateInvoice $creator) {}

    public function execute(Invoice $source, ?CarbonInterface $issueDate = null, ?int $recurringParentId = null): Invoice
    {
        $source->loadMissing(['items', 'schedules']);

        $origIssue = Carbon::parse($source->issue_date);
        $issue = Carbon::parse($issueDate ?? now())->startOfDay();

        $dueDate = $source->due_date
            ? $issue->copy()->addDays((int) $origIssue->diffInDays(Carbon::parse($source->due_date)))->toDateString()
            : null;

        $data = [
            'client_id' => $source->client_id,
            'project_id' => $source->project_id,
            'invoice_mode' => $source->invoice_mode,
            'type' => $source->type,
            'issue_date' => $issue->toDateString(),
            'due_date' => $dueDate,
            'discount_type' => $source->discount_type,
            'discount_value' => (float) $source->discount_value,
            'tax_rate' => (float) $source->tax_rate,
            'pph_rate' => (float) $source->pph_rate,
            'notes' => $source->notes,
            'items' => $source->items->map(fn ($item) => [
                'description' => $item->description,
                'unit_price' => (float) $item->unit_price,
                'product_id' => $item->product_id,
                'project_id' => $item->project_id,
                'hours_qty' => $source->invoice_mode === 'hourly' ? $item->hours_qty : null,
            ])->values()->all(),
        ];

        if ($source->type === 'installment' && $source->schedules->count() >= 2) {
            $schedules = $source->schedules->values();
            $firstDue = Carbon::parse($schedules[0]->due_date);
            $interval = (int) $firstDue->diffInDays(Carbon::parse($schedules[1]->due_date));

            $data['installments'] = [
                'count' => $schedules->count(),
                'first_due_date' => $issue->copy()->addDays((int) $origIssue->diffInDays($firstDue))->toDateString(),
                'interval_days' => max(7, $interval),
            ];
        } else {
            $data['type'] = 'full';
        }

        $copy = $this->creator->execute($data);

        if ($recurringParentId) {
            $copy->update(['recurring_parent_id' => $recurringParentId]);
        }

        return $copy;
    }
}
