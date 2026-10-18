<?php

namespace App\Actions\Invoice;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\WorkSession;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Batalkan (void) invoice yang sudah dikirim tapi belum ada pembayaran.
 *
 * Efek:
 * - status → cancelled (tidak dihitung piutang, tidak kena reminder/overdue)
 * - QRIS pending di-expire supaya tidak bisa dibayar
 * - sessions Time Tracker dilepas kembali ke pool (completed)
 * - invoice berulang dihentikan
 */
class CancelInvoice
{
    public function execute(Invoice $invoice, ?string $reason = null): Invoice
    {
        if ($invoice->status === 'draft') {
            throw new RuntimeException('Invoice draft cukup dihapus, tidak perlu dibatalkan.');
        }
        if ($invoice->isCancelled()) {
            throw new RuntimeException('Invoice sudah dibatalkan.');
        }
        if ((float) $invoice->paid_amount > 0) {
            throw new RuntimeException('Invoice yang sudah menerima pembayaran tidak bisa dibatalkan.');
        }

        return DB::transaction(function () use ($invoice, $reason) {
            $invoice->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'recurrence' => 'none',
                'recurrence_next_date' => null,
            ]);

            Payment::where('invoice_id', $invoice->id)
                ->where('status', 'pending')
                ->update(['status' => 'expired']);

            WorkSession::where('invoice_id', $invoice->id)
                ->where('status', 'billed')
                ->update(['invoice_id' => null, 'invoice_item_id' => null, 'status' => 'completed']);

            return $invoice->fresh();
        });
    }
}
