<?php

use App\Actions\Invoice\CancelInvoice;
use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkSession;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->withoutVite();
    Queue::fake();
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 100000]);
    config(['app.session_min_billable_minutes' => 15, 'app.session_rounding_minutes' => 15]);

    $this->admin = User::factory()->create();
    $this->actingAs($this->admin);

    $this->client = Client::create(['name' => 'Klien', 'hourly_rate' => 150000]);
    $this->project = Project::create(['client_id' => $this->client->id, 'name' => 'Toko Online', 'hourly_rate' => 200000]);
    $this->sub = Project::create(['client_id' => $this->client->id, 'parent_id' => $this->project->id, 'name' => 'Aplikasi']);
});

function billingSession(Task $task, int $seconds, string $status = 'completed'): WorkSession
{
    $project = $task->project;

    return WorkSession::create([
        'user_id' => test()->admin->id,
        'client_id' => $project->client_id,
        'project_id' => $project->id,
        'task_id' => $task->id,
        'description' => $task->title,
        'unit_price' => 200000,
        'started_at' => now()->subSeconds($seconds),
        'ended_at' => now(),
        'duration_seconds' => $seconds,
        'status' => $status,
    ]);
}

/**
 * @param  list<array<string, mixed>>  $items
 * @return array<string, mixed>
 */
function taskInvoicePayload(Client $client, string $mode, array $items): array
{
    return [
        'client_id' => $client->id,
        'invoice_mode' => $mode,
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => $items,
    ];
}

it('lists done, billable and unbilled tasks with suggestions', function () {
    $hourly = Task::factory()->done()->create(['project_id' => $this->sub->id, 'title' => 'Fitur keranjang']);
    $fixed = Task::factory()->done()->create(['project_id' => $this->project->id, 'title' => 'Logo', 'fixed_price' => 750000]);
    Task::factory()->create(['project_id' => $this->project->id, 'title' => 'Belum selesai']);
    Task::factory()->done()->create(['project_id' => $this->project->id, 'title' => 'Internal', 'billable' => false]);
    $s1 = billingSession($hourly, 3600);
    $s2 = billingSession($hourly, 1800);

    $response = $this->getJson(route('invoices.billable-tasks', ['client_id' => $this->client->id]))->assertOk();
    $tasks = collect($response->json('tasks'))->keyBy('id');

    expect($tasks)->toHaveCount(2)
        ->and($tasks[$hourly->id]['session_ids'])->toEqualCanonicalizing([$s1->id, $s2->id])
        ->and($tasks[$hourly->id]['total_seconds'])->toBe(5400)
        ->and((float) $tasks[$hourly->id]['unit_price'])->toBe(200000.0) // sub-proyek → proyek utama
        ->and($tasks[$hourly->id]['project_full_name'])->toBe('Toko Online › Aplikasi')
        ->and((float) $tasks[$hourly->id]['suggested']['fixed']['unit_price'])->toBe(300000.0)
        ->and($tasks[$hourly->id]['suggested']['hourly']['session_ids'])->toHaveCount(2)
        ->and((float) $tasks[$fixed->id]['suggested']['fixed']['unit_price'])->toBe(750000.0)
        ->and($tasks[$fixed->id]['suggested']['hourly']['hours_qty'])->toBe(1);

    $this->getJson(route('invoices.billable-tasks'))->assertUnprocessable();
});

it('hides billable tasks of invisible clients from staff', function () {
    Task::factory()->done()->create(['project_id' => $this->project->id]);
    $staff = User::factory()->state(['role' => 'staff'])->create();

    $this->actingAs($staff)->getJson(route('invoices.billable-tasks', ['client_id' => $this->client->id]))->assertNotFound();

    $this->project->members()->attach($staff);
    $this->actingAs($staff)->getJson(route('invoices.billable-tasks', ['client_id' => $this->client->id]))
        ->assertOk()->assertJsonCount(1, 'tasks');
});

it('marks tasks billed when an hourly invoice uses their sessions', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->sub->id, 'title' => 'Fitur']);
    $session = billingSession($task, 7200);

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'hourly', [[
        'description' => 'Fitur', 'unit_price' => 200000, 'task_id' => $task->id, 'session_ids' => [$session->id],
    ]]))->assertSessionHasNoErrors();

    $invoice = Invoice::sole();
    $item = $invoice->items()->sole();
    expect((float) $item->line_total)->toBe(400000.0)
        ->and($item->task_id)->toBe($task->id)
        ->and($item->project_id)->toBe($this->sub->id)
        ->and($task->fresh())->invoice_id->toBe($invoice->id)->invoice_item_id->toBe($item->id)
        ->and($task->fresh()->isBilled())->toBeTrue()
        ->and($session->fresh()->status)->toBe('billed');

    // Tidak muncul lagi sebagai tugas yang bisa ditagih.
    $this->getJson(route('invoices.billable-tasks', ['client_id' => $this->client->id]))->assertJsonCount(0, 'tasks');
    // Tapi muncul saat mengedit invoice yang sama.
    $this->getJson(route('invoices.billable-tasks', ['client_id' => $this->client->id, 'invoice_id' => $invoice->id]))
        ->assertJsonCount(1, 'tasks')
        ->assertJsonPath('tasks.0.session_ids', [$session->id]);
});

