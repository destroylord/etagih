<?php

namespace App\Models;

use App\Support\Access;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $client_id
 * @property int|null $project_id
 * @property string $invoice_number
 * @property CarbonImmutable $issue_date
 * @property CarbonImmutable|null $due_date
 * @property 'fixed'|'hourly' $invoice_mode
 * @property 'full'|'installment' $type
 * @property numeric-string|float $subtotal
 * @property numeric-string|float $discount
 * @property 'amount'|'percent' $discount_type
 * @property numeric-string|float $discount_value
 * @property numeric-string|float $tax_rate
 * @property numeric-string|float $tax_amount
 * @property numeric-string|float $pph_rate
 * @property numeric-string|float $pph_amount
 * @property numeric-string|float $total
 * @property numeric-string|float $paid_amount
 * @property string $status
 * @property string $public_token
 * @property string|null $notes
 * @property int $reminder_count
 * @property CarbonImmutable|null $last_reminded_at
 * @property string $recurrence
 * @property CarbonImmutable|null $recurrence_next_date
 * @property bool $recurrence_auto_send
 * @property int|null $recurring_parent_id
 * @property CarbonImmutable|null $cancelled_at
 * @property string|null $cancel_reason
 * @property-read Client $client
 * @property-read Project|null $project
 * @property-read Collection<int, InvoiceItem> $items
 * @property-read Collection<int, Payment> $payments
 * @property-read Collection<int, PaymentSchedule> $schedules
 * @property-read Invoice|null $recurringParent
 */
#[Fillable([
    'client_id',
    'project_id',
    'invoice_number',
    'issue_date',
    'due_date',
    'invoice_mode',
    'type',
    'subtotal',
    'discount',
    'discount_type',
    'discount_value',
    'tax_rate',
    'pph_rate',
    'pph_amount',
    'tax_amount',
    'total',
    'paid_amount',
    'status',
    'public_token',
    'notes',
    'reminder_count',
    'last_reminded_at',
    'recurrence',
    'recurrence_next_date',
    'recurrence_auto_send',
    'recurring_parent_id',
    'cancelled_at',
    'cancel_reason',
])]
class Invoice extends Model
{
    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'pph_rate' => 'decimal:2',
            'pph_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'last_reminded_at' => 'datetime',
            'recurrence_next_date' => 'date',
            'recurrence_auto_send' => 'boolean',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return HasMany<InvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * @return HasMany<PaymentSchedule, $this>
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(PaymentSchedule::class)->orderBy('sequence');
    }

    /**
     * Tugas yang ditagihkan di invoice ini.
     *
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /**
     * Invoice yang boleh dilihat pengguna: kliennya terlihat (App\Support\Access).
     *
     * @param  Builder<Invoice>  $query
     * @return Builder<Invoice>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $ids = Access::clientIds($user);

        return $ids === null ? $query : $query->whereIn($query->qualifyColumn('client_id'), $ids);
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function recurringParent(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'recurring_parent_id');
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /** Bisa dibayar klien: sudah dikirim, belum lunas, tidak dibatalkan. */
    public function isPayable(): bool
    {
        return in_array($this->status, ['sent', 'partial', 'overdue'], true) && ! $this->isFullyPaid();
    }

    public function isRecurring(): bool
    {
        return $this->recurrence !== 'none';
    }

    /** Total sebelum PPh 23 dipotong (DPP + PPN) — yang tertulis sebagai "Total tagihan". */
    public function grossTotal(): float
    {
        return round((float) $this->total + (float) $this->pph_amount, 2);
    }

    public function remainingAmount(): float
    {
        // Bulatkan ke sen untuk menghindari error presisi float
        // (mis. 110000.00 - 73333.32 = 36666.679999… yang seharusnya 36666.68).
        return max(0, round((float) $this->total - (float) $this->paid_amount, 2));
    }

    public function isFullyPaid(): bool
    {
        return $this->remainingAmount() <= 0;
    }

    public function isInstallment(): bool
    {
        return $this->type === 'installment';
    }

    public function isHourly(): bool
    {
        return $this->invoice_mode === 'hourly';
    }

    public function publicUrl(): string
    {
        return url('/pay/'.$this->public_token);
    }
}
