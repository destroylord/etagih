<?php

use App\Models\Client;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    Queue::fake();
    Notification::fake();
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 100000]);

    $this->admin = User::factory()->create(['name' => 'Admin']);
    $this->staff = User::factory()->state(['role' => 'staff'])->create(['name' => 'Staf']);
    $this->outsider = User::factory()->state(['role' => 'staff'])->create(['name' => 'Luar']);

    $this->client = Client::create(['name' => 'Klien']);
    $this->project = Project::create(['client_id' => $this->client->id, 'name' => 'Toko Online']);
    $this->sub = Project::create(['client_id' => $this->client->id, 'parent_id' => $this->project->id, 'name' => 'Aplikasi']);
    $this->project->members()->attach($this->staff);

    $this->otherProject = Project::create(['client_id' => Client::create(['name' => 'Lain'])->id, 'name' => 'Lain']);
    $this->otherProject->members()->attach($this->outsider);
});

function makeTask(array $attributes = []): Task
{
    return Task::factory()->create($attributes);
}

it('creates a task with defaults and the creator', function () {
    $this->actingAs($this->staff)->post(route('tasks.store'), [
        'project_id' => $this->sub->id,
        'title' => 'Desain halaman login',
        'priority' => 'high',
        'due_date' => now()->addDays(3)->toDateString(),
        'estimate_minutes' => 120,
        'fixed_price' => 500000,
    ])->assertSessionHasNoErrors()->assertSessionHas('success');

    $task = Task::sole();
    expect($task->status)->toBe('todo')
        ->and($task->priority)->toBe('high')
        ->and($task->created_by)->toBe($this->staff->id)
        ->and($task->billable)->toBeTrue()
        ->and((float) $task->fixed_price)->toBe(500000.0)
        ->and($task->position)->toBe(1);
});

it('validates task input in Indonesian', function () {
    $this->actingAs($this->admin)->post(route('tasks.store'), [
        'project_id' => $this->project->id,
        'title' => '',
        'start_date' => '2026-10-10',
        'due_date' => '2026-10-01',
        'priority' => 'super',
    ])->assertSessionHasErrors([
        'title' => 'Judul tugas wajib diisi.',
        'due_date' => 'Tenggat tidak boleh sebelum tanggal mulai.',
        'priority' => 'Prioritas tidak valid.',
    ]);

    expect(Task::count())->toBe(0);
});

it('rejects tasks in invisible projects and assignees without access', function () {
    $this->actingAs($this->staff)->post(route('tasks.store'), [
        'project_id' => $this->otherProject->id, 'title' => 'X',
    ])->assertSessionHasErrors('project_id');

    $this->actingAs($this->staff)->post(route('tasks.store'), [
        'project_id' => $this->project->id, 'title' => 'X', 'assignee_id' => $this->outsider->id,
    ])->assertSessionHasErrors('assignee_id');

    $inactive = User::factory()->create(['is_active' => false]);
    $this->actingAs($this->admin)->post(route('tasks.store'), [
        'project_id' => $this->project->id, 'title' => 'X', 'assignee_id' => $inactive->id,
    ])->assertSessionHasErrors('assignee_id');

    // Admin selalu boleh ditugaskan; anggota proyek juga.
    $this->actingAs($this->staff)->post(route('tasks.store'), [
        'project_id' => $this->sub->id, 'title' => 'Untuk admin', 'assignee_id' => $this->admin->id,
    ])->assertSessionHasNoErrors();
    $this->actingAs($this->admin)->post(route('tasks.store'), [
        'project_id' => $this->sub->id, 'title' => 'Untuk staf', 'assignee_id' => $this->staff->id,
    ])->assertSessionHasNoErrors();

    expect(Task::count())->toBe(2);
});

it('updates a task partially and enforces the update policy', function () {
    $task = makeTask(['project_id' => $this->project->id, 'created_by' => $this->admin->id, 'title' => 'Awal']);
    $peer = User::factory()->state(['role' => 'staff'])->create();
    $this->project->members()->attach($peer);

    // Anggota proyek yang bukan assignee / pembuat tidak boleh mengubah.
    $this->actingAs($peer)->put(route('tasks.update', $task), ['priority' => 'urgent'])->assertForbidden();
    // Di luar proyek → 404.
    $this->actingAs($this->outsider)->put(route('tasks.update', $task), ['priority' => 'urgent'])->assertNotFound();

    $task->update(['assignee_id' => $this->staff->id]);
    $this->actingAs($this->staff)->put(route('tasks.update', $task), ['priority' => 'urgent'])->assertSessionHasNoErrors();

    expect($task->fresh())->priority->toBe('urgent')->title->toBe('Awal');
});

it('sets completed_at when done and clears it when reopened', function () {
    $task = makeTask(['project_id' => $this->project->id, 'created_by' => $this->admin->id]);
    $this->actingAs($this->admin);

    $this->put(route('tasks.update', $task), ['status' => 'done'])->assertSessionHasNoErrors();
    expect($task->fresh()->completed_at)->not->toBeNull();

    $this->patch(route('tasks.move', $task), ['status' => 'in_progress'])->assertSessionHasNoErrors();
    expect($task->fresh())->status->toBe('in_progress')->completed_at->toBeNull();
});

