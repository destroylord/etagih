<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\WorkSession;
use App\Support\ProjectStats;
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

        $projects = Project::query()
            ->topLevel()
            ->with(['client:id,name', 'children'])
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
        $rows = [];
        foreach ($tree as $id => $node) {
            $rows[] = [...$node, 'client' => $clients[$id] ?? null];
        }

        return Inertia::render('projects/index', [
            // Paginator dengan data pohon proyek + statistik.
            'projects' => [...$projects->toArray(), 'data' => $rows],
            'clients' => Client::orderBy('name')->get(['id', 'name']),
            'filters' => $filters,
        ]);
    }

    public function show(Project $project): Response
    {
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
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $project = Project::create($data);

        return back()->with('success', $project->isSubProject()
            ? "Sub-proyek \"{$project->name}\" ditambahkan."
            : "Proyek \"{$project->name}\" ditambahkan.");
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        $data = $this->validated($request, $project);
        $project->update($data);

        return back()->with('success', 'Proyek diperbarui.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        if ($project->isInUse()) {
            return back()->with('error', 'Proyek sudah dipakai invoice / Time Tracker. Ubah statusnya menjadi "Diarsipkan" saja.');
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