it('bills a fixed-price task in fixed mode and links its sessions', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->project->id, 'title' => 'Logo', 'fixed_price' => 750000]);
    $session = billingSession($task, 3600);

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [[
        'description' => 'Logo', 'unit_price' => 750000, 'task_id' => $task->id,
    ]]))->assertSessionHasNoErrors();

    $invoice = Invoice::sole();
    expect((float) $invoice->subtotal)->toBe(750000.0)
        ->and($task->fresh()->invoice_id)->toBe($invoice->id)
        ->and($session->fresh())->status->toBe('billed')->invoice_id->toBe($invoice->id);
});

it('rejects task lines of another client or already billed elsewhere', function () {
    $otherClient = Client::create(['name' => 'Lain']);
    $foreign = Task::factory()->done()->create([
        'project_id' => Project::create(['client_id' => $otherClient->id, 'name' => 'P'])->id,
    ]);
    $task = Task::factory()->done()->create(['project_id' => $this->project->id]);

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [[
        'description' => 'X', 'unit_price' => 1, 'task_id' => $foreign->id,
    ]]))->assertSessionHasErrors('items.0.task_id');

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [[
        'description' => 'X', 'unit_price' => 1, 'task_id' => $task->id,
    ]]))->assertSessionHasNoErrors();

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [[
        'description' => 'X', 'unit_price' => 1, 'task_id' => $task->id,
    ]]))->assertSessionHasErrors('items.0.task_id');

    expect(Invoice::count())->toBe(1);
});

it('rejects tasks that are not done or not billable', function () {
    $open = Task::factory()->create(['project_id' => $this->project->id, 'status' => 'in_progress']);
    $nonBillable = Task::factory()->done()->create(['project_id' => $this->project->id, 'billable' => false]);

    foreach ([$open, $nonBillable] as $task) {
        $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [[
            'description' => 'X', 'unit_price' => 1, 'task_id' => $task->id,
        ]]))->assertSessionHasErrors('items.0.task_id');
    }

    expect(Invoice::count())->toBe(0);
});

it('never links a task to two invoices even when validation is bypassed (race)', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->project->id]);
    $payload = taskInvoicePayload($this->client, 'fixed', [[
        'description' => 'X', 'unit_price' => 1, 'task_id' => $task->id,
    ]]);

    $first = app(CreateInvoice::class)->execute($payload);

    expect(fn () => app(CreateInvoice::class)->execute($payload))->toThrow(ValidationException::class)
        ->and(Invoice::count())->toBe(1)
        ->and($task->fresh()->invoice_id)->toBe($first->id);
});

it('does not move a billed task to a project of another client', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->project->id]);
    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [[
        'description' => 'X', 'unit_price' => 1, 'task_id' => $task->id,
    ]]))->assertSessionHasNoErrors();
    $foreign = Project::create(['client_id' => Client::create(['name' => 'Lain'])->id, 'name' => 'P']);

    $this->put(route('tasks.update', $task), ['project_id' => $foreign->id])->assertSessionHasErrors('project_id');
    $this->put(route('tasks.update', $task), ['project_id' => $this->sub->id])->assertSessionHasNoErrors();

    expect($task->fresh()->project_id)->toBe($this->sub->id);
});

it('releases tasks when a draft invoice is deleted', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->project->id]);
    $session = billingSession($task, 3600);

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'hourly', [[
        'description' => 'X', 'unit_price' => 100000, 'task_id' => $task->id, 'session_ids' => [$session->id],
    ]]));
    $invoice = Invoice::sole();

    $this->delete(route('invoices.destroy', $invoice))->assertRedirect(route('invoices.index'));

    expect($task->fresh())->invoice_id->toBeNull()->invoice_item_id->toBeNull()
        ->and($session->fresh()->status)->toBe('completed');
});

