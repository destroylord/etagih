<?php

namespace App\Http\Controllers;

use App\Actions\Invoice\WorkSessionAction;
use App\Actions\WorkSession\StartWorkSession;
use App\Models\Client;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\Access;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WorkSessionController extends Controller
{
    public function index(Request $request, WorkSessionAction $action): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        // Staf: sesi miliknya + sesi di proyek yang ia ikuti.
        $query = WorkSession::with(['client', 'project.parent', 'user:id,name', 'task:id,title'])
            ->visibleTo($user)
            ->latest('started_at');

        if ($request->filled('project_id')) {
            $project = Project::find($request->integer('project_id'));
            $query->whereIn('project_id', $project ? $project->selfAndChildIds() : [0]);
        }
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('date_from')) {
            $query->where('started_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('started_at', '<=', $request->date('date_to')->endOfDay());
        }

        // Total sesuai filter (bukan cuma halaman ini).
        $totals = (clone $query)->reorder()->toBase()
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0) as unbilled_seconds")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds * unit_price ELSE 0 END), 0) / 3600 as unbilled_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as unbilled_count")
            ->selectRaw("COALESCE(SUM(CASE WHEN status IN ('completed', 'billed') THEN duration_seconds ELSE 0 END), 0) as tracked_seconds")
            ->first();

        $sessions = $query->paginate(20)->withQueryString();

        // Active = running ATAU paused milik pengguna yang login (tracker per pengguna).
        $active = WorkSession::with(['client', 'project.parent', 'user:id,name', 'task:id,title'])
            ->where('user_id', $user->id)
            ->whereIn('status', ['running', 'paused'])
            ->latest('started_at')
            ->first();

        return Inertia::render('time-tracker', [
            'sessions' => $sessions,
            'active' => $active,
            'clients' => Client::visibleTo($user)->orderBy('name')->get(['id', 'name', 'hourly_rate']),
            'projects' => self::projectOptions(false, $user),
            // Tugas terbuka yang terlihat (milik saya lebih dulu) untuk pilihan "Kerjakan tugas".
            'tasks' => self::taskOptions($user),
            'filters' => $request->only(['client_id', 'project_id', 'status', 'date_from', 'date_to']),
            'defaultRate' => (float) Settings::current()->default_hourly_rate,
            'totals' => [
                'unbilledSeconds' => (int) ($totals->unbilled_seconds ?? 0),
                'unbilledAmount' => round((float) ($totals->unbilled_amount ?? 0), 2),
                'unbilledCount' => (int) ($totals->unbilled_count ?? 0),
                'trackedSeconds' => (int) ($totals->tracked_seconds ?? 0),
            ],
        ]);
    }

    /**
     * Semua mutasi return JSON kalau diminta fetch (offline sync), redirect
     * kalau form biasa. Sama polanya dgn PaymentController::pay.
     */
    public function start(Request $request, WorkSessionAction $action, StartWorkSession $starter): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $data = $request->validate([
            // Dengan task_id: klien & proyek diambil dari proyek tugas.
            'task_id' => ['nullable', 'integer', Rule::exists('tasks', 'id')->whereNull('deleted_at')],
            'client_id' => ['required_without:task_id', 'nullable', 'integer', 'exists:clients,id'],
            // Proyek / sub-proyek opsional, harus milik klien yang dipilih.
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->where('client_id', $request->integer('client_id'))],
            'description' => ['required_without:task_id', 'nullable', 'string', 'max:255'],
            'unit_price' => ['required_without:task_id', 'nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $task = isset($data['task_id']) ? Task::query()->find((int) $data['task_id']) : null;

        // Staf hanya boleh mencatat waktu di klien / proyek / tugas yang terlihat.
        if ($task) {
            if ($user->cannot('view', $task)) {
                return $this->fail($request, 'Anda tidak punya akses ke tugas ini.', 403);
            }
        } elseif (! Access::canSeeClient($user, (int) $data['client_id'])
            || (isset($data['project_id']) && ! Access::canSeeProject($user, (int) $data['project_id']))) {
            return $this->fail($request, 'Anda tidak punya akses ke klien / proyek ini.', 403);
        }

        try {
            $session = $task
                ? $starter->forTask(
                    user: $user,
                    task: $task,
                    description: $data['description'] ?? null,
                    unitPrice: isset($data['unit_price']) ? (float) $data['unit_price'] : null,
                    notes: $data['notes'] ?? null,
                )
                : $action->start(
                    userId: $user->id,
                    clientId: (int) $data['client_id'],
                    projectId: isset($data['project_id']) ? (int) $data['project_id'] : null,
                    description: (string) $data['description'],
                    unitPrice: (float) $data['unit_price'],
                    notes: $data['notes'] ?? null,
                );
        } catch (\RuntimeException $e) {
            return $this->fail($request, $e->getMessage(), 409);
        }

        if ($request->expectsJson()) {
            return response()->json(['ok' => true, 'session' => ['id' => $session->id]]);
        }

        return redirect()->route('time-tracker.index')->with('success', 'Stopwatch dimulai.');
    }

    public function pause(Request $request, WorkSession $session, WorkSessionAction $action): JsonResponse|RedirectResponse
    {
        if ($denied = $this->denyIfNotOwner($request, $session)) {
            return $denied;
        }

        try {
            $action->pause($session);
        } catch (\RuntimeException $e) {
            return $this->fail($request, $e->getMessage(), 422);
        }

        if ($request->expectsJson()) {
            return response()->json(['ok' => true]);
        }

        return redirect()->route('time-tracker.index')->with('success', 'Session di-pause.');
    }

    public function resume(Request $request, WorkSession $session, WorkSessionAction $action): JsonResponse|RedirectResponse
    {
        if ($denied = $this->denyIfNotOwner($request, $session)) {
            return $denied;
        }

        try {
            $action->resume($session);
        } catch (\RuntimeException $e) {
            return $this->fail($request, $e->getMessage(), 422);
        }

        if ($request->expectsJson()) {
            return response()->json(['ok' => true]);
        }

        return redirect()->route('time-tracker.index')->with('success', 'Session dilanjutkan.');
    }

    public function stop(Request $request, WorkSession $session, WorkSessionAction $action): JsonResponse|RedirectResponse
    {
        if ($denied = $this->denyIfNotOwner($request, $session)) {
            return $denied;
        }

        try {
            $action->stop($session);
        } catch (\RuntimeException $e) {
            return $this->fail($request, $e->getMessage(), 422);
        }

        if ($request->expectsJson()) {
            return response()->json(['ok' => true]);
        }

        return redirect()->route('time-tracker.index')->with('success', 'Session selesai.');
    }

    public function destroy(Request $request, WorkSession $session, WorkSessionAction $action): JsonResponse|RedirectResponse
    {
        if ($denied = $this->denyIfNotOwner($request, $session)) {
            return $denied;
        }

        try {
            $action->cancel($session);
        } catch (\RuntimeException $e) {
            return $this->fail($request, $e->getMessage(), 422);
        }

        if ($request->expectsJson()) {
            return response()->json(['ok' => true]);
        }

        return redirect()->route('time-tracker.index')->with('success', 'Session di-cancel.');
    }

    /**
     * Sesi hanya boleh dijeda/dilanjutkan/dihentikan/dibatalkan oleh pencatatnya
     * atau admin. Sesi lama tanpa user_id boleh diubah siapa saja.
     */
    private function denyIfNotOwner(Request $request, WorkSession $session): JsonResponse|RedirectResponse|null
    {
        $user = $request->user();

        if ($session->user_id === null || $user === null || $session->user_id === $user->id || $user->isAdmin()) {
            return null;
        }

        return $this->fail($request, 'Sesi ini milik pengguna lain.', 403);
    }

    private function fail(Request $request, string $message, int $status): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['error' => $message], $status);
        }

        return back()->withErrors(['session' => $message]);
    }

    /**
     * Tugas terbuka yang terlihat pengguna, tugas miliknya lebih dulu (maks. 200).
     *
     * @return list<array{id: int, title: string, status: string, project_id: int, client_id: int, project_name: string, assignee_id: int|null, due_date: string|null}>
     */
    public static function taskOptions(User $user): array
    {
        return array_values(Task::query()
            ->visibleTo($user)
            ->open()
            ->with(['project.parent:id,name'])
            ->orderByRaw('CASE WHEN assignee_id = ? THEN 0 ELSE 1 END', [$user->id])
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (Task $t) => [
                'id' => $t->id,
                'title' => $t->title,
                'status' => $t->status,
                'project_id' => $t->project_id,
                'client_id' => $t->project->client_id,
                'project_name' => $t->project->full_name,
                'assignee_id' => $t->assignee_id,
                'due_date' => $t->due_date?->toDateString(),
            ])
            ->all());
    }

    /**
     * Proyek aktif untuk pilihan di form (klien, induk, tarif). Dengan `$user`,
     * hanya proyek yang terlihat oleh pengguna itu (staf: proyek yang diikuti).
     *
     * @return list<array{id: int, client_id: int, client_name: string, parent_id: int|null, name: string, full_name: string, hourly_rate: string|null, status: string}>
     */
    public static function projectOptions(bool $includeInactive = false, ?User $user = null): array
    {
        return array_values(Project::query()
            ->with(['parent:id,name', 'client:id,name'])
            ->when($user !== null, fn ($q) => $q->visibleTo($user))
            ->when(! $includeInactive, fn ($q) => $q->where('status', '!=', 'archived'))
            ->orderBy('name')
            ->get()
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'client_id' => $p->client_id,
                'client_name' => $p->client->name,
                'parent_id' => $p->parent_id,
                'name' => $p->name,
                'full_name' => $p->full_name,
                'hourly_rate' => $p->hourly_rate !== null ? (string) $p->hourly_rate : null,
                'status' => $p->status,
            ])
            ->all());
    }
}
