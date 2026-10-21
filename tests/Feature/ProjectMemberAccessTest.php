<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Quote\CreateQuote;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Project;
use App\Models\Quote;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\Access;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    Queue::fake();
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 100000]);

    $this->admin = User::factory()->create();
    $this->staff = User::factory()->state(['role' => 'staff'])->create();

    $this->mine = Client::create(['name' => 'Klien Saya']);
    $this->other = Client::create(['name' => 'Klien Lain']);

    $this->project = Project::create(['client_id' => $this->mine->id, 'name' => 'Toko Online']);
    $this->sub = Project::create(['client_id' => $this->mine->id, 'parent_id' => $this->project->id, 'name' => 'Aplikasi Mobile']);
    $this->otherProject = Project::create(['client_id' => $this->other->id, 'name' => 'Rahasia']);

    $this->project->members()->attach($this->staff);
});

function accessInvoice(Client $client): Invoice
{
    return app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Kerja', 'unit_price' => 100000]],
    ]);
}

function accessQuote(Client $client): Quote
{
    return app(CreateQuote::class)->execute([
        'client_id' => $client->id,
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Kerja', 'quantity' => 1, 'unit_price' => 100000]],
    ]);
}

it('resolves visible project and client ids for staff and admin', function () {
    expect(Access::projectIds($this->admin))->toBeNull()
        ->and(Access::clientIds($this->admin))->toBeNull()
        ->and(Access::isRestricted($this->staff))->toBeTrue()
        ->and(Access::projectIds($this->staff))->toEqualCanonicalizing([$this->project->id, $this->sub->id])
        ->and(Access::clientIds($this->staff))->toBe([$this->mine->id]);

    $loner = User::factory()->state(['role' => 'staff'])->create();
    expect(Access::projectIds($loner))->toBe([])
        ->and(Access::clientIds($loner))->toBe([]);
});

it('shows staff only clients and projects of their memberships', function () {
    $this->actingAs($this->staff);

    $this->get(route('clients.index'))->assertInertia(fn (Assert $page) => $page
        ->has('clients.data', 1)
        ->where('clients.data.0.id', $this->mine->id));

    $this->get(route('projects.index'))->assertInertia(fn (Assert $page) => $page
        ->has('projects.data', 1)
        ->where('projects.data.0.id', $this->project->id)
        ->where('projects.data.0.members_count', 1)
        ->has('clients', 1));

    $this->get(route('clients.show', $this->mine))->assertOk();
    $this->get(route('projects.show', $this->project))->assertOk();
    // Sub-proyek mewarisi keanggotaan proyek utama.
    $this->get(route('projects.show', $this->sub))->assertOk();

    $this->get(route('clients.show', $this->other))->assertNotFound();
    $this->get(route('projects.show', $this->otherProject))->assertNotFound();
});

it('shows staff only invoices and quotes of visible clients', function () {
    $visible = accessInvoice($this->mine);
    $hidden = accessInvoice($this->other);
    $visibleQuote = accessQuote($this->mine);
    $hiddenQuote = accessQuote($this->other);

    $this->actingAs($this->staff);

    $this->get(route('invoices.index'))->assertInertia(fn (Assert $page) => $page
        ->has('invoices.data', 1)
        ->where('invoices.data.0.id', $visible->id));
    $this->get(route('quotes.index'))->assertInertia(fn (Assert $page) => $page
        ->has('quotes.data', 1)
        ->where('quotes.data.0.id', $visibleQuote->id));

    $this->get(route('invoices.show', $visible))->assertOk();
    $this->get(route('invoices.show', $hidden))->assertNotFound();
    $this->get(route('invoices.edit', $hidden))->assertNotFound();
    $this->get(route('invoices.pdf', $hidden))->assertNotFound();
    $this->post(route('invoices.duplicate', $hidden))->assertNotFound();
    $this->get(route('quotes.show', $visibleQuote))->assertOk();
    $this->get(route('quotes.show', $hiddenQuote))->assertNotFound();
    $this->delete(route('quotes.destroy', $hiddenQuote))->assertNotFound();

    expect(Quote::find($hiddenQuote->id))->not->toBeNull();
});

