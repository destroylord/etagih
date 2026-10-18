<?php

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);
});

it('marks sent and partial invoices overdue, but never draft', function () {
    $client = Client::create(['name' => 'Test']);
    $past = now()->subDays(3)->toDateString();
    $today = now()->toDateString();

    $draft = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0001',
        'issue_date' => $past,
        'due_date' => $past,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'total' => 100,
        'paid_amount' => 0,
        'status' => 'draft',
        'public_token' => str()->random(40),
    ]);
    $sent = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0002',
        'issue_date' => $past,
        'due_date' => $past,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'total' => 200,
        'paid_amount' => 0,
        'status' => 'sent',
        'public_token' => str()->random(40),
    ]);
    $partial = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0003',
        'issue_date' => $past,
        'due_date' => $past,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'total' => 300,
        'paid_amount' => 100,
        'status' => 'partial',
        'public_token' => str()->random(40),
    ]);

    $this->artisan('invoices:mark-overdue')->assertExitCode(0);

    expect($draft->fresh()->status)->toBe('draft');
    expect($sent->fresh()->status)->toBe('overdue');
    expect($partial->fresh()->status)->toBe('overdue');
});

it('skips invoices due today or in the future', function () {
    $client = Client::create(['name' => 'Test']);
    $today = now()->toDateString();
    $future = now()->addDays(5)->toDateString();

    $dueToday = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0010',
        'issue_date' => $today,
        'due_date' => $today,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'total' => 100,
        'paid_amount' => 0,
        'status' => 'sent',
        'public_token' => str()->random(40),
    ]);
    $futureDue = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0011',
        'issue_date' => $today,
        'due_date' => $future,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'total' => 100,
        'paid_amount' => 0,
        'status' => 'sent',
        'public_token' => str()->random(40),
    ]);

    $this->artisan('invoices:mark-overdue')->assertExitCode(0);

    expect($dueToday->fresh()->status)->toBe('sent');
    expect($futureDue->fresh()->status)->toBe('sent');
});
