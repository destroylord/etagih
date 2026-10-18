<?php

use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    // Halaman baru belum ada di manifest Vite hasil build.
    $this->withoutVite();
    Queue::fake();
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 100000]);

    $this->staff = User::factory()->state(['role' => 'staff'])->create();
    $this->client = Client::create(['name' => 'Klien Uji']);
    $this->project = Project::create(['client_id' => $this->client->id, 'name' => 'Proyek Uji']);
});

function roleAccessInvoice(Client $client): Invoice
{
    return app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Pekerjaan', 'unit_price' => 1000000]],
    ]);
}

it('forbids staff from admin-only pages', function (string $method, string $uri) {
    $this->actingAs($this->staff)->{$method}($uri)->assertForbidden();
})->with([
    'laporan' => ['get', '/reports'],
    'pengaturan invoice' => ['get', '/settings/invoice'],
    'pengguna' => ['get', '/settings/users'],
    'tambah pengguna' => ['post', '/settings/users'],
    'status sistem' => ['get', '/settings/system'],
    'ekspor invoice' => ['get', '/invoices/export'],
]);

it('forbids staff from destructive and export actions on records', function () {
    $invoice = roleAccessInvoice($this->client);
    $this->actingAs($this->staff);

    $this->post(route('invoices.cancel', $invoice), ['reason' => 'x'])->assertForbidden();
    $this->delete(route('clients.destroy', $this->client))->assertForbidden();
    $this->delete(route('projects.destroy', $this->project))->assertForbidden();
    $this->get(route('clients.export', $this->client))->assertForbidden();

    expect(Client::find($this->client->id))->not->toBeNull()
        ->and(Project::find($this->project->id))->not->toBeNull()
        ->and($invoice->fresh()->status)->not->toBe('cancelled');
});

it('forbids staff from managing users', function () {
    $other = User::factory()->state(['role' => 'staff'])->create();
    $this->actingAs($this->staff);

    $this->put(route('users.update', $other), ['name' => 'X', 'email' => $other->email])->assertForbidden();
    $this->delete(route('users.destroy', $other))->assertForbidden();
    $this->post(route('users.password-reset', $other))->assertForbidden();
    $this->post(route('users.transfer-ownership', $other))->assertForbidden();
});

it('lets staff do daily operations: create invoices, manage clients and projects', function () {
    $this->actingAs($this->staff);

    $this->post(route('invoices.store'), [
        'client_id' => $this->client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Desain', 'unit_price' => 500000]],
    ])->assertSessionHasNoErrors()->assertRedirect();

    expect(Invoice::count())->toBe(1);

    $this->get(route('invoices.index'))->assertOk();
    $this->get(route('clients.index'))->assertOk();
    $this->get(route('time-tracker.index'))->assertOk();
    $this->post(route('clients.store'), ['name' => 'Klien Baru'])->assertSessionHasNoErrors();
    $this->post(route('projects.store'), ['client_id' => $this->client->id, 'name' => 'Proyek Baru'])->assertSessionHasNoErrors();
});

it('lets admins reach admin-only routes', function () {
    $admin = User::factory()->create();
    $this->actingAs($admin);

    $this->get('/reports')->assertOk();
    $this->get('/settings/users')->assertOk();
    $this->delete(route('projects.destroy', $this->project))->assertSessionHas('success');
});
