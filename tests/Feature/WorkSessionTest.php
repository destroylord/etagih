<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\WorkSessionAction;
use App\Models\Client;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\RateResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], [
        'app_invoice_prefix' => 'INV',
        'default_hourly_rate' => 100000,
    ]);
    config([
        'app.session_min_billable_minutes' => 15,
        'app.session_rounding_minutes' => 15,
    ]);
    $this->user = User::factory()->create();
});

it('start() creates a running session and rejects second while one is running', function () {
    $client = Client::create(['name' => 'A', 'hourly_rate' => 150000]);
    $action = app(WorkSessionAction::class);

    $s = $action->start($this->user->id, $client->id, 'Desain', 150000);
    expect($s->status)->toBe('running');

    expect(fn () => $action->start($this->user->id, $client->id, 'Lain', 150000))
        ->toThrow(RuntimeException::class);
});

it('stop() rounds up to 15-min and enforces minimum billable', function () {
    $client = Client::create(['name' => 'A']);
    $action = app(WorkSessionAction::class);

    // 10 menit → dipaksa min 15 menit (900s)
    $s = WorkSession::create([
        'client_id' => $client->id,
        'description' => 'Short',
        'unit_price' => 100000,
        'started_at' => now()->subMinutes(10),
        'status' => 'running',
    ]);
    $stopped = $action->stop($s);
    expect($stopped->duration_seconds)->toBe(900);

    // 40 menit → ceil ke 45 menit (2700s)
    $s2 = WorkSession::create([
        'client_id' => $client->id,
        'description' => 'Long',
        'unit_price' => 100000,
        'started_at' => now()->subMinutes(40),
        'status' => 'running',
    ]);
    expect($action->stop($s2)->duration_seconds)->toBe(2700);
});

it('hours_qty accessor sums sessions and derives from status completed/billed', function () {
    $client = Client::create(['name' => 'A']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'hourly',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [
            ['description' => 'Work', 'unit_price' => 100000, 'session_ids' => []],
        ],
    ]);
    $item = $invoice->items()->first();

    // Tambah 2 completed session (masing2 1 jam = 3600s) manual via DB.
    WorkSession::create([
        'client_id' => $client->id,
        'invoice_id' => $invoice->id,
        'invoice_item_id' => $item->id,
        'description' => 'S1',
        'unit_price' => 100000,
        'started_at' => now()->subHours(2),
        'ended_at' => now()->subHour(),
        'duration_seconds' => 3600,
        'status' => 'billed',
    ]);
    WorkSession::create([
        'client_id' => $client->id,
        'invoice_id' => $invoice->id,
        'invoice_item_id' => $item->id,
        'description' => 'S2',
        'unit_price' => 100000,
        'started_at' => now()->subHours(2),
        'ended_at' => now()->subHour(),
        'duration_seconds' => 3600,
        'status' => 'billed',
    ]);

    expect((float) $item->fresh()->hours_qty)->toBe(2.0);
});

it('CreateInvoice links sessions + marks billed and derives line_total', function () {
    $client = Client::create(['name' => 'A']);
    $action = app(WorkSessionAction::class);

    $s = WorkSession::create([
        'client_id' => $client->id,
        'description' => 'Desain',
        'unit_price' => 100000,
        'started_at' => now()->subHour(),
        'ended_at' => now(),
        'duration_seconds' => 3600,
        'status' => 'completed',
    ]);

    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'hourly',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [
            ['description' => 'Desain', 'unit_price' => 100000, 'session_ids' => [$s->id]],
        ],
    ]);

    $item = $invoice->items()->first();
    expect((float) $item->hours_qty)->toBe(1.0);
    expect((float) $item->line_total)->toBe(100000.0);
    expect($s->fresh()->status)->toBe('billed');
    expect($s->fresh()->invoice_id)->toBe($invoice->id);
    expect($s->fresh()->invoice_item_id)->toBe($item->id);
});

it('RateResolver prioritizes client hourly_rate over settings default', function () {
    $client = Client::create(['name' => 'A', 'hourly_rate' => 200000]);
    expect(RateResolver::forClient($client))->toBe(200000.0);

    $client2 = Client::create(['name' => 'B']);
    expect(RateResolver::forClient($client2))->toBe(100000.0);
});

