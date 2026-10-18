<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Penawaran harga (quotation). Setelah diterima klien bisa diubah menjadi invoice.
 *
 * @property int $id
 * @property int $client_id
 * @property int|null $project_id
 * @property string $quote_number
 * @property CarbonImmutable $issue_date
 * @property CarbonImmutable|null $valid_until
 * @property numeric-string|float $subtotal
 * @property numeric-string|float $discount
 * @property 'amount'|'percent' $discount_type
 * @property numeric-string|float $discount_value
 * @property numeric-string|float $tax_rate
 * @property numeric-string|float $tax_amount
 * @property numeric-string|float $pph_rate
 * @property numeric-string|float $pph_amount
 * @property numeric-string|float $total
 * @property 'draft'|'sent'|'accepted'|'declined'|'expired'|'converted' $status
 * @property string $public_token
 * @property string|null $notes
 * @property string|null $terms
 * @property CarbonImmutable|null $sent_at
 * @property CarbonImmutable|null $accepted_at
 * @property string|null $accepted_by
 * @property CarbonImmutable|null $declined_at
 * @property string|null $decline_reason
 * @property string|null $response_note
 * @property int|null $converted_invoice_id
 * @property-read Client $client
 * @property-read Project|null $project
 * @property-read Collection<int, QuoteItem> $items
 * @property-read Invoice|null $convertedInvoice
 */
#[Fillable([
    'client_id',
    'project_id',
    'quote_number',
    'issue_date',
    'valid_until',
    'subtotal',
    'discount',
    'discount_type',
    'discount_value',
    'tax_rate',
    'tax_amount',
    'pph_rate',
    'pph_amount',
    'total',
    'status',
    'public_token',
    'notes',
    'terms',
    'sent_at',
    'accepted_at',
    'accepted_by',
    'declined_at',
    'decline_reason',
    'response_note',
    'converted_invoice_id',
])]
class Quote extends Model
{
    public const STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'];

    /** Nomor penawaran: PNW-YYYYMMDD-XXXX. */
    public const NUMBER_PREFIX = 'PNW';

    /** Masa berlaku default (hari sejak tanggal terbit). */
    public const DEFAULT_VALID_DAYS = 14;

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'valid_until' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'pph_rate' => 'decimal:2',
            'pph_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
            'declined_at' => 'datetime',
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
     * @return HasMany<QuoteItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(QuoteItem::class)->orderBy('sort_order');
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function convertedInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'converted_invoice_id');
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    /** Masa berlaku sudah lewat (valid_until sebelum hari ini). */
    public function isPastValidity(): bool
    {
        return $this->valid_until !== null && $this->valid_until->lt(now()->startOfDay());
    }

    /** Klien masih bisa menerima / menolak lewat halaman publik. */
    public function canRespond(): bool
    {
        return $this->status === 'sent' && ! $this->isPastValidity();
    }

    /** Bisa diubah menjadi invoice: terkirim / diterima, atau sudah dikonversi tapi invoicenya terhapus. */
    public function canConvert(): bool
    {
        return in_array($this->status, ['sent', 'accepted'], true)
            || ($this->status === 'converted' && $this->converted_invoice_id === null);
    }

    /** Total sebelum PPh 23 dipotong (DPP + PPN). */
    public function grossTotal(): float
    {
        return round((float) $this->total + (float) $this->pph_amount, 2);
    }

    public function publicUrl(): string
    {
        return url('/q/'.$this->public_token);
    }
}
