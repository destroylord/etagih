<?php

use App\Models\Client;
use App\Models\Invoice;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('kunci akses salah memunculkan error dan tetap di landing', function () {
    $this->post(route('client.portal.verify'), ['access_key' => 'kunci-tidak-ada'])
        ->assertSessionHasErrors(['access_key']);
});

test('kunci akses valid membuka portal dan hanya menampilkan invoice non-draft', function () {
    $client = Client::create(['name' => 'Budi', 'phone' => '0812']);

    Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-001',
        'issue_date' => now(),
        'status' => 'draft',
        'public_token' => 'draft-token',
    ]);
    Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-002',
        'issue_date' => now(),
        'status' => 'sent',
        'public_token' => 'sent-token',
    ]);

    $this->post(route('client.portal.verify'), ['access_key' => $client->access_key])
        ->assertRedirect(route('client.portal'));

    $this->get(route('client.portal'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('client-portal')
            ->where('client.name', 'Budi')
            ->has('invoices', 1)
            ->where('invoices.0.invoice_number', 'INV-002'));
});

test('portal tanpa sesi mengarahkan kembali ke landing', function () {
    $this->get(route('client.portal'))->assertRedirect(route('home'));
});
