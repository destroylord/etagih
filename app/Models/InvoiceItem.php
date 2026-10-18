<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int|null $product_id
 * @property int|null $project_id
 * @property string $description
 * @property string $unit_price
 * @property string|null $manual_hours
 * @property string $line_total
 * @property int $sort_order
 * @property-read float $hours_qty
 * @property-read Invoice $invoice
 * @property-read Product|null $product
 * @property-read Project|null $project
 * @property-read Collection<int, WorkSession> $sessions
 */
class InvoiceItem extends Model
{
    // Jam ikut diserialisasi ke frontend (kolom Qty/Jam). Eager-load relasi
    // sessions supaya tidak memicu query per item.
    protected $appends = ['hours_qty'];

    protected $fillable = [
        'invoice_id',
        'product_id',
        'project_id',
        'description',
        'unit_price',
        'manual_hours',
        'line_total',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'manual_hours' => 'decimal:4',
            'line_total' => 'decimal:2',
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
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return HasMany<WorkSession, $this>
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    /**
     * hours_qty = sum(duration_seconds) / 3600, dari sessions completed/billed.
     * Round ke 4 desimal biar line_total presisi.
     *
     * Sessions di-link ke item saat invoice di-submit (lihat InvoiceLineBuilder).
     * Kalau item tidak punya sessions, pakai manual_hours (jam input manual).
     */
    public function getHoursQtyAttribute(): float
    {
        $seconds = $this->relationLoaded('sessions')
            ? (int) $this->sessions->whereIn('status', ['completed', 'billed'])->sum('duration_seconds')
            : (int) $this->sessions()->whereIn('status', ['completed', 'billed'])->sum('duration_seconds');

        // Item hourly tanpa sessions (input jam manual) menyimpan jamnya sendiri.
        if ($seconds === 0 && $this->manual_hours !== null) {
            return round((float) $this->manual_hours, 4);
        }

        return round($seconds / 3600, 4);
    }
}
