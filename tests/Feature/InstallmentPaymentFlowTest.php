<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\RecordPayment;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);
    Queue::fake();
});

function makeInstallmentInvoice(float $total = 600, int $count = 3)
{
    $client = Client::create(['name' => 'Cicil']);

    return app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'issue_date' => '2026-08-14',
        'installments' => ['count' => $count, 'first_due_date' => '2026-09-01', 'interval_days' => 30],
        'items' => [['description' => 'X', 'unit_price' => $total, 'product_id' => null]],
    ]);
}

it('webhook marks the installment that the pending payment was created for', function () {
    $invoice = makeInstallmentInvoice();
    $second = $invoice->schedules[1];

    Payment::create([
        'invoice_id' => $invoice->id,
        'schedule_id' => $second->id,
        'amount' => 200,
        'method' => 'qris',
        'external_id' => 'hist-777',
        'status' => 'pending',
    ]);

    config(['services.qrisly.api_key' => 'test-key']);
    Http::fake(['*/payment-status/hist-777' => Http::response(['data' => ['history_id' => 'hist-777', 'payment_status' => 'paid', 'amount' => 200]])]);

    $this->postJson('/webhook/qrisly', [
        'event' => 'payment.success',
        'data' => ['qris_history_id' => 'hist-777', 'amount' => 200, 'status' => 'paid'],
    ])->assertOk();

    $schedules = $invoice->fresh()->schedules;
    expect($schedules[1]->status)->toBe('paid');
    expect($schedules[0]->status)->toBe('pending');
    expect($schedules[2]->status)->toBe('pending');
    expect($invoice->fresh()->status)->toBe('partial');
});

it('allocates payments without scheduleId to installments in sequence', function () {
    $invoice = makeInstallmentInvoice();

    app(RecordPayment::class)->execute(invoice: $invoice, amount: 200.0, externalId: 'a');
    expect($invoice->fresh()->schedules->pluck('status')->all())->toBe(['paid', 'pending', 'pending']);

    app(RecordPayment::class)->execute(invoice: $invoice, amount: 400.0, externalId: 'b');
    expect($invoice->fresh()->schedules->pluck('status')->all())->toBe(['paid', 'paid', 'paid']);
    expect($invoice->fresh()->status)->toBe('paid');
});

it('paid overdue installment is no longer reminded', function () {
    $invoice = makeInstallmentInvoice();
    $invoice->schedules[0]->update(['status' => 'overdue']);

    app(RecordPayment::class)->execute(invoice: $invoice, amount: 200.0, externalId: 'c');

    expect($invoice->schedules[0]->fresh()->status)->toBe('paid');
});

it('hourly item without sessions uses manually entered hours', function () {
    $client = Client::create(['name' => 'Jam']);

    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'hourly',
        'type' => 'full',
        'issue_date' => '2026-08-14',
        'items' => [['description' => 'Konsultasi', 'unit_price' => 100000, 'hours_qty' => 2.5]],
    ]);

    $item = $invoice->items->first();
    expect((float) $item->line_total)->toBe(250000.0);
    expect($item->hours_qty)->toBe(2.5);
    expect((float) $invoice->total)->toBe(250000.0);
});
