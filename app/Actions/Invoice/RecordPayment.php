<?php

namespace App\Actions\Invoice;

use App\Jobs\SendPaymentReceivedNotification;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentSchedule;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Record payment (manual atau dari webhook QRISLY).
 *
 * Flow:
 * 1. Validate amount > 0 dan amount <= remaining
 * 2. Create / update Payment row (status = success)
 * 3. Update invoice.paid_amount, recompute status
 * 4. Cicilan: tandai schedule yang dibayar + alokasikan sisa saldo berurutan
 * 5. Kirim WA konfirmasi
 */
class RecordPayment
{
    /**
     * @param  array<string, mixed>|null  $rawResponse
     */
    public function execute(
        Invoice $invoice,
        float $amount,
        ?string $externalId = null,
        ?int $scheduleId = null,
        ?array $rawResponse = null,
        string $method = 'qris',
        string $status = 'success',
        ?CarbonInterface $paidAt = null,
        ?string $notes = null,
    ): Payment {
        $payment = DB::transaction(function () use ($invoice, $amount, $externalId, $scheduleId, $rawResponse, $method, $status, $paidAt, $notes) {
            // Idempotent: kalau external_id sudah pernah sukses, return existing.
            if ($externalId) {
                $existing = Payment::where('external_id', $externalId)->lockForUpdate()->first();
                if ($existing && $existing->status === 'success') {
                    return $existing;
                }
            }

            // Lock invoice row to prevent concurrent paid_amount updates.
            $invoice = Invoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            $payment = Payment::firstOrNew(
                ['external_id' => $externalId ?? Str::random(40)],
            );
            // Pending payment dari halaman bayar sudah tahu cicilan mana yang dibayar.
            $scheduleId ??= $payment->schedule_id;

            $payment->fill([
                'invoice_id' => $invoice->id,
                'schedule_id' => $scheduleId,
                'amount' => $amount,
                'method' => $method,
                'external_id' => $externalId,
                'status' => $status,
                'paid_at' => $status === 'success' ? ($paidAt ?? now()) : null,
                'raw_response' => $rawResponse,
                'notes' => $notes ?? $payment->notes,
            ]);
            $payment->save();

            if ($status !== 'success') {
                return $payment;
            }

            $payment->assignReceiptNumber();

            // Atomic increment to avoid read-modify-write race.
            $invoice->increment('paid_amount', $amount);
            $invoice->refresh();

            $this->allocateToSchedules($invoice, $payment, $scheduleId);

            if ($invoice->isFullyPaid()) {
                $invoice->status = 'paid';
                // Jaring pengaman selisih pembulatan: lunas = semua cicilan lunas.
                $invoice->schedules()->where('status', '!=', 'paid')
                    ->update(['status' => 'paid', 'paid_at' => now(), 'payment_id' => $payment->id]);
            } elseif ($invoice->isInstallment()) {
                $invoice->status = 'partial';
            }
            $invoice->save();

            return $payment->fresh();
        });

        // Kirim WA konfirmasi async via queue — jangan blok webhook response.
        SendPaymentReceivedNotification::dispatch($payment);

        return $payment;
    }

    /**
     * Tandai cicilan yang sudah tertutup pembayaran.
     *
     * 1. Schedule yang dibayar eksplisit (scheduleId) langsung ditandai paid.
     * 2. Sisa saldo (paid_amount - Σ cicilan paid) dialokasikan ke cicilan
     *    belum lunas sesuai urutan sequence. Jadi pembayaran tanpa scheduleId
     *    (mis. bayar sisa tagihan) tetap menutup cicilan yang benar dan
     *    cicilan yang sudah dibayar tidak lagi kena reminder overdue.
     */
    private function allocateToSchedules(Invoice $invoice, Payment $payment, ?int $scheduleId): void
    {
        if ($scheduleId) {
            PaymentSchedule::where('invoice_id', $invoice->id)
                ->where('id', $scheduleId)
                ->where('status', '!=', 'paid')
                ->first()
                ?->markPaid($payment->id);
        }

        /** @var Collection<int, PaymentSchedule> $schedules */
        $schedules = PaymentSchedule::where('invoice_id', $invoice->id)->orderBy('sequence')->get();
        if ($schedules->isEmpty()) {
            return;
        }

        $credit = round((float) $invoice->paid_amount - (float) $schedules->where('status', 'paid')->sum('amount'), 2);

        foreach ($schedules->where('status', '!=', 'paid') as $schedule) {
            if ($credit + 0.005 < (float) $schedule->amount) {
                break;
            }
            $schedule->markPaid($payment->id);
            $credit = round($credit - (float) $schedule->amount, 2);
        }
    }
}
