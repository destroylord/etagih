<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int $sequence
 * @property CarbonImmutable $due_date
 * @property string $amount
 * @property string $status
 * @property CarbonImmutable|null $paid_at
 * @property int|null $payment_id
 * @property int $reminder_count
 * @property CarbonImmutable|null $last_reminded_at
 * @property-read Invoice $invoice
 * @property-read Payment|null $payment
 */
#[Fillable([
    'invoice_id',
    'sequence',
    'due_date',
    'amount',
    'status',
    'paid_at',
    'payment_id',
    'reminder_count',
    'last_reminded_at',
])]
class PaymentSchedule extends Model
{
    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'last_reminded_at' => 'datetime',
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
     * @return BelongsTo<Payment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function markPaid(int $paymentId): void
    {
        $this->update([
            'status' => 'paid',
            'paid_at' => now(),
            'payment_id' => $paymentId,
        ]);
    }
}
