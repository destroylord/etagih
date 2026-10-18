<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\RecordPayment;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\ProjectStats;
use App\Support\RateResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 100000]);
    $this->actingAs(User::factory()->create());

    $this->aqim = Client::create(['name' => 'Aqim', 'hourly_rate' => 150000]);
    $this->gym = Project::create(['client_id' => $this->aqim->id, 'name' => 'Gym']);
    $this->allstar = Project::create(['client_id' => $this->aqim->id, 'parent_id' => $this->gym->id, 'name' => 'Allstar']);
    $this->buildy = Project::create(['client_id' => $this->aqim->id, 'parent_id' => $this->gym->id, 'name' => 'Buildy', 'hourly_rate' => 200000]);
});

function invoicePayload(array $overrides = []): array
{
    return array_merge([
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Pekerjaan', 'unit_price' => 1000000]],
    ], $overrides);
}

// --- CRUD & aturan hierarki --------------------------------------------------

it('creates projects and sub-projects', function () {
    $this->post(route('projects.store'), ['client_id' => $this->aqim->id, 'name' => 'Kafe'])->assertSessionHasNoErrors();
    $kafe = Project::firstWhere('name', 'Kafe');

    $this->post(route('projects.store'), ['client_id' => $this->aqim->id, 'parent_id' => $kafe->id, 'name' => 'Menu Digital'])
        ->assertSessionHasNoErrors();

    expect(Project::firstWhere('name', 'Menu Digital')->parent_id)->toBe($kafe->id)
        ->and(Project::firstWhere('name', 'Menu Digital')->full_name)->toBe('Kafe › Menu Digital');
});

it('limits nesting to two levels and keeps sub-projects within the same client', function () {
    // Sub dari sub-proyek ditolak.
    $this->post(route('projects.store'), ['client_id' => $this->aqim->id, 'parent_id' => $this->allstar->id, 'name' => 'Level 3'])
        ->assertSessionHasErrors('parent_id');

    // Induk milik klien lain ditolak.
    $other = Client::create(['name' => 'Lain']);
    $this->post(route('projects.store'), ['client_id' => $other->id, 'parent_id' => $this->gym->id, 'name' => 'X'])
        ->assertSessionHasErrors('parent_id');

    // Nama kembar di level yang sama ditolak, beda induk boleh.
    $this->post(route('projects.store'), ['client_id' => $this->aqim->id, 'parent_id' => $this->gym->id, 'name' => 'Allstar'])
        ->assertSessionHasErrors('name');
    $this->post(route('projects.store'), ['client_id' => $this->aqim->id, 'name' => 'Gym'])
        ->assertSessionHasErrors('name');
});

it('refuses to turn a project with sub-projects into a sub-project', function () {
    $kafe = Project::create(['client_id' => $this->aqim->id, 'name' => 'Kafe']);

    $this->put(route('projects.update', $this->gym), ['name' => 'Gym', 'parent_id' => $kafe->id])
        ->assertSessionHasErrors('parent_id');
});

it('blocks deleting a project that is in use and allows archiving it', function () {
    $invoice = app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $this->allstar->id]));

    $this->delete(route('projects.destroy', $this->gym))->assertSessionHas('error');
    expect(Project::find($this->gym->id))->not->toBeNull();

    $this->put(route('projects.update', $this->gym), ['name' => 'Gym', 'status' => 'archived'])->assertSessionHasNoErrors();
    expect($this->gym->fresh()->status)->toBe('archived');

    $kosong = Project::create(['client_id' => $this->aqim->id, 'name' => 'Kosong']);
    $this->delete(route('projects.destroy', $kosong))->assertSessionHas('success');
    expect(Project::find($kosong->id))->toBeNull();
});

// --- Invoice ------------------------------------------------------------------

it('creates an invoice for a project with items split per sub-project', function () {
    $this->post(route('invoices.store'), invoicePayload([
        'client_id' => $this->aqim->id,
        'project_id' => $this->gym->id,
        'items' => [
            ['description' => 'Desain', 'unit_price' => 3000000, 'project_id' => $this->allstar->id],
            ['description' => 'Backend', 'unit_price' => 2000000, 'project_id' => $this->buildy->id],
            ['description' => 'Koordinasi', 'unit_price' => 500000],
        ],
    ]))->assertSessionHasNoErrors();

    $invoice = Invoice::with('items')->latest('id')->first();
    expect($invoice->project_id)->toBe($this->gym->id)
        ->and($invoice->items->pluck('project_id')->all())->toBe([$this->allstar->id, $this->buildy->id, null]);
});

it('rejects projects of another client and items outside the invoice project', function () {
    $other = Client::create(['name' => 'Lain']);
    $otherProject = Project::create(['client_id' => $other->id, 'name' => 'Toko']);

    $this->post(route('invoices.store'), invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $otherProject->id]))
        ->assertSessionHasErrors('project_id');

    $kafe = Project::create(['client_id' => $this->aqim->id, 'name' => 'Kafe']);
    $this->post(route('invoices.store'), invoicePayload([
        'client_id' => $this->aqim->id,
        'project_id' => $this->gym->id,
        'items' => [['description' => 'X', 'unit_price' => 1, 'project_id' => $kafe->id]],
    ]))->assertSessionHasErrors('items.0.project_id');

    expect(Invoice::count())->toBe(0);
});

