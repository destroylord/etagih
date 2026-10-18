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

    $this->majuJaya = Client::create(['name' => 'PT Maju Jaya', 'hourly_rate' => 150000]);
    $this->tokoOnline = Project::create(['client_id' => $this->majuJaya->id, 'name' => 'Toko Online']);
    $this->mobile = Project::create(['client_id' => $this->majuJaya->id, 'parent_id' => $this->tokoOnline->id, 'name' => 'Aplikasi Mobile']);
    $this->dashboard = Project::create(['client_id' => $this->majuJaya->id, 'parent_id' => $this->tokoOnline->id, 'name' => 'Dashboard Admin', 'hourly_rate' => 200000]);
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
    $this->post(route('projects.store'), ['client_id' => $this->majuJaya->id, 'name' => 'Kafe'])->assertSessionHasNoErrors();
    $kafe = Project::firstWhere('name', 'Kafe');

    $this->post(route('projects.store'), ['client_id' => $this->majuJaya->id, 'parent_id' => $kafe->id, 'name' => 'Menu Digital'])
        ->assertSessionHasNoErrors();

    expect(Project::firstWhere('name', 'Menu Digital')->parent_id)->toBe($kafe->id)
        ->and(Project::firstWhere('name', 'Menu Digital')->full_name)->toBe('Kafe › Menu Digital');
});

it('limits nesting to two levels and keeps sub-projects within the same client', function () {
    // Sub dari sub-proyek ditolak.
    $this->post(route('projects.store'), ['client_id' => $this->majuJaya->id, 'parent_id' => $this->mobile->id, 'name' => 'Level 3'])
        ->assertSessionHasErrors('parent_id');

    // Induk milik klien lain ditolak.
    $other = Client::create(['name' => 'Lain']);
    $this->post(route('projects.store'), ['client_id' => $other->id, 'parent_id' => $this->tokoOnline->id, 'name' => 'X'])
        ->assertSessionHasErrors('parent_id');

    // Nama kembar di level yang sama ditolak, beda induk boleh.
    $this->post(route('projects.store'), ['client_id' => $this->majuJaya->id, 'parent_id' => $this->tokoOnline->id, 'name' => 'Aplikasi Mobile'])
        ->assertSessionHasErrors('name');
    $this->post(route('projects.store'), ['client_id' => $this->majuJaya->id, 'name' => 'Toko Online'])
        ->assertSessionHasErrors('name');
});

it('refuses to turn a project with sub-projects into a sub-project', function () {
    $kafe = Project::create(['client_id' => $this->majuJaya->id, 'name' => 'Kafe']);

    $this->put(route('projects.update', $this->tokoOnline), ['name' => 'Toko Online', 'parent_id' => $kafe->id])
        ->assertSessionHasErrors('parent_id');
});

it('blocks deleting a project that is in use and allows archiving it', function () {
    $invoice = app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $this->mobile->id]));

    $this->delete(route('projects.destroy', $this->tokoOnline))->assertSessionHas('error');
    expect(Project::find($this->tokoOnline->id))->not->toBeNull();

    $this->put(route('projects.update', $this->tokoOnline), ['name' => 'Toko Online', 'status' => 'archived'])->assertSessionHasNoErrors();
    expect($this->tokoOnline->fresh()->status)->toBe('archived');

    $kosong = Project::create(['client_id' => $this->majuJaya->id, 'name' => 'Kosong']);
    $this->delete(route('projects.destroy', $kosong))->assertSessionHas('success');
    expect(Project::find($kosong->id))->toBeNull();
});

// --- Invoice ------------------------------------------------------------------

it('creates an invoice for a project with items split per sub-project', function () {
    $this->post(route('invoices.store'), invoicePayload([
        'client_id' => $this->majuJaya->id,
        'project_id' => $this->tokoOnline->id,
        'items' => [
            ['description' => 'Desain', 'unit_price' => 3000000, 'project_id' => $this->mobile->id],
            ['description' => 'Backend', 'unit_price' => 2000000, 'project_id' => $this->dashboard->id],
            ['description' => 'Koordinasi', 'unit_price' => 500000],
        ],
    ]))->assertSessionHasNoErrors();

    $invoice = Invoice::with('items')->latest('id')->first();
    expect($invoice->project_id)->toBe($this->tokoOnline->id)
        ->and($invoice->items->pluck('project_id')->all())->toBe([$this->mobile->id, $this->dashboard->id, null]);
});

it('rejects projects of another client and items outside the invoice project', function () {
    $other = Client::create(['name' => 'Lain']);
    $otherProject = Project::create(['client_id' => $other->id, 'name' => 'Toko']);

    $this->post(route('invoices.store'), invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $otherProject->id]))
        ->assertSessionHasErrors('project_id');

    $kafe = Project::create(['client_id' => $this->majuJaya->id, 'name' => 'Kafe']);
    $this->post(route('invoices.store'), invoicePayload([
        'client_id' => $this->majuJaya->id,
        'project_id' => $this->tokoOnline->id,
        'items' => [['description' => 'X', 'unit_price' => 1, 'project_id' => $kafe->id]],
    ]))->assertSessionHasErrors('items.0.project_id');

    expect(Invoice::count())->toBe(0);
});

it('filters invoices by project including its sub-projects', function () {
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $this->mobile->id]));
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id]));

    $this->get(route('invoices.index', ['project_id' => $this->tokoOnline->id]))
        ->assertInertia(fn ($page) => $page->where('invoices.total', 1));
})->skip(fn () => ! file_exists(public_path('build/manifest.json')), 'butuh build frontend');

