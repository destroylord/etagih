<?php

namespace App\Actions\Invoice;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PaymentSchedule;
use App\Models\Task;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Logika bersama CreateInvoice & UpdateInvoice: bangun item, link sessions,
 * hitung total, dan generate jadwal cicilan. Dipanggil di dalam DB transaction.
 */
class InvoiceLineBuilder
{
    /**
     * Buat item invoice + link sessions, set subtotal & total (belum di-save).
     *
     * Mode hourly:
     * - item dengan session_ids → jam = Σ durasi sessions (completed milik client).
     * - item tanpa sessions     → jam = hours_qty input (disimpan di manual_hours).
     *
     * Item dari tugas (`task_id`, divalidasi di StoreInvoiceRequest):
     * - item.task_id diisi, tugas ditandai invoice_id / invoice_item_id.
     * - mode hourly: jam dari session_ids seperti biasa (frontend mengirim sesi tugas);
     *   tugas berharga tetap tanpa sesi dikirim sebagai 1 jam × harga tetap.
     * - mode fixed : harga = unit_price baris (harga tetap tugas / jam × tarif);
     *   sesi tugas yang belum ditagih ikut ditautkan supaya tidak ditagih ulang.
     *
     * @param  array<string, mixed>  $data
     */
    public function buildItems(Invoice $invoice, array $data): void
    {
        $isHourly = $data['invoice_mode'] === 'hourly';
        $subtotal = 0.0;
        $sessionMap = []; // session.id → invoice_item.id
        $taskMap = []; // task.id → invoice_item.id

        $taskIds = array_values(array_filter(array_map(
            fn ($row) => is_array($row) && ! empty($row['task_id']) ? (int) $row['task_id'] : null,
            (array) $data['items'],
        )));
        $tasks = $taskIds === [] ? collect() : Task::query()->with('project:id,parent_id')->whereIn('id', $taskIds)->get()->keyBy('id');

        foreach (array_values($data['items']) as $i => $row) {
            $unitPrice = (float) ($row['unit_price'] ?? 0);
            $task = ! empty($row['task_id']) ? $tasks->get((int) $row['task_id']) : null;

            $sessions = ($isHourly && ! empty($row['session_ids']))
                ? WorkSession::where('client_id', $invoice->client_id)
                    ->whereIn('id', array_values($row['session_ids']))
                    ->where('status', 'completed')
                    ->get()
                : collect();

            // Mode fixed + tugas: sesi Time Tracker tugas yang belum ditagih ikut
            // ditautkan ke item (harga tetap), supaya jamnya tidak ditagih dua kali.
            if (! $isHourly && $task instanceof Task) {
                $sessions = WorkSession::where('client_id', $invoice->client_id)
                    ->where('task_id', $task->id)
                    ->where('status', 'completed')
                    ->get();
            }

            $manualHours = null;
            if ($isHourly && $sessions->isEmpty() && ($row['hours_qty'] ?? '') !== '' && $row['hours_qty'] !== null) {
                $manualHours = round((float) ($row['hours_qty'] ?? 0), 4);
            }

            $hours = $sessions->isNotEmpty()
                ? $sessions->sum('duration_seconds') / 3600
                : (float) $manualHours;

            $lineTotal = $isHourly ? round($hours * $unitPrice, 2) : $unitPrice;

            // Proyek item: pilihan eksplisit, proyek tugas, atau proyek sesi Time Tracker bila semua sama.
            $sessionProjects = $sessions->pluck('project_id')->filter()->unique();
            $itemProjectId = ! empty($row['project_id'])
                ? (int) $row['project_id']
                : ($this->taskProjectFor($invoice, $task)
                    ?? ($sessionProjects->count() === 1 ? (int) $sessionProjects->first() : null));
            // Item yang proyeknya sama dengan proyek invoice tidak perlu ditandai ulang.
            if ($itemProjectId !== null && $itemProjectId === $invoice->project_id) {
                $itemProjectId = null;
            }

            $item = InvoiceItem::create([
                'invoice_id' => $invoice->id,
                'product_id' => $row['product_id'] ?? null,
                'project_id' => $itemProjectId,
                'task_id' => $task?->id,
                'description' => (string) $row['description'],
                'unit_price' => $unitPrice,
                'manual_hours' => $manualHours,
                'line_total' => $lineTotal,
                'sort_order' => $i,
            ]);

            foreach ($sessions as $session) {
                $sessionMap[$session->id] = $item->id;
            }
            if ($task instanceof Task) {
                $taskMap[$task->id] = $item->id;
            }
            $subtotal += $lineTotal;
        }

        foreach ($taskMap as $taskId => $itemId) {
            // Atomik: hanya tugas yang belum ditagih (atau sudah di invoice ini).
            // Validasi request bisa lolos bersamaan untuk dua invoice; yang kalah
            // gagal di sini dan seluruh transaksi dibatalkan (tidak ditagih dua kali).
            $linked = Task::withTrashed()
                ->whereKey($taskId)
                ->where(fn ($q) => $q->whereNull('invoice_id')->orWhere('invoice_id', $invoice->id))
                ->update([
                    'invoice_id' => $invoice->id,
                    'invoice_item_id' => $itemId,
                ]);

            if ($linked === 0) {
                throw ValidationException::withMessages([
                    'items' => 'Salah satu tugas sudah ditagihkan di invoice lain. Muat ulang lalu coba lagi.',
                ]);
            }
        }

        $this->applyTotals($invoice, $subtotal, $data);

        foreach ($sessionMap as $sessionId => $itemId) {
            DB::table('work_sessions')
                ->where('id', $sessionId)
                ->update([
                    'status' => 'billed',
                    'invoice_id' => $invoice->id,
                    'invoice_item_id' => $itemId,
                ]);
        }
    }