it('per-user lock: same user rejected while ANOTHER client has active session', function () {
    $a = Client::create(['name' => 'A']);
    $b = Client::create(['name' => 'B']);
    $action = app(WorkSessionAction::class);

    $action->start($this->user->id, $a->id, 'Kerja A', 100000);

    // Client beda tetap ditolak — lock-nya per pengguna, bukan per-client.
    expect(fn () => $action->start($this->user->id, $b->id, 'Kerja B', 100000))
        ->toThrow(RuntimeException::class);
});

it('per-user lock: two users can each have an active session', function () {
    $client = Client::create(['name' => 'A']);
    $other = User::factory()->state(['role' => 'staff'])->create();
    $action = app(WorkSessionAction::class);

    $mine = $action->start($this->user->id, $client->id, 'Kerja saya', 100000);
    $theirs = $action->start($other->id, $client->id, 'Kerja staf', 100000);

    expect($mine->user_id)->toBe($this->user->id)
        ->and($theirs->user_id)->toBe($other->id)
        ->and(WorkSession::whereIn('status', ['running', 'paused'])->count())->toBe(2);
});

it('start endpoint records the current user and time tracker shows only their active session', function () {
    $client = Client::create(['name' => 'A']);
    $staff = User::factory()->state(['role' => 'staff'])->create();
    // Staf hanya bisa mencatat waktu di klien dari proyek yang ia ikuti.
    Project::create(['client_id' => $client->id, 'name' => 'Proyek A'])->members()->attach($staff);

    $this->actingAs($staff)->post(route('work-sessions.start'), [
        'client_id' => $client->id, 'description' => 'Staf', 'unit_price' => 100000,
    ])->assertRedirect(route('time-tracker.index'));

    $session = WorkSession::sole();
    expect($session->user_id)->toBe($staff->id);

    // Pengguna lain: tidak ada session aktif miliknya, dan masih bisa mulai sendiri.
    $this->actingAs($this->user)->get(route('time-tracker.index'))
        ->assertInertia(fn ($page) => $page
            ->where('active', null)
            ->where('sessions.data.0.user.name', $staff->name));

    $this->actingAs($this->user)->post(route('work-sessions.start'), [
        'client_id' => $client->id, 'description' => 'Admin', 'unit_price' => 100000,
    ])->assertSessionHasNoErrors();

    $this->actingAs($staff)->get(route('time-tracker.index'))
        ->assertInertia(fn ($page) => $page->where('active.id', $session->id));

    // Staf yang sama tidak bisa memulai session kedua.
    $this->actingAs($staff)->post(route('work-sessions.start'), [
        'client_id' => $client->id, 'description' => 'Lagi', 'unit_price' => 100000,
    ])->assertSessionHasErrors('session');
});

it('pause accumulates segments, resume opens new one, stop rounds the total', function () {
    Carbon::setTestNow('2026-08-21 10:00:00');
    $client = Client::create(['name' => 'A']);
    $action = app(WorkSessionAction::class);

    $s = $action->start($this->user->id, $client->id, 'Kerja', 100000);
    expect($s->status)->toBe('running');

    // Kerja 20 menit → pause.
    Carbon::setTestNow('2026-08-21 10:20:00');
    $s = $action->pause($s);
    expect($s->status)->toBe('paused');
    expect($s->duration_seconds)->toBe(1200);

    // Pause 5 menit (tidak dihitung).
    Carbon::setTestNow('2026-08-21 10:25:00');
    $s = $action->resume($s);
    expect($s->status)->toBe('running');

    // Kerja lagi 15 menit → stop. Total raw = 1200 + 900 = 2100 → ceil ke 2700.
    Carbon::setTestNow('2026-08-21 10:40:00');
    $s = $action->stop($s);
    expect($s->status)->toBe('completed');
    expect($s->duration_seconds)->toBe(2700);

    Carbon::setTestNow();
});

