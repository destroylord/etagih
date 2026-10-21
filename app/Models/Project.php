<?php

namespace App\Models;

use App\Support\Access;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Proyek milik klien. `parent_id` null = proyek utama (mis. "Toko Online"),
 * terisi = sub-proyek (mis. "Aplikasi Mobile", "Dashboard Admin"). Maksimal 2 level.
 *
 * @property int $id
 * @property int $client_id
 * @property int|null $parent_id
 * @property string $name
 * @property string|null $description
 * @property 'active'|'completed'|'archived' $status
 * @property numeric-string|float|null $hourly_rate
 * @property-read Client $client
 * @property-read Project|null $parent
 * @property-read Collection<int, Project> $children
 * @property-read Collection<int, Invoice> $invoices
 * @property-read Collection<int, WorkSession> $workSessions
 * @property-read Collection<int, User> $members
 * @property-read Collection<int, Task> $tasks
 */
#[Fillable(['client_id', 'parent_id', 'name', 'description', 'status', 'hourly_rate'])]
class Project extends Model
{
    public const STATUSES = ['active', 'completed', 'archived'];

    protected $appends = ['full_name'];

    protected function casts(): array
    {
        return [
            'hourly_rate' => 'decimal:2',
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
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'parent_id');
    }

    /**
     * @return HasMany<Project, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Project::class, 'parent_id')->orderBy('name');
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<WorkSession, $this>
     */
    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    /**
     * Anggota tim (hanya bermakna di proyek utama; sub-proyek mewarisi dari induknya).
     *
     * @return BelongsToMany<User, $this>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')->withTimestamps();
    }

    /**
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /**
     * Proyek yang boleh dilihat pengguna (lihat App\Support\Access).
     *
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $ids = Access::projectIds($user);

        return $ids === null ? $query : $query->whereIn($query->qualifyColumn('id'), $ids);
    }

    /**
     * @param  Builder<Project>  $query
     * @return Builder<Project>
     */
    public function scopeTopLevel(Builder $query): Builder
    {
        return $query->whereNull('parent_id');
    }

    public function isSubProject(): bool
    {
        return $this->parent_id !== null;
    }

    /** "Toko Online › Aplikasi Mobile" untuk sub-proyek, "Toko Online" untuk proyek utama. */
    public function getFullNameAttribute(): string
    {
        if (! $this->parent_id) {
            return $this->name;
        }

        $parent = $this->relationLoaded('parent')
            ? $this->parent
            : Project::query()->whereKey($this->parent_id)->value('name');

        $parentName = $parent instanceof Project ? $parent->name : $parent;

        return $parentName ? "{$parentName} › {$this->name}" : $this->name;
    }

    /**
     * ID proyek ini + semua sub-proyeknya (untuk filter "proyek beserta sub").
     *
     * @return list<int>
     */
    public function selfAndChildIds(): array
    {
        return array_values([$this->id, ...Project::query()->where('parent_id', $this->id)->pluck('id')->map(fn ($id) => (int) $id)->all()]);
    }

    /** Proyek utama (diri sendiri bila sudah top-level). */
    public function root(): Project
    {
        return $this->parent_id ? ($this->parent ?? $this) : $this;
    }

    /** Masih dipakai invoice / item / sesi / tugas → tidak boleh dihapus (arsipkan saja). */
    public function isInUse(): bool
    {
        $ids = $this->selfAndChildIds();

        return Invoice::query()->whereIn('project_id', $ids)->exists()
            || InvoiceItem::query()->whereIn('project_id', $ids)->exists()
            || WorkSession::query()->whereIn('project_id', $ids)->exists()
            || Task::withTrashed()->whereIn('project_id', $ids)->exists();
    }
}
