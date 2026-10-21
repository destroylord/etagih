<?php

namespace App\Actions\Invoice;

use App\Models\Invoice;
use App\Models\WorkSession;
use Illuminate\Support\Facades\DB;

class UpdateInvoice
{
    public function __construct(
        private readonly InvoiceLineBuilder $lines,
    ) {}

    /**
     * Update konten invoice draft secara in-place.
     * invoice_number + public_token + payments TIDAK berubah.
     * Items & schedules lama dihapus lalu dibuat ulang (sederhana, atomic).
     *
     * Sessions yg sebelumnya billed ke invoice ini dilepas balik ke 'completed'
     * (unbilled), lalu session_ids dipilih ulang di form di-link lagi — jadi
     * sessions yg dihapus dari invoice kembali ke pool Time Tracker.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Invoice $invoice, array $data): Invoice
    {
        return DB::transaction(function () use ($invoice, $data) {
            $invoice->fill([
                'project_id' => empty($data['project_id']) ? null : (int) $data['project_id'],
                'issue_date' => $data['issue_date'],
                'due_date' => empty($data['due_date']) ? null : $data['due_date'],
                'invoice_mode' => $data['invoice_mode'],
                'type' => $data['type'],
                'notes' => $data['notes'] ?? null,
                'recurrence' => $data['recurrence'] ?? 'none',
                'recurrence_auto_send' => (bool) ($data['recurrence_auto_send'] ?? false),
            ])->save();

            // Lepas semua sessions yg masih nempel ke invoice ini ke status completed (unbilled).
            WorkSession::where('invoice_id', $invoice->id)
                ->where('status', 'billed')
                ->update([
                    'invoice_id' => null,
                    'invoice_item_id' => null,
                    'status' => 'completed',
                ]);
            // Tugas juga dilepas; yang masih ada di form ditautkan ulang oleh buildItems().
            InvoiceLineBuilder::releaseTasks($invoice);

            $invoice->items()->delete();
            $invoice->schedules()->delete();

            $this->lines->buildItems($invoice, $data);

            if ($data['type'] === 'installment' && ! empty($data['installments'])) {
                $this->lines->buildSchedules($invoice, $data['installments']);
            }

            $invoice->save();

            return $invoice->fresh(['items', 'schedules']);
        });
    }
}