    /**
     * Lepas tugas yang ditagihkan di invoice ini (kembali "belum ditagih").
     * Dipanggil saat item dibangun ulang (UpdateInvoice), draft dihapus, dan
     * invoice dibatalkan — sama seperti sesi Time Tracker.
     */
    public static function releaseTasks(Invoice $invoice): void
    {
        Task::withTrashed()
            ->where('invoice_id', $invoice->id)
            ->update(['invoice_id' => null, 'invoice_item_id' => null]);
    }

    /**
     * Proyek default item dari tugasnya — hanya bila cocok dengan proyek
     * invoice (sama / sub-proyeknya) atau invoice tanpa proyek.
     */
    private function taskProjectFor(Invoice $invoice, ?Task $task): ?int
    {
        if (! $task instanceof Task) {
            return null;
        }

        if ($invoice->project_id === null
            || $task->project_id === $invoice->project_id
            || $task->project->parent_id === $invoice->project_id) {
            return $task->project_id;
        }

        return null;
    }

    /**
     * Hitung diskon (nominal / persen), PPN, PPh 23, dan total.
     *
     *   DPP   = subtotal − diskon
     *   PPN   = DPP × tax_rate
     *   PPh23 = DPP × pph_rate   (dipotong & disetor klien; bukan uang yang kita terima)
     *   total = DPP + PPN − PPh23 → jumlah yang benar-benar dibayar klien.
     *
     * Semua yang memakai `total` (sisa tagihan, cicilan, QRIS, laporan) otomatis
     * memakai nilai bersih setelah PPh.
     *
     * @param  array<string, mixed>  $data
     */
    public function applyTotals(Invoice $invoice, float $subtotal, array $data): void
    {
        $type = ($data['discount_type'] ?? 'amount') === 'percent' ? 'percent' : 'amount';
        // Kompatibel dengan payload lama yang hanya mengirim `discount` (nominal).
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

        $invoice->subtotal = round($subtotal, 2);
        $invoice->discount_type = $type;
        $invoice->discount_value = $value;
        $invoice->discount = $discount;
        $invoice->tax_rate = $taxRate;
        $invoice->tax_amount = $tax;
        $invoice->pph_rate = $pphRate;
        $invoice->pph_amount = $pph;
        $invoice->total = max(0, round($taxable + $tax - $pph, 2));
    }

    /**
     * Generate payment_schedules untuk cicilan. Total dibagi rata, cicilan
     * terakhir menampung sisa pembulatan. Due date invoice diisi otomatis
     * dari cicilan terakhir bila kosong (belum di-save).
     *
     * @param  array{count:int, first_due_date:string, interval_days?:int}  $installments
     */
    public function buildSchedules(Invoice $invoice, array $installments): void
    {
        $count = max(2, (int) $installments['count']);
        $interval = max(7, (int) ($installments['interval_days'] ?? 30));
        $firstDue = Carbon::parse($installments['first_due_date']);

        $total = (float) $invoice->total;
        $perInstallment = floor(($total / $count) * 100) / 100;
        $remainder = round($total - ($perInstallment * $count), 2);

        $lastDue = null;
        for ($i = 1; $i <= $count; $i++) {
            $lastDue = $firstDue->copy()->addDays(($i - 1) * $interval)->toDateString();

            PaymentSchedule::create([
                'invoice_id' => $invoice->id,
                'sequence' => $i,
                'due_date' => $lastDue,
                'amount' => $i === $count ? round($perInstallment + $remainder, 2) : $perInstallment,
                'status' => 'pending',
            ]);
        }

        if (! $invoice->due_date) {
            $invoice->due_date = Carbon::parse($lastDue)->toImmutable();
        }
    }
}
