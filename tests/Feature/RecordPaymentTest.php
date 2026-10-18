<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\RecordPayment;
use App\Jobs\SendPaymentReceivedNotification;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);

    // WA konfirmasi sekarang dikirim via queue — fake supaya tidak butuh API key real.
    Queue::fake();
});

it('records full payment and marks invoice paid + schedules paid', function () {
    $client = Client::create(['name' => 'Test']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'issue_date' => '2026-08-14',
        'installments' => ['count' => 3, 'first_due_date' => '2026-09-01', 'interval_days' => 30],
        'items' => [['description' => 'X', 'unit_price' => 300, 'product_id' => null]],
    ]);

    expect($invoice->schedules)->toHaveCount(3);
    expect((float) $invoice->total)->toBe(300.0);

    $payment = app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 300.0,
        externalId: 'qris-history-123',
    );

    expect($payment->status)->toBe('success');
    expect((float) $invoice->fresh()->paid_amount)->toBe(300.0);
    expect($invoice->fresh()->status)->toBe('paid');
    expect($invoice->fresh()->schedules->where('status', 'pending'))->toHaveCount(0);
    Queue::assertPushed(SendPaymentReceivedNotification::class);
});

it('idempotent: second call with same external_id returns existing payment', function () {
    $client = Client::create(['name' => 'Test']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => '2026-08-14',
        'items' => [['description' => 'X', 'unit_price' => 500, 'product_id' => null]],
    ]);

    $first = app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 500.0,
        externalId: 'qris-history-xyz',
    );

    $second = app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 500.0,
        externalId: 'qris-history-xyz', // same external_id
    );

    expect($second->id)->toBe($first->id);
    expect(Payment::where('external_id', 'qris-history-xyz')->count())->toBe(1);
});

it('partial installment payment marks specific schedule paid when scheduleId given', function () {
    $client = Client::create(['name' => 'Test']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'installment',
        'issue_date' => '2026-08-14',
        'installments' => ['count' => 3, 'first_due_date' => '2026-09-01', 'interval_days' => 30],
        'items' => [['description' => 'X', 'unit_price' => 600, 'product_id' => null]],
    ]);

    $schedule1 = $invoice->schedules->first();
    expect($schedule1->status)->toBe('pending');

    app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 200.0,
        externalId: 'qris-history-cicilan-1',
        scheduleId: $schedule1->id,
    );

    expect($schedule1->fresh()->status)->toBe('paid');
    expect($invoice->fresh()->status)->toBe('partial');
    expect((float) $invoice->fresh()->paid_amount)->toBe(200.0);
    // 2 schedule lain masih pending
    expect($invoice->fresh()->schedules->where('status', 'pending'))->toHaveCount(2);
});

it('records payment exceeding remaining (QRISLY unique_amount surcharge) and marks paid', function () {
    $client = Client::create(['name' => 'Test']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => '2026-08-14',
        'items' => [['description' => 'X', 'unit_price' => 100, 'product_id' => null]],
    ]);

    $payment = app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 103.0, // nominal real terbayar (final_amount, termaasukan unik)
        externalId: 'qris-history-surcharge',
    );

    expect($payment->status)->toBe('success');
    expect((float) $invoice->fresh()->paid_amount)->toBe(103.0);
    expect($invoice->fresh()->status)->toBe('paid');
});
