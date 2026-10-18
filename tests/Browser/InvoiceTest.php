<?php

use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\Setting;
use App\Models\User;
use Laravel\Dusk\Browser;

beforeEach(function () {
    Setting::updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);
});

test('user can create a fixed full invoice and it lands on draft', function () {
    $user = User::factory()->create();
    $client = Client::create(['name' => 'PT Test']);

    $this->browse(function (Browser $browser) use ($user, $client) {
        $browser->loginAs($user)
            ->visit('/invoices/create')
            ->waitFor('form', 5)
            // Pilih klien
            ->select('select[name=client_id]', $client->id)
            // Isi item pertama
            ->type('input[name="items[0][description]"]', 'Jasa Web')
            ->type('input[name="items[0][unit_price]"]', '500000')
            // Submit
            ->press('Buat Invoice')
            ->waitForLocation('/invoices/*', 5)
            ->assertSee('draft');
    });
});

test('user can send invoice and status changes to sent', function () {
    $user = User::factory()->create();
    $client = Client::create(['name' => 'PT Send', 'phone' => '081234567890']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Jasa', 'unit_price' => 100000, 'product_id' => null]],
    ]);

    $this->browse(function (Browser $browser) use ($user, $invoice) {
        $browser->loginAs($user)
            ->visit("/invoices/{$invoice->id}")
            ->waitForText('draft', 5)
            ->press('Kirim ke Client')
            ->waitForText('sent', 5)
            ->assertSee('sent');
    });
});

test('public pay page shows invoice info', function () {
    $client = Client::create(['name' => 'PT Pay']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Jasa Konsultasi', 'unit_price' => 250000, 'product_id' => null]],
    ]);
    // Ubah status ke sent supaya pay page accessible
    $invoice->update(['status' => 'sent']);

    $this->browse(function (Browser $browser) use ($invoice) {
        $browser->visit("/pay/{$invoice->public_token}")
            ->waitForText('Jasa Konsultasi', 5)
            ->assertSee('250');
    });
});
