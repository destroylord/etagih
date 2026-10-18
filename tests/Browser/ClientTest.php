<?php

use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\Setting;
use App\Models\User;
use Laravel\Dusk\Browser;

beforeEach(function () {
    Setting::updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);
});

test('user can add a client and it appears in list', function () {
    $user = User::factory()->create();

    $this->browse(function (Browser $browser) use ($user) {
        $browser->loginAs($user)
            ->visit('/clients')
            ->waitFor('button', 5)
            ->press('Tambah Klien')
            ->waitFor('input[name=name]', 5)
            ->type('name', 'PT Dusk Client')
            ->type('email', 'dusk@example.com')
            ->type('phone', '081234567890')
            ->press('Simpan')
            ->waitForText('PT Dusk Client', 5)
            ->assertSee('PT Dusk Client');
    });
});

test('client detail page shows summary and paginated invoices', function () {
    $user = User::factory()->create();
    $client = Client::create(['name' => 'PT Detail']);

    // Buat 3 invoice supaya ada data di tabel
    for ($i = 0; $i < 3; $i++) {
        $inv = app(CreateInvoice::class)->execute([
            'client_id' => $client->id,
            'invoice_mode' => 'fixed',
            'type' => 'full',
            'issue_date' => now()->toDateString(),
            'items' => [['description' => "Item {$i}", 'unit_price' => 100000, 'product_id' => null]],
        ]);
        $inv->update(['status' => 'sent']);
    }

    $this->browse(function (Browser $browser) use ($user, $client) {
        $browser->loginAs($user)
            ->visit("/clients/{$client->id}")
            ->waitForText('PT Detail', 5)
            ->assertSee('Total Ditagih')
            ->assertSee('Transaksi')
            ->assertSee('Item 0');
    });
});
