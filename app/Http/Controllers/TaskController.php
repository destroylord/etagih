<?php

namespace App\Http\Controllers;

use App\Actions\WorkSession\StartWorkSession;
use App\Http\Requests\Task\StoreTaskRequest;
use App\Http\Requests\Task\UpdateTaskRequest;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use App\Models\User;
use App\Notifications\Tasks\TaskAssigned;
use App\Notifications\Tasks\TaskCommented;
use App\Support\Access;
use App\Support\TaskPayload;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Tugas per proyek / sub-proyek.
 *
 * Pola komunikasi (konsisten):
 * - Halaman `tasks/index` (Inertia) memuat daftar/papan.
 * - Detail untuk panel samping dibaca lewat JSON: GET /tasks/{task} (tasks.show).
 * - SEMUA penulisan (buat, ubah, pindah, checklist, komentar, hapus, mulai
 *   timer) memakai redirect back() + flash, jadi bisa dipanggil dengan
 *   router Inertia; panel cukup memuat ulang JSON detail setelahnya.
 *
 * Hak akses: App\Policies\TaskPolicy + middleware `visible`.
 */
class TaskController extends Controller
{
    public const VIEWS = ['mine', 'board', 'list'];

    public const BOARD_LIMIT = 500;

    /** Kolom "Selesai" di papan hanya menampilkan tugas yang selesai N hari terakhir (kecuali difilter status). */
    public const BOARD_DONE_DAYS = 30;

    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $view = in_array($request->query('view'), self::VIEWS, true) ? (string) $request->query('view') : 'mine';
        $filters = $this->filters($request);
        $runningTaskId = TaskPayload::runningTaskId($user);
        $present = fn (Task $t) => TaskPayload::row($t, $user, $runningTaskId);

        $base = TaskPayload::prepare(Task::query()->visibleTo($user));

        $tasks = match ($view) {
            'board' => $this->board($base, $filters, $user, $present),
            'list' => $this->applyFilters($base, $filters, $user)
                ->orderByRaw("CASE WHEN status = 'done' THEN 1 ELSE 0 END")
                ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
                ->orderBy('due_date')
                ->orderByDesc('id')
                ->paginate(25)
                ->withQueryString()
                ->through($present),
            default => $this->mine($base, $filters, $user, $present),
        };

