<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property int $client_id
 * @property int|null $project_id
 * @property int|null $invoice_id
 * @property int|null $invoice_item_id
 * @property string $description
 * @property string $unit_price
 * @property CarbonImmutable|null $started_at
 * @property CarbonImmutable|null $ended_at
 * @property int|null $duration_seconds
 * @property string $status
 * @property string|null $notes
 * @property-read User|null $user
 * @property-read Client $client
 * @property-read Project|null $project
 * @property-read Invoice|null $invoice
 * @property-read InvoiceItem|null $invoiceItem
 */
#[Fillable([
    'user_id',
    'client_id',
    'project_id',
    'invoice_id',
    'invoice_item_id',
    'description',
    'unit_price',
    'started_at',
    'ended_at',
    'duration_seconds',
    'status',
    'notes',
])]
class WorkSession extends Model
{
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'unit_price' => 'decimal:2',
            'duration_seconds' => 'integer',
        ];
    }

    /**
     * Pengguna yang mencatat waktu (time tracker per pengguna).
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<InvoiceItem, $this>
     */
    public function invoiceItem(): BelongsTo
    {
        return $this->belongsTo(InvoiceItem::class);
    }

    public function isRunning(): bool
    {
        return $this->status === 'running';
    }

    /**
     * Session masih "menempel" ke tracker (belum selesai / belum dibill).
     * Dipakai buat lock: tiap pengguna hanya boleh punya 1 session aktif.
     */
    public function isActive(): bool
    {
        return in_array($this->status, ['running', 'paused'], true);
    }

    /**
     * Subtotal = duration (jam) × unit_price, dibulatkan 2 desimal.
     * Hanya meaningful untuk session yang sudah selesai — running/paused
     * punya duration parsial (akumulasi segmen) jadi return 0.
     */
    public function subtotal(): float
    {
        if (! in_array($this->status, ['completed', 'billed'], true) || ! $this->duration_seconds) {
            return 0.0;
        }

        return round(($this->duration_seconds / 3600) * (float) $this->unit_price, 2);
    }

    /**
     * Total detik elapsed sejauh ini.
     * - running   : akumulasi + segmen berjalan (now - started_at)
     * - paused    : akumulasi saja (started_at menunjuk segmen terakhir yang sudah ditutup)
     * - completed : duration_seconds final
     */
    public function elapsedSeconds(): int
    {
        $base = (int) ($this->duration_seconds ?? 0);

        if ($this->status === 'running' && $this->started_at) {
            return $base + max(0, (int) $this->started_at->diffInSeconds(now()));
        }

        if ($this->status === 'paused') {
            return $base;
        }

        // completed/billed/cancelled → duration_seconds sudah final.
        return $base;
    }
}
