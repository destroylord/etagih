<?php

namespace App\Http\Controllers;

use App\Actions\Invoice\WorkSessionAction;
use App\Models\Client;
use App\Models\Project;
use App\Models\WorkSession;
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
        $query = WorkSession::with(['client', 'project.parent', 'user:id,name'])
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
        $active = WorkSession::with(['client', 'project.parent', 'user:id,name'])
            ->where('user_id', $request->user()?->id)
            ->whereIn('status', ['running', 'paused'])
            ->latest('started_at')
            ->first();

        return Inertia::render('time-tracker', [
            'sessions' => $sessions,
            'active' => $active,
            'clients' => Client::orderBy('name')->get(['id', 'name', 'hourly_rate']),
            'projects' => self::projectOptions(),
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
    public function start(Request $request, WorkSessionAction $action): JsonResponse|RedirectResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            // Proyek / sub-proyek opsional, harus milik klien yang dipilih.
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->where('client_id', $request->integer('client_id'))],
            'description' => ['required', 'string', 'max:255'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $session = $action->start(
                userId: (int) $request->user()?->id,
                clientId: $data['client_id'],
                projectId: isset($data['project_id']) ? (int) $data['project_id'] : null,
                description: $data['description'],
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
     * Proyek aktif untuk pilihan di form (klien, induk, tarif).
     *
     * @return list<array{id: int, client_id: int, client_name: string, parent_id: int|null, name: string, full_name: string, hourly_rate: string|null, status: string}>
     */
    public static function projectOptions(bool $includeInactive = false): array
    {
        return array_values(Project::query()
            ->with(['parent:id,name', 'client:id,name'])
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
