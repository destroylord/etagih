<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Butir checklist di dalam tugas.
 *
 * @property int $id
 * @property int $task_id
 * @property string $body
 * @property bool $is_done
 * @property int $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Task $task
 */
#[Fillable(['task_id', 'body', 'is_done', 'position'])]
class TaskChecklistItem extends Model
{
    protected $attributes = [
        'is_done' => false,
        'position' => 0,
    ];

    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