it('releases and relinks tasks when a draft invoice is updated', function () {
    $a = Task::factory()->done()->create(['project_id' => $this->project->id, 'title' => 'A']);
    $b = Task::factory()->done()->create(['project_id' => $this->project->id, 'title' => 'B']);

    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [
        ['description' => 'A', 'unit_price' => 100, 'task_id' => $a->id],
    ]));
    $invoice = Invoice::sole();

    // Edit: A diganti B. Tugas A sudah di invoice ini → tetap lolos validasi bila dikirim lagi.
    $this->put(route('invoices.update', $invoice), taskInvoicePayload($this->client, 'fixed', [
        ['description' => 'B', 'unit_price' => 200, 'task_id' => $b->id],
    ]))->assertSessionHasNoErrors();

    $item = $invoice->items()->sole();
    expect($a->fresh()->invoice_id)->toBeNull()
        ->and($b->fresh())->invoice_id->toBe($invoice->id)->invoice_item_id->toBe($item->id);

    $this->put(route('invoices.update', $invoice), taskInvoicePayload($this->client, 'fixed', [
        ['description' => 'B', 'unit_price' => 200, 'task_id' => $b->id],
        ['description' => 'A', 'unit_price' => 100, 'task_id' => $a->id],
    ]))->assertSessionHasNoErrors();

    expect($a->fresh()->invoice_id)->toBe($invoice->id)
        ->and($b->fresh()->invoice_id)->toBe($invoice->id);
});

it('releases tasks when an invoice is cancelled', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->project->id]);
    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [
        ['description' => 'A', 'unit_price' => 100, 'task_id' => $task->id],
    ]));
    $invoice = Invoice::sole();
    $invoice->update(['status' => 'sent']);

    app(CancelInvoice::class)->execute($invoice);

    expect($task->fresh()->invoice_id)->toBeNull();
});

it('does not copy task links when duplicating an invoice', function () {
    $task = Task::factory()->done()->create(['project_id' => $this->project->id]);
    $this->post(route('invoices.store'), taskInvoicePayload($this->client, 'fixed', [
        ['description' => 'A', 'unit_price' => 100, 'task_id' => $task->id],
    ]));
    $invoice = Invoice::sole();

    $this->post(route('invoices.duplicate', $invoice))->assertRedirect();

    $copy = Invoice::whereKeyNot($invoice->id)->sole();
    expect($copy->items()->sole()->task_id)->toBeNull()
        ->and($task->fresh()->invoice_id)->toBe($invoice->id);
});

it('starts a timer from a task with its project, client, title and rate', function () {
    $task = Task::factory()->create(['project_id' => $this->sub->id, 'title' => 'Fitur checkout', 'assignee_id' => $this->admin->id]);

    $this->post(route('tasks.start-timer', $task))->assertSessionHas('success');

    $session = WorkSession::sole();
    expect($session->task_id)->toBe($task->id)
        ->and($session->project_id)->toBe($this->sub->id)
        ->and($session->client_id)->toBe($this->client->id)
        ->and($session->description)->toBe('Fitur checkout')
        ->and((float) $session->unit_price)->toBe(200000.0)
        ->and($session->user_id)->toBe($this->admin->id)
        ->and($task->fresh()->status)->toBe('in_progress');

    // Sesi kedua ditolak (satu sesi aktif per pengguna).
    $this->post(route('tasks.start-timer', $task))->assertSessionHas('error');
    expect(WorkSession::count())->toBe(1);
});

it('starts a time tracker session with task_id and shows task options', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id, 'title' => 'Bug login', 'assignee_id' => $this->admin->id]);

    $this->get(route('time-tracker.index'))->assertInertia(fn ($page) => $page
        ->where('tasks.0.id', $task->id)
        ->where('tasks.0.project_name', 'Toko Online'));

    $this->post(route('work-sessions.start'), ['task_id' => $task->id])->assertRedirect(route('time-tracker.index'));

    $session = WorkSession::sole();
    expect($session->task_id)->toBe($task->id)
        ->and($session->client_id)->toBe($this->client->id)
        ->and($session->project_id)->toBe($this->project->id)
        ->and($session->description)->toBe('Bug login');

    $this->get(route('time-tracker.index'))->assertInertia(fn ($page) => $page
        ->where('active.task.title', 'Bug login')
        ->where('sessions.data.0.task.id', $task->id));

    $this->getJson(route('tasks.show', $task))->assertJsonPath('task.has_running_session', true);
});

it('forbids starting a timer on an invisible task', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id]);
    $staff = User::factory()->state(['role' => 'staff'])->create();

    $this->actingAs($staff)->post(route('tasks.start-timer', $task))->assertNotFound();
    $this->actingAs($staff)->postJson(route('work-sessions.start'), ['task_id' => $task->id])->assertForbidden();

    expect(WorkSession::count())->toBe(0);
});