it('moves tasks between columns and reorders siblings', function () {
    $a = makeTask(['project_id' => $this->project->id, 'status' => 'todo', 'position' => 1, 'title' => 'A']);
    $b = makeTask(['project_id' => $this->project->id, 'status' => 'todo', 'position' => 2, 'title' => 'B']);
    $c = makeTask(['project_id' => $this->project->id, 'status' => 'review', 'position' => 1, 'title' => 'C']);
    $this->actingAs($this->admin);

    // C ke "todo", sebelum B → A, C, B
    $this->patch(route('tasks.move', $c), ['status' => 'todo', 'before_id' => $b->id])->assertSessionHasNoErrors();
    $order = fn (string $status) => Task::where('status', $status)->orderBy('position')->orderBy('id')->pluck('title')->all();
    expect($order('todo'))->toBe(['A', 'C', 'B']);

    // B ke posisi 0 → B, A, C
    $this->patch(route('tasks.move', $b), ['status' => 'todo', 'position' => 0])->assertSessionHasNoErrors();
    expect($order('todo'))->toBe(['B', 'A', 'C']);

    // A ke akhir kolom "done"
    $this->patch(route('tasks.move', $a), ['status' => 'done'])->assertSessionHasNoErrors();
    expect($order('todo'))->toBe(['B', 'C'])
        ->and($order('done'))->toBe(['A'])
        ->and($a->fresh()->completed_at)->not->toBeNull();

    $this->patch(route('tasks.move', $a), ['status' => 'nope'])->assertSessionHasErrors('status');
});

it('lets assignees move their tasks but not other members', function () {
    $task = makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id]);
    $peer = User::factory()->state(['role' => 'staff'])->create();
    $this->project->members()->attach($peer);

    $this->actingAs($peer)->patch(route('tasks.move', $task), ['status' => 'review'])->assertForbidden();
    $this->actingAs($this->staff)->patch(route('tasks.move', $task), ['status' => 'review'])->assertSessionHasNoErrors();

    expect($task->fresh()->status)->toBe('review');
});

it('manages checklist items', function () {
    $task = makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id]);
    $this->actingAs($this->staff);

    $this->post(route('tasks.checklist.store', $task), ['body' => 'Wireframe'])->assertSessionHasNoErrors();
    $this->post(route('tasks.checklist.store', $task), ['body' => 'Mockup'])->assertSessionHasNoErrors();
    $this->post(route('tasks.checklist.store', $task), ['body' => ''])->assertSessionHasErrors('body');

    $item = $task->checklistItems()->first();
    $this->put(route('tasks.checklist.update', $item), ['is_done' => true])->assertSessionHasNoErrors();
    expect($item->fresh()->is_done)->toBeTrue();

    $this->getJson(route('tasks.show', $task))
        ->assertOk()
        ->assertJsonPath('task.checklist_total', 2)
        ->assertJsonPath('task.checklist_done', 1)
        ->assertJsonPath('task.checklist.0.body', 'Wireframe');

    $this->delete(route('tasks.checklist.destroy', $item))->assertSessionHas('success');
    expect($task->checklistItems()->count())->toBe(1);

    // Pengguna di luar proyek tidak bisa menyentuh checklist.
    $other = $task->checklistItems()->first();
    $this->actingAs($this->outsider)->put(route('tasks.checklist.update', $other), ['is_done' => true])->assertNotFound();
});

it('adds and deletes comments with author permissions', function () {
    $task = makeTask(['project_id' => $this->project->id, 'created_by' => $this->admin->id]);

    $this->actingAs($this->staff)->post(route('tasks.comments.store', $task), ['body' => 'Sudah mulai'])->assertSessionHasNoErrors();
    $comment = TaskComment::sole();
    expect($comment->user_id)->toBe($this->staff->id);

    $peer = User::factory()->state(['role' => 'staff'])->create();
    $this->project->members()->attach($peer);
    $this->actingAs($peer)->delete(route('tasks.comments.destroy', $comment))->assertForbidden();

    $this->actingAs($this->staff)->getJson(route('tasks.show', $task))
        ->assertJsonPath('task.comments.0.can_delete', true)
        ->assertJsonPath('task.comments.0.user.name', 'Staf');

    $this->actingAs($this->admin)->delete(route('tasks.comments.destroy', $comment))->assertSessionHas('success');
    expect(TaskComment::count())->toBe(0);
});