it('stop from paused state uses accumulated time only', function () {
    Carbon::setTestNow('2026-08-21 09:00:00');
    $client = Client::create(['name' => 'A']);
    $action = app(WorkSessionAction::class);

    $s = $action->start($this->user->id, $client->id, 'Tugas', 100000);

    // 30 menit kerja → pause.
    Carbon::setTestNow('2026-08-21 09:30:00');
    $s = $action->pause($s);
    expect($s->duration_seconds)->toBe(1800);

    // Diam 1 jam (paused) → stop. Total tetap 1800 → round ke 1800.
    Carbon::setTestNow('2026-08-21 10:30:00');
    $s = $action->stop($s);
    expect($s->duration_seconds)->toBe(1800);
    expect($s->status)->toBe('completed');

    Carbon::setTestNow();
});

it('elapsedSeconds reflects accumulation across pauses', function () {
    Carbon::setTestNow('2026-08-21 08:00:00');
    $client = Client::create(['name' => 'A']);
    $action = app(WorkSessionAction::class);

    $s = $action->start($this->user->id, $client->id, 'X', 100000);
    Carbon::setTestNow('2026-08-21 08:10:00'); // 600s
    $s = $action->pause($s);
    expect($s->elapsedSeconds())->toBe(600);

    Carbon::setTestNow('2026-08-21 09:00:00'); // masih paused
    expect($s->fresh()->elapsedSeconds())->toBe(600);

    $s = $action->resume($s);
    Carbon::setTestNow('2026-08-21 09:05:00'); // +300s
    expect($s->fresh()->elapsedSeconds())->toBe(900);

    Carbon::setTestNow();
});

it('cancel allows paused session', function () {
    Carbon::setTestNow('2026-08-21 08:00:00');
    $client = Client::create(['name' => 'A']);
    $action = app(WorkSessionAction::class);

    $s = $action->start($this->user->id, $client->id, 'Y', 100000);
    Carbon::setTestNow('2026-08-21 08:05:00');
    $s = $action->pause($s);

    $action->cancel($s);
    expect(WorkSession::find($s->id))->toBeNull();

    Carbon::setTestNow();
});

it('releases billed sessions back to unbilled when a draft invoice is deleted', function () {
    $this->actingAs(User::factory()->create());
    $client = Client::create(['name' => 'Hapus']);
    $session = WorkSession::create([
        'client_id' => $client->id, 'description' => 'Kerja', 'unit_price' => 100000,
        'started_at' => now()->subHour(), 'ended_at' => now(), 'duration_seconds' => 3600, 'status' => 'completed',
    ]);

    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id, 'invoice_mode' => 'hourly', 'type' => 'full', 'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Kerja', 'unit_price' => 100000, 'session_ids' => [$session->id]]],
    ]);
    expect($session->fresh()->status)->toBe('billed');

    $this->delete(route('invoices.destroy', $invoice))->assertRedirect();

    expect($session->fresh()->status)->toBe('completed')
        ->and($session->fresh()->invoice_id)->toBeNull();
});

it('only lets the session owner or an admin control a running session', function () {
    $client = Client::create(['name' => 'Tim']);
    $staffA = User::factory()->create(['role' => 'staff']);
    $staffB = User::factory()->create(['role' => 'staff']);
    $admin = User::factory()->create(['role' => 'admin']);
    // Keduanya anggota proyek → sesi terlihat oleh staf B, tetapi bukan miliknya (403).
    $project = Project::create(['client_id' => $client->id, 'name' => 'Proyek Tim']);
    $project->members()->attach([$staffA->id, $staffB->id]);

    $session = WorkSession::create([
        'user_id' => $staffA->id, 'client_id' => $client->id, 'project_id' => $project->id, 'description' => 'Kerja A',
        'unit_price' => 100000, 'started_at' => now()->subMinutes(30), 'status' => 'running',
    ]);

    $this->actingAs($staffB)->postJson(route('work-sessions.pause', $session))->assertStatus(403);
    $this->actingAs($staffB)->deleteJson(route('work-sessions.destroy', $session))->assertStatus(403);
    expect($session->fresh()->status)->toBe('running');

    $this->actingAs($staffA)->postJson(route('work-sessions.pause', $session))->assertOk();
    $this->actingAs($admin)->postJson(route('work-sessions.resume', $session))->assertOk();
    expect($session->fresh()->status)->toBe('running');
});
