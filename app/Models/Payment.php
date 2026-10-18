<?php

namespace App\Models;

use App\Support\ReceiptNumberGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int|null $schedule_id
 * @property string $amount
 * @property 'qris'|'manual' $method
 * @property string|null $external_id
 * @property string|null $receipt_number
 * @property string $status
 * @property CarbonImmutable|null $paid_at
 * @property array<string, mixed>|null $raw_response
 * @property string|null $notes
 * @property-read Invoice $invoice
 * @property-read PaymentSchedule|null $schedule
 */
#[Fillable([
    'invoice_id',
    'schedule_id',
    'amount',
    'method',
    'external_id',
    'status',
    'paid_at',
    'raw_response',
    'notes',
])]
class Payment extends Model
{
    /** Laravel 13 belum punya attribute `#[Hidden]` native — pakai property sesuai spec. */
    protected $hidden = ['raw_response'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'raw_response' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<PaymentSchedule, $this>
     */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PaymentSchedule::class);
    }

    /**
     * Beri nomor kuitansi (sekali saja) untuk pembayaran sukses.
     * Dipanggil di dalam transaksi RecordPayment.
     */
    public function assignReceiptNumber(): void
    {
        if (! $this->isSuccess() || $this->receipt_number) {
            return;
        }

        $this->receipt_number = app(ReceiptNumberGenerator::class)->next($this->paid_at);
        $this->save();
    }

    public function isSuccess(): bool
    {
        return $this->status === 'success';
    }

    /**
     * @param  array<string, mixed>|null  $rawResponse
     */
    public function markSuccess(?string $externalId = null, ?array $rawResponse = null): void
    {
        $this->update([
            'status' => 'success',
            'paid_at' => now(),
            'external_id' => $externalId ?? $this->external_id,
            'raw_response' => $rawResponse,
        ]);
    }
}
