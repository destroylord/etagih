<?php

use App\Models\Client;
use App\Models\Invoice;
use App\Models\PaymentSchedule;
use App\Models\Setting;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], [
        'app_invoice_prefix' => 'INV',
        'wa_api_key' => 'fake-key',
    ]);
});

it('sends one reminder per overdue full invoice, not two for installment invoices', function () {
    $client = Client::create(['name' => 'Test', 'phone' => '08123']);
    $past = now()->subDays(3)->toDateString();

    // Full invoice overdue → harus dapat 1 reminder.
    $fullInvoice = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0100',
        'issue_date' => $past,
        'due_date' => $past,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'total' => 100,
        'paid_amount' => 0,
        'status' => 'sent',
        'public_token' => str()->random(40),
    ]);

    // Installment invoice overdue dengan schedule overdue → TIDAK boleh dapat
    // 2x reminder (1 invoice-level + 1 schedule-level). Karena cicilan, hanya schedule.
    $installmentInvoice = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0101',
        'issue_date' => $past,
        'due_date' => $past,
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'total' => 600,
        'paid_amount' => 0,
        'status' => 'partial',
        'public_token' => str()->random(40),
    ]);
    PaymentSchedule::create([
        'invoice_id' => $installmentInvoice->id,
        'sequence' => 1,
        'due_date' => $past,
        'amount' => 200,
        'status' => 'overdue',
    ]);
    PaymentSchedule::create([
        'invoice_id' => $installmentInvoice->id,
        'sequence' => 2,
        'due_date' => now()->addDays(30)->toDateString(),
        'amount' => 200,
        'status' => 'pending',
    ]);

    $wa = Mockery::mock(WhatsAppService::class);
    $wa->shouldReceive('sendReminder')
        ->once() // full invoice only
        ->with(Mockery::on(fn ($inv) => $inv->id === $fullInvoice->id))
        ->andReturn(true);
    $wa->shouldReceive('sendReminder')
        ->once() // overdue schedule on installment
        ->with(Mockery::on(fn ($inv) => $inv->id === $installmentInvoice->id), Mockery::type(PaymentSchedule::class))
        ->andReturn(true);

    $this->app->instance(WhatsAppService::class, $wa);

    $this->artisan('app:invoice-reminders')->assertExitCode(0);
});

it('does NOT send reminder for schedules whose due_date is in the future', function () {
    $client = Client::create(['name' => 'Test', 'phone' => '08123']);
    $invoice = Invoice::create([
        'client_id' => $client->id,
        'invoice_number' => 'INV-TEST-0200',
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(60)->toDateString(),
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'total' => 300,
        'paid_amount' => 0,
        'status' => 'partial',
        'public_token' => str()->random(40),
    ]);
    PaymentSchedule::create([
        'invoice_id' => $invoice->id,
        'sequence' => 1,
        'due_date' => now()->addDays(15)->toDateString(), // future
        'amount' => 100,
        'status' => 'pending',
    ]);

    $wa = Mockery::mock(WhatsAppService::class);
    $wa->shouldNotReceive('sendReminder');

    $this->app->instance(WhatsAppService::class, $wa);

    $this->artisan('app:invoice-reminders')->assertExitCode(0);
});
