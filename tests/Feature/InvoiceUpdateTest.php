<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\UpdateInvoice;
use App\Models\Client;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], [
        'app_invoice_prefix' => 'INV',
    ]);
});

it('creates a draft invoice with items and computed totals', function () {
    $client = Client::create(['name' => 'Test Client']);

    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => '2026-08-14',
        'due_date' => '2026-09-14',
        'discount' => 0,
        'items' => [
            ['description' => 'Web design', 'unit_price' => 1500000, 'product_id' => null],
            ['description' => 'Hosting', 'unit_price' => 500000, 'product_id' => null],
        ],
    ]);

    expect($invoice->status)->toBe('draft');
    expect($invoice->total)->toBe('2000000.00');
    expect($invoice->items)->toHaveCount(2);
    expect($invoice->invoice_number)->toMatch('/^INV-\d{8}-\d{4}$/');
    expect($invoice->public_token)->toHaveLength(40);
});

it('update() preserves invoice_number, public_token, and id (in-place)', function () {
    $client = Client::create(['name' => 'Test']);
    $creator = app(CreateInvoice::class);
    $updater = app(UpdateInvoice::class);

    $invoice = $creator->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => '2026-08-14',
        'items' => [
            ['description' => 'A', 'unit_price' => 100, 'product_id' => null],
        ],
    ]);

    $originalNumber = $invoice->invoice_number;
    $originalToken = $invoice->public_token;
    $originalId = $invoice->id;

    $updated = $updater->execute($invoice, [
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => '2026-08-15',
        'discount' => 50,
        'items' => [
            ['description' => 'A revised', 'unit_price' => 200, 'product_id' => null],
            ['description' => 'B new', 'unit_price' => 300, 'product_id' => null],
        ],
    ]);

    expect($updated->id)->toBe($originalId);
    expect($updated->invoice_number)->toBe($originalNumber);
    expect($updated->public_token)->toBe($originalToken);
    expect($updated->status)->toBe('draft');
    expect($updated->items)->toHaveCount(2);
    expect((float) $updated->total)->toBe(450.0);
});

it('update() rebuilds installment schedules for installment invoices', function () {
    $client = Client::create(['name' => 'Test']);
    $creator = app(CreateInvoice::class);
    $updater = app(UpdateInvoice::class);

    $invoice = $creator->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'issue_date' => '2026-08-14',
        'installments' => ['count' => 3, 'first_due_date' => '2026-09-01', 'interval_days' => 30],
        'items' => [['description' => 'X', 'unit_price' => 900, 'product_id' => null]],
    ]);

    expect($invoice->schedules)->toHaveCount(3);
    $originalNumber = $invoice->invoice_number;

    $updated = $updater->execute($invoice, [
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'issue_date' => '2026-08-14',
        'installments' => ['count' => 6, 'first_due_date' => '2026-09-15', 'interval_days' => 30],
        'items' => [['description' => 'X', 'unit_price' => 1200, 'product_id' => null]],
    ]);

    expect($updated->schedules)->toHaveCount(6);
    expect($updated->invoice_number)->toBe($originalNumber);
});