it('filters invoices by project including its sub-projects', function () {
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $this->allstar->id]));
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id]));

    $this->get(route('invoices.index', ['project_id' => $this->gym->id]))
        ->assertInertia(fn ($page) => $page->where('invoices.total', 1));
})->skip(fn () => ! file_exists(public_path('build/manifest.json')), 'butuh build frontend');

// --- Statistik ----------------------------------------------------------------

it('rolls up billing to the parent and splits work value per sub-project', function () {
    // Invoice level Gym dengan item Allstar & Buildy (lunas).
    $gymInvoice = app(CreateInvoice::class)->execute(invoicePayload([
        'client_id' => $this->aqim->id,
        'project_id' => $this->gym->id,
        'items' => [
            ['description' => 'A', 'unit_price' => 3000000, 'project_id' => $this->allstar->id],
            ['description' => 'B', 'unit_price' => 2000000, 'project_id' => $this->buildy->id],
        ],
    ]));
    $gymInvoice->update(['status' => 'sent']);
    app(RecordPayment::class)->execute(invoice: $gymInvoice, amount: 5000000, externalId: 'x', method: 'manual');

    // Invoice langsung ke Allstar (belum dibayar).
    $allstarInvoice = app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $this->allstar->id]));
    $allstarInvoice->update(['status' => 'sent']);

    // Draft tidak dihitung.
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $this->buildy->id]));

    $stats = ProjectStats::for([$this->gym]);

    expect($stats[$this->allstar->id]['billed'])->toBe(1000000.0)
        ->and($stats[$this->allstar->id]['work_value'])->toBe(4000000.0)
        ->and($stats[$this->buildy->id]['work_value'])->toBe(2000000.0)
        ->and($stats[$this->gym->id]['billed'])->toBe(6000000.0)
        ->and($stats[$this->gym->id]['paid'])->toBe(5000000.0)
        ->and($stats[$this->gym->id]['outstanding'])->toBe(1000000.0)
        ->and($stats[$this->gym->id]['invoice_count'])->toBe(2)
        ->and($stats[$this->gym->id]['work_value'])->toBe(6000000.0);
});

// --- Time Tracker -------------------------------------------------------------

it('starts a time tracker session on a sub-project and bills it into that sub-project', function () {
    $this->postJson(route('work-sessions.start'), [
        'client_id' => $this->aqim->id,
        'project_id' => $this->buildy->id,
        'description' => 'Fitur login',
        'unit_price' => RateResolver::forProject($this->buildy),
    ])->assertOk();

    $session = WorkSession::first();
    expect($session->project_id)->toBe($this->buildy->id)
        ->and((float) $session->unit_price)->toBe(200000.0);

    $session->update(['status' => 'completed', 'duration_seconds' => 3600]);

    $invoice = app(CreateInvoice::class)->execute(invoicePayload([
        'client_id' => $this->aqim->id,
        'project_id' => $this->gym->id,
        'invoice_mode' => 'hourly',
        'items' => [['description' => 'Fitur login', 'unit_price' => 200000, 'session_ids' => [$session->id]]],
    ]));

    expect($invoice->items->first()->project_id)->toBe($this->buildy->id);
});

it('rejects a time tracker project that belongs to another client', function () {
    $other = Client::create(['name' => 'Lain']);

    $this->postJson(route('work-sessions.start'), [
        'client_id' => $other->id,
        'project_id' => $this->gym->id,
        'description' => 'X',
        'unit_price' => 1,
    ])->assertStatus(422)->assertJsonValidationErrors('project_id');
});

it('resolves hourly rates from sub-project, parent project, then client', function () {
    expect(RateResolver::forProject($this->buildy))->toBe(200000.0)
        ->and(RateResolver::forProject($this->allstar))->toBe(150000.0);

    $this->gym->update(['hourly_rate' => 175000]);
    expect(RateResolver::forProject($this->allstar->fresh()))->toBe(175000.0);
});

// --- Halaman ------------------------------------------------------------------

it('renders the project list as a tree with rolled-up stats', function () {
    $invoice = app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $this->allstar->id]));
    $invoice->update(['status' => 'sent']);

    $this->get(route('projects.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/index')
            ->has('projects.data', 1)
            ->where('projects.data.0.name', 'Gym')
            ->where('projects.data.0.client.name', 'Aqim')
            ->has('projects.data.0.children', 2)
            ->where('projects.data.0.stats.billed', 1000000));
});

it('renders a sub-project page with its siblings and invoices', function () {
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->aqim->id, 'project_id' => $this->allstar->id]));

    $this->get(route('projects.show', $this->allstar))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/show')
            ->where('project.full_name', 'Gym › Allstar')
            ->where('tree.name', 'Gym')
            ->has('tree.children', 2)
            ->has('invoices.data', 1));
});

it('shows projects on the client page, reports and invoice form', function () {
    $this->get(route('clients.show', $this->aqim))->assertOk()
        ->assertInertia(fn ($page) => $page->has('projects', 1)->has('projects.0.children', 2));

    $this->get(route('invoices.create', ['project_id' => $this->buildy->id]))->assertOk()
        ->assertInertia(fn ($page) => $page->where('preselectedProjectId', $this->buildy->id)->has('projects', 3));

    $this->get(route('reports.index'))->assertOk()->assertInertia(fn ($page) => $page->has('projects'));
});