it('soft deletes tasks for creator or admin only and never billed tasks', function () {
    $task = makeTask(['project_id' => $this->project->id, 'created_by' => $this->staff->id]);
    $peer = User::factory()->state(['role' => 'staff'])->create();
    $this->project->members()->attach($peer);

    $this->actingAs($peer)->delete(route('tasks.destroy', $task))->assertForbidden();
    $this->actingAs($this->staff)->delete(route('tasks.destroy', $task))->assertSessionHas('success');

    expect(Task::find($task->id))->toBeNull()
        ->and(Task::withTrashed()->find($task->id))->not->toBeNull();

    $billed = makeTask(['project_id' => $this->project->id, 'created_by' => $this->admin->id]);
    $invoiceId = DB::table('invoices')->insertGetId([
        'client_id' => $this->client->id, 'invoice_number' => 'INV-X', 'issue_date' => now()->toDateString(),
        'invoice_mode' => 'fixed', 'type' => 'full', 'status' => 'draft', 'public_token' => 'tok-x',
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $billed->update(['invoice_id' => $invoiceId]);

    $this->actingAs($this->admin)->delete(route('tasks.destroy', $billed))->assertSessionHas('error');
    expect(Task::find($billed->id))->not->toBeNull();
});

it('returns task detail json only for visible tasks', function () {
    $task = makeTask(['project_id' => $this->sub->id, 'description' => 'Rinci', 'created_by' => $this->admin->id]);

    $this->actingAs($this->staff)->getJson(route('tasks.show', $task))
        ->assertOk()
        ->assertJsonPath('task.id', $task->id)
        ->assertJsonPath('task.description', 'Rinci')
        ->assertJsonPath('task.project.full_name', 'Toko Online › Aplikasi')
        ->assertJsonPath('task.project.client.name', 'Klien')
        ->assertJsonPath('task.can.update', false)
        ->assertJsonStructure(['task' => ['checklist', 'comments', 'sessions', 'activity', 'assignable_users']]);

    $this->actingAs($this->outsider)->getJson(route('tasks.show', $task))->assertNotFound();
});

it('renders the my tasks view grouped by due date', function () {
    $this->travelTo(now()->setTime(10, 0));
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'title' => 'Telat', 'due_date' => now()->subDay()->toDateString()]);
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'title' => 'Hari ini', 'due_date' => now()->toDateString()]);
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'title' => 'Minggu ini', 'due_date' => now()->addDays(3)->toDateString()]);
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'title' => 'Nanti', 'due_date' => now()->addDays(30)->toDateString()]);
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'title' => 'Tanpa tanggal']);
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'title' => 'Beres', 'status' => 'done']);
    makeTask(['project_id' => $this->project->id, 'assignee_id' => $this->admin->id, 'title' => 'Bukan saya']);

    $this->actingAs($this->staff)->get(route('tasks.index'))->assertInertia(fn (Assert $page) => $page
        ->component('tasks/index')
        ->where('view', 'mine')
        ->where('tasks.overdue.0.title', 'Telat')
        ->where('tasks.overdue.0.is_overdue', true)
        ->where('tasks.today.0.title', 'Hari ini')
        ->where('tasks.week.0.title', 'Minggu ini')
        ->where('tasks.later.0.title', 'Nanti')
        ->where('tasks.no_date.0.title', 'Tanpa tanggal')
        ->where('tasks.done_recent.0.title', 'Beres')
        ->where('counts.mine_open', 5)
        ->where('counts.mine_overdue', 1)
        ->has('projects', 2)
        ->where('statusLabels.in_progress', 'Dikerjakan')
        ->where('priorityLabels.urgent', 'Mendesak'));
});

it('renders the board and list views with filters and scoping', function () {
    makeTask(['project_id' => $this->project->id, 'title' => 'Todo 1', 'priority' => 'high']);
    makeTask(['project_id' => $this->sub->id, 'title' => 'Review 1', 'status' => 'review']);
    makeTask(['project_id' => $this->otherProject->id, 'title' => 'Rahasia']);

    $this->actingAs($this->staff)->get(route('tasks.index', ['view' => 'board']))->assertInertia(fn (Assert $page) => $page
        ->where('view', 'board')
        ->has('tasks.todo', 1)
        ->has('tasks.review', 1)
        ->has('tasks.in_progress', 0)
        ->where('tasks.todo.0.title', 'Todo 1'));

    $this->actingAs($this->staff)->get(route('tasks.index', ['view' => 'list', 'priority' => 'high']))->assertInertia(fn (Assert $page) => $page
        ->where('view', 'list')
        ->has('tasks.data', 1)
        ->where('tasks.data.0.title', 'Todo 1')
        ->where('filters.priority', 'high'));

    $this->actingAs($this->staff)->get(route('tasks.index', ['view' => 'list', 'project_id' => $this->project->id]))
        ->assertInertia(fn (Assert $page) => $page->has('tasks.data', 2));

    $this->actingAs($this->admin)->get(route('tasks.index', ['view' => 'list']))
        ->assertInertia(fn (Assert $page) => $page->has('tasks.data', 3));
});

it('shows a task summary on the project page and blocks deleting projects with tasks', function () {
    makeTask(['project_id' => $this->sub->id, 'status' => 'done']);
    makeTask(['project_id' => $this->project->id, 'due_date' => now()->subDays(2)->toDateString()]);

    $this->actingAs($this->admin)->get(route('projects.show', $this->project))->assertInertia(fn (Assert $page) => $page
        ->where('taskSummary.total', 2)
        ->where('taskSummary.done', 1)
        ->where('taskSummary.overdue', 1));

    $this->actingAs($this->admin)->delete(route('projects.destroy', $this->sub))->assertSessionHas('error');
    expect(Project::find($this->sub->id))->not->toBeNull();
});