        return Inertia::render('tasks/index', [
            'view' => $view,
            'filters' => $filters,
            'tasks' => $tasks,
            'projects' => $this->projectOptions($user),
            'users' => $this->userOptions($user),
            'statusLabels' => Task::STATUS_LABELS,
            'priorityLabels' => Task::PRIORITY_LABELS,
            'counts' => $this->counts($user),
        ]);
    }

    /** Detail tugas (JSON) untuk panel samping. */
    public function show(Request $request, Task $task): JsonResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('view', $task);

        return response()->json(['task' => TaskPayload::detail($task, $user)]);
    }

    public function store(StoreTaskRequest $request): RedirectResponse
    {
        $user = $this->user($request);
        $data = $request->validated();
        $status = $data['status'] ?? 'todo';

        $task = Task::create([
            ...$this->attributes($data),
            'status' => $status,
            'created_by' => $user->id,
            'position' => $this->nextPosition($status),
        ]);

        $this->notifyAssigned($task, $user);

        return back()->with('success', "Tugas \"{$task->title}\" ditambahkan.");
    }

    public function update(UpdateTaskRequest $request, Task $task): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('update', $task);

        $data = $request->validated();
        $previousAssignee = $task->assignee_id;

        $task->fill($this->attributes($data, partial: true));
        if (isset($data['status']) && $task->isDirty('status')) {
            $task->position = $this->nextPosition($task->status);
        }
        $task->save();

        if ($task->assignee_id !== $previousAssignee) {
            $this->notifyAssigned($task, $user);
        }

        return back()->with('success', 'Tugas diperbarui.');
    }

    public function destroy(Request $request, Task $task): RedirectResponse
    {
        $user = $this->user($request);

        if ($task->isBilled()) {
            return back()->with('error', 'Tugas sudah ditagihkan di invoice dan tidak bisa dihapus.');
        }
        Gate::forUser($user)->authorize('delete', $task);

        $task->delete();

        return back()->with('success', 'Tugas dihapus.');
    }

    /**
     * Pindah status / urutan (drag & drop papan, "Pindah ke…").
     *
     * Body: `status` (wajib), dan salah satu:
     * - `before_id`: taruh tepat sebelum tugas ini (paling andal walau papan difilter),
     * - `position`: indeks (0-based) di kolom tujuan (seluruh kolom, tanpa filter),
     * - tanpa keduanya: taruh di akhir kolom.
     * Urutan disimpan per kolom status (global, lintas proyek).
     */
    public function move(Request $request, Task $task): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('move', $task);

        $data = $request->validate([
            'status' => ['required', Rule::in(Task::STATUSES)],
            'before_id' => ['nullable', 'integer', Rule::exists('tasks', 'id')->whereNull('deleted_at')],
            'position' => ['nullable', 'integer', 'min:0'],
        ], [
            'status.required' => 'Pilih status tujuan.',
            'status.in' => 'Status tujuan tidak valid.',
        ]);

        DB::transaction(function () use ($task, $data, $user) {
            // Sudah divalidasi Rule::in(Task::STATUSES).
            $status = match ($data['status']) {
                'in_progress' => 'in_progress',
                'review' => 'review',
                'done' => 'done',
                default => 'todo',
            };
            $this->normalizeColumn($status, $task->id);

            $siblings = Task::query()->where('status', $status)->whereKeyNot($task->id);

            $anchor = null;
            if (! empty($data['before_id']) && (int) $data['before_id'] !== $task->id) {
                // Jangkar hanya tugas yang terlihat pengguna (staf: proyek yang ia ikuti).
                $anchor = (clone $siblings)->visibleTo($user)->whereKey((int) $data['before_id'])->first();
            } elseif (isset($data['position'])) {
                $anchor = (clone $siblings)->orderBy('position')->orderBy('id')->skip((int) $data['position'])->first();
            }

            if ($anchor instanceof Task) {
                $position = $anchor->position;
                (clone $siblings)->where('position', '>=', $position)->increment('position');
            } else {
                $position = ((int) (clone $siblings)->max('position')) + 1;
            }

            $task->status = $status;
            $task->position = $position;
            $task->save();
        });

        return back()->with('success', 'Tugas dipindah ke "'.Task::STATUS_LABELS[$task->status].'".');
    }

    /**
     * Mulai stopwatch untuk tugas ini (pengguna yang login). Tugas "To do"
     * yang boleh diubah pengguna otomatis pindah ke "Dikerjakan".
     */
    public function startTimer(Request $request, Task $task, StartWorkSession $starter): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('view', $task);

        try {
            $starter->forTask($user, $task);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        if ($task->status === 'todo' && $user->can('update', $task)) {
            $task->status = 'in_progress';
            $task->position = $this->nextPosition('in_progress');
            $task->save();
        }

        return back()->with('success', "Stopwatch dimulai untuk \"{$task->title}\".");
    }

    public function storeChecklistItem(Request $request, Task $task): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('update', $task);

        $data = $request->validate(['body' => ['required', 'string', 'max:255']], [
            'body.required' => 'Isi butir checklist wajib diisi.',
            'body.max' => 'Butir checklist maksimal 255 karakter.',
        ]);

        $task->checklistItems()->create([
            'body' => trim((string) $data['body']),
            'position' => ((int) $task->checklistItems()->max('position')) + 1,
        ]);

        return back()->with('success', 'Checklist ditambahkan.');
    }

    public function updateChecklistItem(Request $request, TaskChecklistItem $item): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('update', $item->task);

        $data = $request->validate([
            'body' => ['sometimes', 'required', 'string', 'max:255'],
            'is_done' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ], [
            'body.required' => 'Isi butir checklist wajib diisi.',
        ]);

        $item->update($data);

        return back();
    }

    public function destroyChecklistItem(Request $request, TaskChecklistItem $item): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('update', $item->task);

        $item->delete();

        return back()->with('success', 'Checklist dihapus.');
    }

    public function storeComment(Request $request, Task $task): RedirectResponse
    {
        $user = $this->user($request);
        Gate::forUser($user)->authorize('comment', $task);

        $data = $request->validate(['body' => ['required', 'string', 'max:5000']], [
            'body.required' => 'Komentar tidak boleh kosong.',
            'body.max' => 'Komentar maksimal 5000 karakter.',
        ]);

        $comment = $task->comments()->create([
            'user_id' => $user->id,
            'body' => trim((string) $data['body']),
        ]);

        // Ke penerima tugas & pembuat, kecuali penulis komentar; hanya pengguna aktif.
        User::query()
            ->whereIn('id', array_filter([$task->assignee_id, $task->created_by]))
            ->whereKeyNot($user->id)
            ->where('is_active', true)
            ->get()
            ->each(fn (User $u) => $u->notify(new TaskCommented($task, $comment, $user->name)));

        return back()->with('success', 'Komentar ditambahkan.');
    }

    public function destroyComment(Request $request, TaskComment $comment): RedirectResponse
    {
        $user = $this->user($request);
        $task = Task::withTrashed()->findOrFail($comment->task_id);
        Gate::forUser($user)->authorize('deleteComment', [$task, $comment]);

        $comment->delete();

        return back()->with('success', 'Komentar dihapus.');
    }

    // ---- Helpers ---------------------------------------------------------------

    /**
     * @return array{project_id: int|null, client_id: int|null, assignee_id: string|null, priority: string|null, status: string|null, due: string|null, q: string|null}
     */
    private function filters(Request $request): array
    {
        $assignee = $request->query('assignee_id');
        $assignee = is_string($assignee) && ($assignee === 'me' || $assignee === 'none' || ctype_digit($assignee)) ? $assignee : null;
        $priority = $request->query('priority');
        $status = $request->query('status');
        $due = $request->query('due');
        $q = trim((string) $request->query('q', ''));

        return [
            'project_id' => $request->integer('project_id') ?: null,
            'client_id' => $request->integer('client_id') ?: null,
            'assignee_id' => $assignee,
            'priority' => in_array($priority, Task::PRIORITIES, true) ? $priority : null,
            'status' => in_array($status, Task::STATUSES, true) ? $status : null,
            'due' => in_array($due, ['overdue', 'today', 'week'], true) ? $due : null,
            'q' => $q !== '' ? $q : null,
        ];
    }

    /**
     * @param  Builder<Task>  $query
     * @param  array{project_id: int|null, client_id: int|null, assignee_id: string|null, priority: string|null, status: string|null, due: string|null, q: string|null}  $filters
     * @return Builder<Task>
     */
    private function applyFilters(Builder $query, array $filters, User $user, bool $ignoreAssignee = false): Builder
    {
        $today = now()->toDateString();

        if ($filters['project_id']) {
            $project = Project::query()->find($filters['project_id']);
            $query->whereIn('project_id', $project ? $project->selfAndChildIds() : [0]);
        }
        if ($filters['client_id']) {
            $query->whereHas('project', fn ($p) => $p->where('client_id', $filters['client_id']));
        }
        if (! $ignoreAssignee && $filters['assignee_id'] !== null) {
            match ($filters['assignee_id']) {
                'me' => $query->where('assignee_id', $user->id),
                'none' => $query->whereNull('assignee_id'),
                default => $query->where('assignee_id', (int) $filters['assignee_id']),
            };
        }
        if ($filters['priority']) {
            $query->where('priority', $filters['priority']);
        }
        if ($filters['status']) {
            $query->where('status', $filters['status']);
        }
        if ($filters['due'] === 'overdue') {
            $query->open()->whereNotNull('due_date')->whereDate('due_date', '<', $today);
        } elseif ($filters['due'] === 'today') {
            $query->whereDate('due_date', $today);
        } elseif ($filters['due'] === 'week') {
            $query->whereDate('due_date', '>=', $today)->whereDate('due_date', '<=', now()->addDays(7)->toDateString());
        }
        if ($filters['q']) {
            $query->where('title', 'like', '%'.$filters['q'].'%');
        }

        return $query;
    }

    /**
     * Tugas saya: terbuka dikelompokkan per tenggat + selesai 7 hari terakhir.
     *
     * @param  Builder<Task>  $base
     * @param  array{project_id: int|null, client_id: int|null, assignee_id: string|null, priority: string|null, status: string|null, due: string|null, q: string|null}  $filters
     * @param  callable(Task): array<string, mixed>  $present
     * @return array<string, list<array<string, mixed>>>
     */
    private function mine(Builder $base, array $filters, User $user, callable $present): array
    {
        $query = $this->applyFilters($base, $filters, $user, ignoreAssignee: true)->where('assignee_id', $user->id);

        $open = (clone $query)->open()
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date')
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderBy('position')
            ->limit(self::BOARD_LIMIT)
            ->get();

        $doneRecent = (clone $query)->where('status', 'done')
            ->where('completed_at', '>=', now()->subDays(7))
            ->latest('completed_at')
            ->limit(50)
            ->get();

        $groups = ['overdue' => [], 'today' => [], 'week' => [], 'later' => [], 'no_date' => [], 'done_recent' => []];
        $today = now()->startOfDay();
        $weekEnd = $today->addDays(7);

        foreach ($open as $task) {
            $due = $task->due_date;
            $key = match (true) {
                $due === null => 'no_date',
                $due->lt($today) => 'overdue',
                $due->isSameDay($today) => 'today',
                $due->lte($weekEnd) => 'week',
                default => 'later',
            };
            $groups[$key][] = $present($task);
        }
        foreach ($doneRecent as $task) {
            $groups['done_recent'][] = $present($task);
        }

        return $groups;
    }

    /**
     * Papan kanban: semua tugas yang cocok (proyek tidak diarsipkan), per status.
     *
     * @param  Builder<Task>  $base
     * @param  array{project_id: int|null, client_id: int|null, assignee_id: string|null, priority: string|null, status: string|null, due: string|null, q: string|null}  $filters
     * @param  callable(Task): array<string, mixed>  $present
     * @return array<string, list<array<string, mixed>>>
     */
    private function board(Builder $base, array $filters, User $user, callable $present): array
    {
        $tasks = $this->applyFilters($base, $filters, $user)
            ->whereHas('project', fn ($p) => $p->where('status', '!=', 'archived'))
            ->when(! $filters['status'], fn ($q) => $q->where(fn ($w) => $w
                ->where('status', '!=', 'done')
                ->orWhere('completed_at', '>=', now()->subDays(self::BOARD_DONE_DAYS))))
            ->orderBy('position')
            ->orderBy('id')
            ->limit(self::BOARD_LIMIT)
            ->get();

        $columns = array_fill_keys(Task::STATUSES, []);
        foreach ($tasks as $task) {
            $columns[$task->status][] = $present($task);
        }

        return $columns;
    }

    /**
     * Proyek yang terlihat (tidak diarsipkan) + anggota proyek utamanya.
     *
     * @return list<array<string, mixed>>
     */
    private function projectOptions(User $user): array
    {
        $projects = Project::query()
            ->visibleTo($user)
            ->where('status', '!=', 'archived')
            ->with(['parent:id,name', 'client:id,name'])
            ->orderBy('name')
            ->get();

        $rootIds = $projects->map(fn (Project $p) => $p->parent_id ?? $p->id)->unique()->values()->all();
        $members = DB::table('project_members')->whereIn('project_id', $rootIds)->get(['project_id', 'user_id'])
            ->groupBy('project_id')
            ->map(fn ($rows) => $rows->pluck('user_id')->map(fn ($id) => (int) $id)->values()->all());

        return array_values($projects
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'parent_id' => $p->parent_id,
                'name' => $p->name,
                'full_name' => $p->full_name,
                'client' => ['id' => $p->client->id, 'name' => $p->client->name],
                'member_ids' => $members->get($p->parent_id ?? $p->id, []),
            ])
            ->sortBy(fn ($p) => $p['client']['name'].' '.$p['full_name'])
            ->values()
            ->all());
    }

    /**
     * Pengguna yang bisa dipilih sebagai penerima tugas / filter.
     * Admin: semua pengguna aktif. Staf: admin aktif + rekan di proyek yang ia ikuti.
     * Pengguna role owner/admin selalu boleh ditugaskan di proyek mana pun;
     * staf hanya di proyek yang `member_ids`-nya memuat id-nya.
     *
     * @return list<array{id: int, name: string, role: string}>
     */
    private function userOptions(User $user): array
    {
        $query = User::query()->where('is_active', true)->orderBy('name');

        if (Access::isRestricted($user)) {
            $roots = Access::memberRootIds($user);
            $query->where(fn ($q) => $q->whereIn('role', ['owner', 'admin'])
                ->orWhereKey($user->id)
                ->orWhereIn('id', DB::table('project_members')->whereIn('project_id', $roots)->select('user_id')));
        }

        return array_values($query->get(['id', 'name', 'role'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'role' => (string) $u->role])
            ->all());
    }

    /**
     * Hitungan untuk tab/lencana (semua tugas yang terlihat, tanpa filter).
     *
     * @return array<string, int>
     */
    private function counts(User $user): array
    {
        $byStatus = Task::query()->visibleTo($user)
            ->toBase()
            ->groupBy('status')
            ->selectRaw('status, COUNT(*) as c')
            ->pluck('c', 'status');

        $mine = Task::query()->visibleTo($user)->open()->where('assignee_id', $user->id);

        return [
            'todo' => (int) ($byStatus['todo'] ?? 0),
            'in_progress' => (int) ($byStatus['in_progress'] ?? 0),
            'review' => (int) ($byStatus['review'] ?? 0),
            'done' => (int) ($byStatus['done'] ?? 0),
            'mine_open' => (clone $mine)->count(),
            'mine_overdue' => (clone $mine)->whereNotNull('due_date')->whereDate('due_date', '<', now()->toDateString())->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data, bool $partial = false): array
    {
        $fields = ['project_id', 'title', 'description', 'status', 'priority', 'assignee_id', 'start_date', 'due_date', 'estimate_minutes', 'billable', 'fixed_price'];
        $out = [];

        foreach ($fields as $field) {
            if ($partial && ! array_key_exists($field, $data)) {
                continue;
            }
            $value = $data[$field] ?? null;
            $out[$field] = match ($field) {
                'title' => trim((string) $value),
                'priority' => $value ?? 'normal',
                'status' => $value ?? 'todo',
                'billable' => array_key_exists('billable', $data) ? (bool) $value : true,
                'fixed_price' => $value === null || $value === '' ? null : $value,
                default => $value,
            };
        }

        return $out;
    }

    private function nextPosition(string $status): int
    {
        return ((int) Task::query()->where('status', $status)->max('position')) + 1;
    }

    /** Rapikan urutan kolom bila ada posisi kembar (mis. data lama) supaya sisipan tepat. */
    private function normalizeColumn(string $status, int $exceptId): void
    {
        $duplicates = Task::query()->where('status', $status)->whereKeyNot($exceptId)
            ->toBase()
            ->groupBy('position')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if (! $duplicates) {
            return;
        }

        $ids = Task::query()->where('status', $status)->whereKeyNot($exceptId)
            ->orderBy('position')->orderBy('id')->pluck('id');

        foreach ($ids as $i => $id) {
            Task::query()->whereKey($id)->update(['position' => $i + 1]);
        }
    }

    private function notifyAssigned(Task $task, User $actor): void
    {
        if ($task->assignee_id === null || $task->assignee_id === $actor->id) {
            return;
        }

        $assignee = User::query()->find($task->assignee_id);
        if ($assignee instanceof User && $assignee->is_active) {
            $assignee->notify(new TaskAssigned($task, $actor->name));
        }
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