// --- Statistik ----------------------------------------------------------------

it('rolls up billing to the parent and splits work value per sub-project', function () {
    // Invoice level Toko Online dengan item Aplikasi Mobile & Dashboard Admin (lunas).
    $tokoInvoice = app(CreateInvoice::class)->execute(invoicePayload([
        'client_id' => $this->majuJaya->id,
        'project_id' => $this->tokoOnline->id,
        'items' => [
            ['description' => 'A', 'unit_price' => 3000000, 'project_id' => $this->mobile->id],
            ['description' => 'B', 'unit_price' => 2000000, 'project_id' => $this->dashboard->id],
        ],
    ]));
    $tokoInvoice->update(['status' => 'sent']);
    app(RecordPayment::class)->execute(invoice: $tokoInvoice, amount: 5000000, externalId: 'x', method: 'manual');

    // Invoice langsung ke Aplikasi Mobile (belum dibayar).
    $mobileInvoice = app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $this->mobile->id]));
    $mobileInvoice->update(['status' => 'sent']);

    // Draft tidak dihitung.
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $this->dashboard->id]));

    $stats = ProjectStats::for([$this->tokoOnline]);

    expect($stats[$this->mobile->id]['billed'])->toBe(1000000.0)
        ->and($stats[$this->mobile->id]['work_value'])->toBe(4000000.0)
        ->and($stats[$this->dashboard->id]['work_value'])->toBe(2000000.0)
        ->and($stats[$this->tokoOnline->id]['billed'])->toBe(6000000.0)
        ->and($stats[$this->tokoOnline->id]['paid'])->toBe(5000000.0)
        ->and($stats[$this->tokoOnline->id]['outstanding'])->toBe(1000000.0)
        ->and($stats[$this->tokoOnline->id]['invoice_count'])->toBe(2)
        ->and($stats[$this->tokoOnline->id]['work_value'])->toBe(6000000.0);
});

// --- Time Tracker -------------------------------------------------------------

it('starts a time tracker session on a sub-project and bills it into that sub-project', function () {
    $this->postJson(route('work-sessions.start'), [
        'client_id' => $this->majuJaya->id,
        'project_id' => $this->dashboard->id,
        'description' => 'Fitur login',
        'unit_price' => RateResolver::forProject($this->dashboard),
    ])->assertOk();

    $session = WorkSession::first();
    expect($session->project_id)->toBe($this->dashboard->id)
        ->and((float) $session->unit_price)->toBe(200000.0);

    $session->update(['status' => 'completed', 'duration_seconds' => 3600]);

    $invoice = app(CreateInvoice::class)->execute(invoicePayload([
        'client_id' => $this->majuJaya->id,
        'project_id' => $this->tokoOnline->id,
        'invoice_mode' => 'hourly',
        'items' => [['description' => 'Fitur login', 'unit_price' => 200000, 'session_ids' => [$session->id]]],
    ]));

    expect($invoice->items->first()->project_id)->toBe($this->dashboard->id);
});

it('rejects a time tracker project that belongs to another client', function () {
    $other = Client::create(['name' => 'Lain']);

    $this->postJson(route('work-sessions.start'), [
        'client_id' => $other->id,
        'project_id' => $this->tokoOnline->id,
        'description' => 'X',
        'unit_price' => 1,
    ])->assertStatus(422)->assertJsonValidationErrors('project_id');
});

it('resolves hourly rates from sub-project, parent project, then client', function () {
    expect(RateResolver::forProject($this->dashboard))->toBe(200000.0)
        ->and(RateResolver::forProject($this->mobile))->toBe(150000.0);

    $this->tokoOnline->update(['hourly_rate' => 175000]);
    expect(RateResolver::forProject($this->mobile->fresh()))->toBe(175000.0);
});

// --- Halaman ------------------------------------------------------------------

it('renders the project list as a tree with rolled-up stats', function () {
    $invoice = app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $this->mobile->id]));
    $invoice->update(['status' => 'sent']);

    $this->get(route('projects.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/index')
            ->has('projects.data', 1)
            ->where('projects.data.0.name', 'Toko Online')
            ->where('projects.data.0.client.name', 'PT Maju Jaya')
            ->has('projects.data.0.children', 2)
            ->where('projects.data.0.stats.billed', 1000000));
});

it('renders a sub-project page with its siblings and invoices', function () {
    app(CreateInvoice::class)->execute(invoicePayload(['client_id' => $this->majuJaya->id, 'project_id' => $this->mobile->id]));

    $this->get(route('projects.show', $this->mobile))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/show')
            ->where('project.full_name', 'Toko Online › Aplikasi Mobile')
            ->where('tree.name', 'Toko Online')
            ->has('tree.children', 2)
            ->has('invoices.data', 1));
});

it('shows projects on the client page, reports and invoice form', function () {
    $this->get(route('clients.show', $this->majuJaya))->assertOk()
        ->assertInertia(fn ($page) => $page->has('projects', 1)->has('projects.0.children', 2));

    $this->get(route('invoices.create', ['project_id' => $this->dashboard->id]))->assertOk()
        ->assertInertia(fn ($page) => $page->where('preselectedProjectId', $this->dashboard->id)->has('projects', 3));

    $this->get(route('reports.index'))->assertOk()->assertInertia(fn ($page) => $page->has('projects'));
});
