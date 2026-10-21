<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\Access;
use App\Support\ProjectStats;
use App\Support\TaskPayload;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Proyek & sub-proyek per klien (Klien → Proyek → Sub-proyek).
 */
class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['q', 'client_id', 'status']);
        $q = trim((string) ($filters['q'] ?? ''));

        $user = $this->user($request);

        $projects = Project::query()
            ->topLevel()
            ->visibleTo($user)
            ->with(['client:id,name', 'children'])
            ->withCount('members')
            ->when($request->filled('client_id'), fn ($w) => $w->where('client_id', $request->integer('client_id')))
            ->when($request->filled('status'), fn ($w) => $w->where('status', $request->string('status')))
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x
                ->where('name', 'like', "%{$q}%")
                ->orWhereHas('children', fn ($c) => $c->where('name', 'like', "%{$q}%"))
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$q}%"))))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        $tree = [];
        foreach (ProjectStats::tree($projects->getCollection()) as $node) {
            $tree[(int) $node['id']] = $node;
        }
        $clients = $projects->getCollection()->mapWithKeys(fn (Project $p) => [$p->id => $p->client->only(['id', 'name'])])->all();
        $memberCounts = $projects->getCollection()->mapWithKeys(fn (Project $p) => [$p->id => (int) $p->getAttribute('members_count')])->all();
        $rows = [];
        foreach ($tree as $id => $node) {
            $rows[] = [...$node, 'client' => $clients[$id] ?? null, 'members_count' => $memberCounts[$id] ?? 0];
        }

        return Inertia::render('projects/index', [
            // Paginator dengan data pohon proyek + statistik.
            'projects' => [...$projects->toArray(), 'data' => $rows],
            'clients' => Client::visibleTo($user)->orderBy('name')->get(['id', 'name']),
            'filters' => $filters,
        ]);
    }

    public function show(Request $request, Project $project): Response
    {
        $user = $this->user($request);
        $project->load(['client:id,name', 'parent:id,name,client_id', 'children']);
        $root = $project->parent ?? $project;
        $root->loadMissing('children');

        $ids = $project->selfAndChildIds();

        // Invoice proyek ini (dan sub-proyeknya), plus invoice proyek induk
        // yang punya item untuk sub-proyek ini.
        $invoices = Invoice::query()
            ->with(['project.parent'])
            ->where(fn ($q) => $q->whereIn('project_id', $ids)
                ->orWhereHas('items', fn ($i) => $i->whereIn('project_id', $ids)))
            ->latest('issue_date')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        $sessions = WorkSession::query()
            ->with('project.parent')
            ->whereIn('project_id', $ids)
            ->latest('started_at')
            ->limit(10)
            ->get();

        $tree = ProjectStats::tree($root->newCollection([$root]))[0];

        return Inertia::render('projects/show', [
            'project' => [
                ...$project->only(['id', 'client_id', 'parent_id', 'name', 'description', 'status', 'hourly_rate', 'full_name']),
                'client' => $project->client->only(['id', 'name']),
                'parent' => $project->parent?->only(['id', 'name']),
            ],
            // Pohon proyek utama lengkap (untuk navigasi antar sub-proyek).
            'tree' => $tree,
            'stats' => $this->statsOf($tree, $project->id),
            'invoices' => $invoices,
            'sessions' => $sessions,
            // Anggota tim proyek utama (sub-proyek mewarisi).
            'members' => $this->memberPayload($root),
            // Pilihan anggota: admin → semua pengguna aktif; staf → anggota proyek utama.
            'assignableUsers' => $user->isAdmin()
                ? User::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'email', 'role'])
                    ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => (string) $u->role])
                    ->values()
                : $this->memberPayload($root),
            'canManageMembers' => $user->isAdmin(),
            'taskSummary' => TaskPayload::summary($ids),
        ]);
    }

    /**
     * Sinkronkan anggota tim proyek (admin). Disimpan di proyek utama; bila
     * yang dikirim sub-proyek, keanggotaan dicatat di induknya. Hanya
     * pengguna aktif yang disimpan.
     */
    public function syncMembers(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', Rule::exists('users', 'id')->where('is_active', true)],
        ], [
            'user_ids.*.exists' => 'Anggota harus pengguna aktif.',
        ]);

        $root = $project->parent_id ? Project::query()->findOrFail($project->parent_id) : $project;
        $root->members()->sync(array_values(array_unique(array_map('intval', $data['user_ids']))));

        return back()->with('success', "Anggota proyek \"{$root->name}\" diperbarui.");
    }

    /**
     * @return list<array{id: int, name: string, email: string, role: string}>
     */
    private function memberPayload(Project $root): array
    {
        return array_values($root->members()
            ->orderBy('name')
            ->get(['users.id', 'users.name', 'users.email', 'users.role'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => (string) $u->role])
            ->all());
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->user($request);

        // Staf hanya boleh membuat sub-proyek di proyek yang ia ikuti.
        if (Access::isRestricted($user)) {
            $parentId = (int) $request->input('parent_id');
            abort_unless($parentId > 0, 403, 'Hanya admin yang bisa membuat proyek utama.');
            abort_unless(Access::canSeeProject($user, $parentId), 403, 'Anda bukan anggota proyek ini.');
        }

        $data = $this->validated($request);
        $project = Project::create($data);

        return back()->with('success', $project->isSubProject()
            ? "Sub-proyek \"{$project->name}\" ditambahkan."
            : "Proyek \"{$project->name}\" ditambahkan.");
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        $user = $this->user($request);

        // Staf hanya boleh mengubah sub-proyek, dan tetap di bawah proyek yang ia ikuti.
        if (Access::isRestricted($user)) {
            abort_unless($project->parent_id !== null, 403, 'Hanya admin yang bisa mengubah proyek utama.');
            $parentId = (int) ($request->input('parent_id') ?: 0);
            abort_unless($parentId > 0 && Access::canSeeProject($user, $parentId), 403, 'Sub-proyek harus tetap di proyek yang Anda ikuti.');
        }

        $data = $this->validated($request, $project);
        $project->update($data);

        return back()->with('success', 'Proyek diperbarui.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        if ($project->isInUse()) {
            return back()->with('error', 'Proyek sudah dipakai invoice / Time Tracker / tugas. Ubah statusnya menjadi "Diarsipkan" saja.');
        }

        $redirect = $project->parent_id
            ? redirect()->route('projects.show', $project->parent_id)
            : redirect()->route('projects.index');

        $project->delete();

        return $redirect->with('success', 'Proyek dihapus.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Project $project = null): array
    {
        $clientId = $project !== null ? $project->client_id : $request->integer('client_id');
        $parentId = $request->input('parent_id') ?: null;

        $validator = validator($request->all(), [
            'client_id' => [$project ? 'nullable' : 'required', 'integer', 'exists:clients,id'],
            'parent_id' => [
                'nullable', 'integer',
                // Induk harus proyek utama milik klien yang sama (maks. 2 level).
                Rule::exists('projects', 'id')->where('client_id', $clientId)->whereNull('parent_id'),
            ],
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('projects', 'name')
                    ->where('client_id', $clientId)
                    ->where(fn ($q) => $parentId ? $q->where('parent_id', $parentId) : $q->whereNull('parent_id'))
                    ->ignore($project?->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(Project::STATUSES)],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
        ], [
            'name.unique' => 'Nama ini sudah dipakai di level yang sama.',
            'parent_id.exists' => 'Induk harus proyek utama milik klien yang sama.',
        ], [
            'name' => 'nama proyek',
            'parent_id' => 'proyek induk',
        ]);

        $validator->after(function (Validator $v) use ($project, $parentId) {
            if (! $project) {
                return;
            }
            if ($parentId && (int) $parentId === $project->id) {
                $v->errors()->add('parent_id', 'Proyek tidak bisa menjadi induk dirinya sendiri.');
            }
            if ($parentId && $project->children()->exists()) {
                $v->errors()->add('parent_id', 'Proyek yang punya sub-proyek tidak bisa dijadikan sub-proyek.');
            }
        });

        $data = $validator->validate();

        return [
            'client_id' => $clientId,
            'parent_id' => $parentId ? (int) $parentId : null,
            'name' => trim((string) $data['name']),
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? ($project->status ?? 'active'),
            'hourly_rate' => isset($data['hourly_rate']) && $data['hourly_rate'] !== '' ? $data['hourly_rate'] : null,
        ];
    }

    /**
     * Statistik satu node (proyek utama / sub-proyek) dari pohon.
     *
     * @param  array<string, mixed>  $tree
     * @return array<string, int|float>
     */
    private function statsOf(array $tree, int $projectId): array
    {
        if ((int) $tree['id'] === $projectId) {
            return $tree['stats'];
        }

        foreach ((array) $tree['children'] as $child) {
            if ((int) $child['id'] === $projectId) {
                return $child['stats'];
            }
        }

        return ProjectStats::EMPTY;
    }
}
