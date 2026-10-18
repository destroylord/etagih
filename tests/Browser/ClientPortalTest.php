<?php

use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\Setting;
use Laravel\Dusk\Browser;

beforeEach(function () {
    Setting::updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);
});

test('client can access portal with valid access key', function () {
    $client = Client::create(['name' => 'PT Portal', 'access_key' => 'valid-key-abc123']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Jasa Portal', 'unit_price' => 150000, 'product_id' => null]],
    ]);
    $invoice->update(['status' => 'sent']);

    $this->browse(function (Browser $browser) use ($client) {
        $browser->visit('/')
            ->waitFor('input[name=access_key]', 5)
            ->type('access_key', $client->access_key)
            ->press('Masuk')
            ->waitForText('PT Portal', 5)
            ->assertSee('PT Portal')
            ->assertSee('Jasa Portal');
    });
});

test('client sees error with invalid access key', function () {
    $this->browse(function (Browser $browser) {
        $browser->visit('/')
            ->waitFor('input[name=access_key]', 5)
            ->type('access_key', 'kunci-salah-xyz')
            ->press('Masuk')
            ->waitForText('tidak valid', 5)
            ->assertSee('tidak valid');
    });
});
