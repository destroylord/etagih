<?php

namespace App\Models;

use App\Support\Access;
use Carbon\CarbonImmutable;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Tugas di proyek / sub-proyek. Bisa ditugaskan ke satu pengguna, dicatat
 * waktunya lewat Time Tracker (work_sessions.task_id), dan ditagihkan ke
 * invoice (invoice_id / invoice_item_id terisi saat masuk item invoice).
 *
 * @property int $id
 * @property int $project_id
 * @property string $title
 * @property string|null $description
 * @property 'todo'|'in_progress'|'review'|'done' $status
 * @property 'low'|'normal'|'high'|'urgent' $priority
 * @property int|null $assignee_id
 * @property int|null $created_by
 * @property CarbonImmutable|null $start_date
 * @property CarbonImmutable|null $due_date
 * @property int|null $estimate_minutes
 * @property bool $billable
 * @property numeric-string|null $fixed_price
 * @property int $position
 * @property CarbonImmutable|null $completed_at
 * @property int|null $invoice_id
 * @property int|null $invoice_item_id
 * @property CarbonImmutable|null $due_soon_notified_at
 * @property CarbonImmutable|null $overdue_notified_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Project $project
 * @property-read User|null $assignee
 * @property-read User|null $creator
 * @property-read Invoice|null $invoice
 * @property-read InvoiceItem|null $invoiceItem
 * @property-read Collection<int, TaskChecklistItem> $checklistItems
 * @property-read Collection<int, TaskComment> $comments
 * @property-read Collection<int, WorkSession> $workSessions
 */
#[Fillable([
    'project_id',
    'title',
    'description',
    'status',
    'priority',
    'assignee_id',
    'created_by',
    'start_date',
    'due_date',
    'estimate_minutes',
    'billable',
    'fixed_price',
    'position',
    'completed_at',
    'invoice_id',
    'invoice_item_id',
    'due_soon_notified_at',
    'overdue_notified_at',
])]
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory, SoftDeletes;

    public const STATUSES = ['todo', 'in_progress', 'review', 'done'];

    public const STATUS_LABELS = [
        'todo' => 'To do',
        'in_progress' => 'Dikerjakan',
        'review' => 'Review',
        'done' => 'Selesai',
    ];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    public const PRIORITY_LABELS = [
        'low' => 'Rendah',
        'normal' => 'Normal',
        'high' => 'Tinggi',
        'urgent' => 'Mendesak',
    ];

    protected $attributes = [
        'status' => 'todo',
        'priority' => 'normal',
        'billable' => true,
        'position' => 0,
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'immutable_date',
            'due_date' => 'immutable_date',
            'completed_at' => 'immutable_datetime',
            'due_soon_notified_at' => 'immutable_datetime',
            'overdue_notified_at' => 'immutable_datetime',
            'estimate_minutes' => 'integer',
            'billable' => 'boolean',
            'fixed_price' => 'decimal:2',
            'position' => 'integer',
        ];
    }

    /**
     * Status `done` mengisi completed_at; keluar dari `done` mengosongkannya.
     * Ganti tenggat → pengingat boleh dikirim lagi.
     */
    protected static function booted(): void
    {
        static::saving(function (Task $task) {
            if ($task->isDirty('status')) {
                if ($task->status === 'done') {
                    $task->completed_at ??= now()->toImmutable();
                } else {
                    $task->completed_at = null;
                }
            }

            if ($task->exists && $task->isDirty('due_date')) {
                $task->due_soon_notified_at = null;
                $task->overdue_notified_at = null;
            }
        });
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
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

    /**
     * @return HasMany<TaskChecklistItem, $this>
     */
    public function checklistItems(): HasMany
    {
        return $this->hasMany(TaskChecklistItem::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<TaskComment, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class)->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasMany<WorkSession, $this>
     */
    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    /**
     * Tugas yang boleh dilihat pengguna: proyeknya terlihat (App\Support\Access).
     *
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $ids = Access::projectIds($user);

        return $ids === null ? $query : $query->whereIn($query->qualifyColumn('project_id'), $ids);
    }

    /**
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where($query->qualifyColumn('status'), '!=', 'done');
    }

    /**
     * Tambah kolom agregat untuk daftar/papan: logged_seconds, checklist_total,
     * checklist_done, comments_count.
     *
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public function scopeWithListAggregates(Builder $query): Builder
    {
        return $query
            ->withSum(['workSessions as logged_seconds' => fn ($q) => $q->whereIn('status', ['completed', 'billed'])], 'duration_seconds')
            ->withCount([
                'checklistItems as checklist_total',
                'checklistItems as checklist_done' => fn ($q) => $q->where('is_done', true),
                'comments',
            ]);
    }

    public function isDone(): bool
    {
        return $this->status === 'done';
    }

    /** Lewat tenggat dan belum selesai. */
    public function isOverdue(): bool
    {
        return $this->due_date !== null
            && $this->status !== 'done'
            && $this->due_date->lt(now()->startOfDay());
    }

    /** Sudah masuk item invoice. */
    public function isBilled(): bool
    {
        return $this->invoice_id !== null;
    }

    /**
     * Total detik tercatat (sesi selesai / sudah ditagih). Pakai agregat
     * `logged_seconds` dari withListAggregates() bila tersedia.
     */
    public function loggedSeconds(): int
    {
        $aggregate = $this->getAttribute('logged_seconds');
        if ($aggregate !== null) {
            return (int) $aggregate;
        }

        return (int) $this->workSessions()->whereIn('status', ['completed', 'billed'])->sum('duration_seconds');
    }

    /** "/tasks?task=12" — tautan untuk notifikasi & email. */
    public function url(): string
    {
        return url('/tasks?task='.$this->id);
    }
}
