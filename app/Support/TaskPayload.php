<?php

namespace App\Support;

use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use App\Models\User;
use App\Models\WorkSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Bentuk data tugas untuk frontend (lihat resources/js/types/tasks.ts).
 *
 * `row()` mengharapkan relasi project.parent, project.client, assignee sudah
 * di-eager-load dan agregat dari Task::scopeWithListAggregates().
 */
class TaskPayload
{
    /** Relasi yang perlu di-eager-load untuk row(). */
    public const WITH = ['project.parent:id,name', 'project.client:id,name', 'assignee:id,name'];

    /**
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public static function prepare(Builder $query): Builder
    {
        return $query->with(self::WITH)->withListAggregates();
    }

    /** ID tugas yang sedang dicatat stopwatch (running/paused) milik pengguna. */
    public static function runningTaskId(User $user): ?int
    {
        $id = WorkSession::query()
            ->where('user_id', $user->id)
            ->whereIn('status', ['running', 'paused'])
            ->whereNotNull('task_id')
            ->value('task_id');

        return $id !== null ? (int) $id : null;
    }

    /**
     * @return array<string, mixed>
     */
    public static function row(Task $task, User $viewer, ?int $runningTaskId = null): array
    {
        $project = $task->project;
        $isBilled = $task->isBilled();
        $canUpdate = $viewer->isAdmin() || $task->assignee_id === $viewer->id || $task->created_by === $viewer->id;
        $canDelete = ! $isBilled && ($viewer->isAdmin() || $task->created_by === $viewer->id);

        return [
            'id' => $task->id,
            'title' => $task->title,
            'status' => $task->status,
            'priority' => $task->priority,
            'project' => [
                'id' => $project->id,
                'parent_id' => $project->parent_id,
                'full_name' => $project->full_name,
                'client' => ['id' => $project->client->id, 'name' => $project->client->name],
            ],
            'assignee' => $task->assignee ? ['id' => $task->assignee->id, 'name' => $task->assignee->name] : null,
            'created_by' => $task->created_by,
            'start_date' => $task->start_date?->toDateString(),
            'due_date' => $task->due_date?->toDateString(),
            'estimate_minutes' => $task->estimate_minutes,
            'logged_minutes' => intdiv($task->loggedSeconds(), 60),
            'billable' => $task->billable,
            'fixed_price' => $task->fixed_price !== null ? (string) $task->fixed_price : null,
            'is_overdue' => $task->isOverdue(),
            'is_billed' => $isBilled,
            'checklist_total' => (int) ($task->getAttribute('checklist_total') ?? 0),
            'checklist_done' => (int) ($task->getAttribute('checklist_done') ?? 0),
            'comments_count' => (int) ($task->getAttribute('comments_count') ?? 0),
            'position' => $task->position,
            'completed_at' => $task->completed_at?->toIso8601String(),
            'has_running_session' => $runningTaskId !== null && $runningTaskId === $task->id,
            'can' => ['update' => $canUpdate, 'delete' => $canDelete],
        ];
    }

    /**
     * Detail untuk panel samping (GET /tasks/{task}).
     *
     * @return array<string, mixed>
     */
    public static function detail(Task $task, User $viewer): array
    {
        $task->loadMissing([...self::WITH, 'creator:id,name', 'invoice:id,invoice_number,status', 'checklistItems', 'comments.user:id,name']);
        $task->loadSum(['workSessions as logged_seconds' => fn ($q) => $q->whereIn('status', ['completed', 'billed'])], 'duration_seconds');
        $task->setAttribute('checklist_total', $task->checklistItems->count());
        $task->setAttribute('checklist_done', $task->checklistItems->where('is_done', true)->count());
        $task->setAttribute('comments_count', $task->comments->count());

        $sessions = $task->workSessions()
            ->with('user:id,name')
            ->latest('started_at')
            ->latest('id')
            ->limit(20)
            ->get();

        $activity = [['type' => 'created', 'at' => $task->created_at?->toIso8601String(), 'user' => $task->creator?->name]];
        if ($task->completed_at) {
            $activity[] = ['type' => 'completed', 'at' => $task->completed_at->toIso8601String(), 'user' => null];
        }
        if ($task->invoice) {
            $activity[] = ['type' => 'billed', 'at' => null, 'user' => null, 'invoice_number' => $task->invoice->invoice_number];
        }

        $assignable = User::query()
            ->whereIn('id', Access::assignableUserIds($task->project))
            ->orderBy('name')
            ->get(['id', 'name']);

        return [
            ...self::row($task, $viewer, self::runningTaskId($viewer)),
            'description' => $task->description,
            'creator' => $task->creator ? ['id' => $task->creator->id, 'name' => $task->creator->name] : null,
            'created_at' => $task->created_at?->toIso8601String(),
            'updated_at' => $task->updated_at?->toIso8601String(),
            'invoice' => $task->invoice ? [
                'id' => $task->invoice->id,
                'invoice_number' => $task->invoice->invoice_number,
                'status' => $task->invoice->status,
            ] : null,
            'checklist' => $task->checklistItems->map(fn (TaskChecklistItem $i) => [
                'id' => $i->id,
                'body' => $i->body,
                'is_done' => $i->is_done,
                'position' => $i->position,
            ])->values()->all(),
            'comments' => $task->comments->map(fn (TaskComment $c) => [
                'id' => $c->id,
                'body' => $c->body,
                'user' => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
                'created_at' => $c->created_at?->toIso8601String(),
                'can_delete' => $viewer->isAdmin() || $c->user_id === $viewer->id,
            ])->values()->all(),
            'sessions' => $sessions->map(fn (WorkSession $s) => [
                'id' => $s->id,
                'user' => $s->user ? ['id' => $s->user->id, 'name' => $s->user->name] : null,
                'description' => $s->description,
                'status' => $s->status,
                'started_at' => $s->started_at?->toIso8601String(),
                'ended_at' => $s->ended_at?->toIso8601String(),
                'duration_seconds' => $s->elapsedSeconds(),
                'billed' => $s->status === 'billed',
            ])->values()->all(),
            'activity' => $activity,
            'assignable_users' => $assignable->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values()->all(),
            'can' => [
                ...self::row($task, $viewer)['can'],
                'comment' => true,
                'start_timer' => true,
            ],
        ];
    }

    /**
     * Ringkasan tugas per proyek (status + lewat tenggat) — untuk halaman proyek.
     *
     * @param  list<int>  $projectIds
     * @return array{todo: int, in_progress: int, review: int, done: int, total: int, open: int, overdue: int}
     */
    public static function summary(array $projectIds): array
    {
        $counts = DB::table('tasks')
            ->whereNull('deleted_at')
            ->whereIn('project_id', $projectIds)
            ->groupBy('status')
            ->selectRaw('status, COUNT(*) as c')
            ->pluck('c', 'status');

        $overdue = DB::table('tasks')
            ->whereNull('deleted_at')
            ->whereIn('project_id', $projectIds)
            ->where('status', '!=', 'done')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->count();

        $result = ['todo' => 0, 'in_progress' => 0, 'review' => 0, 'done' => 0];
        foreach ($result as $status => $_) {
            $result[$status] = (int) ($counts[$status] ?? 0);
        }
        $total = array_sum($result);

        return [...$result, 'total' => $total, 'open' => $total - $result['done'], 'overdue' => $overdue];
    }
}