it('rejects staff creating invoices for invisible or new clients', function () {
    $this->actingAs($this->staff);

    $payload = fn (array $extra) => [
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Desain', 'unit_price' => 500000]],
        ...$extra,
    ];

    $this->post(route('invoices.store'), $payload(['client_id' => $this->other->id]))->assertSessionHasErrors('client_id');
    $this->post(route('invoices.store'), $payload(['client' => ['name' => 'Klien Baru']]))->assertSessionHasErrors('client_id');
    $this->post(route('invoices.store'), $payload(['client_id' => $this->mine->id]))->assertSessionHasNoErrors();

    expect(Invoice::count())->toBe(1)
        ->and(Client::count())->toBe(2);
});

it('lets admins see everything', function () {
    accessInvoice($this->mine);
    accessInvoice($this->other);
    $this->actingAs($this->admin);

    $this->get(route('clients.index'))->assertInertia(fn (Assert $page) => $page->has('clients.data', 2));
    $this->get(route('projects.index'))->assertInertia(fn (Assert $page) => $page->has('projects.data', 2));
    $this->get(route('invoices.index'))->assertInertia(fn (Assert $page) => $page->has('invoices.data', 2));
    $this->get(route('projects.show', $this->otherProject))->assertOk();
});

it('shows staff without memberships nothing', function () {
    accessInvoice($this->mine);
    $loner = User::factory()->state(['role' => 'staff'])->create();
    $this->actingAs($loner);

    $this->get(route('clients.index'))->assertInertia(fn (Assert $page) => $page->has('clients.data', 0));
    $this->get(route('projects.index'))->assertInertia(fn (Assert $page) => $page->has('projects.data', 0));
    $this->get(route('invoices.index'))->assertInertia(fn (Assert $page) => $page->has('invoices.data', 0));
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('stats.total_count', 0));
});

it('scopes the staff dashboard to visible clients', function () {
    accessInvoice($this->mine);
    accessInvoice($this->other);

    $this->actingAs($this->staff)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('stats.total_count', 1)->has('recentInvoices', 1));
    $this->actingAs($this->admin)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('stats.total_count', 2));
});

it('lets admins sync members on the root project, also via a sub-project', function () {
    $second = User::factory()->state(['role' => 'staff'])->create();
    $inactive = User::factory()->state(['role' => 'staff', 'is_active' => false])->create();
    $this->actingAs($this->admin);

    $this->put(route('projects.members.sync', $this->sub), ['user_ids' => [$this->staff->id, $second->id]])
        ->assertSessionHas('success');

    expect($this->project->members()->pluck('users.id')->all())->toEqualCanonicalizing([$this->staff->id, $second->id])
        ->and($this->sub->members()->count())->toBe(0);

    $this->put(route('projects.members.sync', $this->project), ['user_ids' => [$inactive->id]])
        ->assertSessionHasErrors('user_ids.0');

    $this->put(route('projects.members.sync', $this->project), ['user_ids' => []])->assertSessionHas('success');
    expect($this->project->members()->count())->toBe(0);

    $this->get(route('projects.show', $this->project))->assertInertia(fn (Assert $page) => $page
        ->has('members', 0)
        ->where('canManageMembers', true)
        ->has('taskSummary')
        ->has('assignableUsers', 3));
});

it('forbids staff from syncing members', function () {
    $this->actingAs($this->staff)
        ->put(route('projects.members.sync', $this->project), ['user_ids' => []])
        ->assertForbidden();

    expect($this->project->members()->count())->toBe(1);
});

it('lets staff edit sub-projects of their projects but not top-level ones', function () {
    $this->actingAs($this->staff);

    $this->put(route('projects.update', $this->sub), [
        'parent_id' => $this->project->id, 'name' => 'Aplikasi iOS',
    ])->assertSessionHasNoErrors();
    expect($this->sub->fresh()->name)->toBe('Aplikasi iOS');

    $this->put(route('projects.update', $this->project), ['name' => 'Ubah'])->assertForbidden();
    $this->post(route('projects.store'), [
        'client_id' => $this->other->id, 'parent_id' => $this->otherProject->id, 'name' => 'Sub',
    ])->assertForbidden();
});

it('restricts staff time tracker choices and sessions to their projects', function () {
    $hiddenSession = WorkSession::create([
        'user_id' => $this->admin->id, 'client_id' => $this->other->id, 'project_id' => $this->otherProject->id,
        'description' => 'Rahasia', 'unit_price' => 100000, 'status' => 'completed', 'duration_seconds' => 3600,
        'started_at' => now()->subHour(), 'ended_at' => now(),
    ]);
    WorkSession::create([
        'user_id' => $this->admin->id, 'client_id' => $this->mine->id, 'project_id' => $this->sub->id,
        'description' => 'Terlihat', 'unit_price' => 100000, 'status' => 'completed', 'duration_seconds' => 3600,
        'started_at' => now()->subHour(), 'ended_at' => now(),
    ]);

    $this->actingAs($this->staff)->get(route('time-tracker.index'))->assertInertia(fn (Assert $page) => $page
        ->has('sessions.data', 1)
        ->where('sessions.data.0.description', 'Terlihat')
        ->has('clients', 1)
        ->has('projects', 2));

    $this->actingAs($this->staff)->postJson(route('work-sessions.start'), [
        'client_id' => $this->other->id, 'description' => 'X', 'unit_price' => 1,
    ])->assertForbidden();
    $this->actingAs($this->staff)->postJson(route('work-sessions.start'), [
        'client_id' => $this->other->id, 'project_id' => $this->otherProject->id, 'description' => 'X', 'unit_price' => 1,
    ])->assertForbidden();

    expect(WorkSession::count())->toBe(2)
        ->and($hiddenSession->fresh()->status)->toBe('completed');
});

it('scopes products to general and visible-client products for staff', function () {
    $general = Product::create(['name' => 'Umum']);
    $hidden = Product::create(['client_id' => $this->other->id, 'name' => 'Produk Rahasia']);
    Product::create(['client_id' => $this->mine->id, 'name' => 'Produk Saya']);

    $this->actingAs($this->staff)->get(route('products.index'))->assertInertia(fn (Assert $page) => $page
        ->has('products.data', 2)
        ->has('clients', 1)
        ->where('clients.0.name', 'Klien Saya'));

    $this->actingAs($this->staff)->put(route('products.update', $hidden), ['name' => 'Ubah'])->assertNotFound();
    $this->actingAs($this->staff)->delete(route('products.destroy', $hidden))->assertNotFound();
    $this->actingAs($this->staff)->put(route('products.update', $general), ['name' => 'Umum', 'client_id' => $this->other->id])
        ->assertSessionHasErrors('client_id');
    $this->actingAs($this->staff)->post(route('products.store'), ['name' => 'Baru', 'client_id' => $this->other->id])
        ->assertSessionHasErrors('client_id');

    expect($hidden->fresh()->name)->toBe('Produk Rahasia')
        ->and($general->fresh()->client_id)->toBeNull()
        ->and(Product::count())->toBe(3);
});

it('hides legacy sessions without owner on invisible projects from staff actions', function () {
    $legacy = WorkSession::create([
        'user_id' => null, 'client_id' => $this->other->id, 'project_id' => $this->otherProject->id,
        'description' => 'Lama', 'unit_price' => 100000, 'status' => 'running', 'started_at' => now()->subHour(),
    ]);

    $this->actingAs($this->staff)->postJson(route('work-sessions.stop', $legacy))->assertNotFound();
    $this->actingAs($this->staff)->deleteJson(route('work-sessions.destroy', $legacy))->assertNotFound();

    expect($legacy->fresh()->status)->toBe('running');
});

it('backfills existing staff as members of existing root projects in the migration', function () {
    $migration = require database_path('migrations/2026_10_21_110000_create_project_members_table.php');

    $migration->down();
    $migration->up();

    expect(Access::projectIds($this->staff))->toEqualCanonicalizing([$this->project->id, $this->sub->id, $this->otherProject->id])
        ->and(Access::projectIds($this->admin))->toBeNull();
});
