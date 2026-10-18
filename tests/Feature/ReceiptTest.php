<?php

use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\RecordPayment;
use App\Jobs\SendPaymentReceivedNotification;
use App\Mail\ReceiptMail;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Services\WhatsAppService;
use App\Support\ReceiptPdf;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], [
        'app_invoice_prefix' => 'INV',
        'company_name' => 'Studio Uji',
        'signer_name' => 'Budi Santoso',
    ]);
    Queue::fake();
});

function receiptInvoice(float $amount = 1_000_000, array $overrides = []): Invoice
{
    $client = Client::create(['name' => 'PT Klien Kuitansi', 'email' => 'finance@klien.test']);
    $invoice = app(CreateInvoice::class)->execute(array_merge([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'items' => [['description' => 'Jasa desain', 'unit_price' => $amount]],
    ], $overrides));
    $invoice->update(['status' => 'sent']);

    return $invoice->fresh();
}

function receiptHtml(Payment $payment, ?Setting $setting = null): string
{
    $setting ??= Setting::first();
    $payment->load(['invoice.client', 'invoice.project', 'schedule']);

    return view('pdf.receipt', [
        'payment' => $payment,
        'invoice' => $payment->invoice,
        'setting' => $setting,
        'accent' => '#1e3a8a',
        'logo' => null,
        'signature' => null,
        'amountInWords' => 'x',
        'needsStamp' => ReceiptPdf::needsStamp((float) $payment->amount, $setting),
    ])->render();
}

// --- Penomoran ----------------------------------------------------------------

it('assigns sequential receipt numbers to successful payments', function () {
    CarbonImmutable::setTestNow('2026-10-18 10:00:00');
    $invoice = receiptInvoice(900_000);
    $record = app(RecordPayment::class);

    $first = $record->execute(invoice: $invoice, amount: 300_000, method: 'manual');
    $second = $record->execute(invoice: $invoice, amount: 300_000, externalId: 'hist-1');

    expect($first->receipt_number)->toBe('KWT-20261018-0001')
        ->and($second->receipt_number)->toBe('KWT-20261018-0002');

    // Idempoten: webhook berulang tidak membuat nomor baru.
    $again = $record->execute(invoice: $invoice, amount: 300_000, externalId: 'hist-1');
    expect($again->receipt_number)->toBe('KWT-20261018-0002');
    CarbonImmutable::setTestNow();
});

it('does not number pending payments and keeps counting from the database when cache is lost', function () {
    CarbonImmutable::setTestNow('2026-10-18 10:00:00');
    $invoice = receiptInvoice(900_000);
    $record = app(RecordPayment::class);

    $pending = $record->execute(invoice: $invoice, amount: 300_000, externalId: 'hist-p', status: 'pending');
    expect($pending->receipt_number)->toBeNull();

    $record->execute(invoice: $invoice, amount: 300_000, method: 'manual');
    cache()->flush();
    $next = $record->execute(invoice: $invoice, amount: 300_000, method: 'manual');

    expect($next->receipt_number)->toBe('KWT-20261018-0002');
    CarbonImmutable::setTestNow();
});

it('numbers backdated manual payments by their payment date', function () {
    $invoice = receiptInvoice();

    $payment = app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 100_000,
        method: 'manual',
        paidAt: CarbonImmutable::parse('2026-10-01 09:00'),
    );

    expect($payment->receipt_number)->toBe('KWT-20261001-0001');
});

it('assigns a receipt number via the QRIS webhook path', function () {
    $invoice = receiptInvoice(200_000);
    Payment::create([
        'invoice_id' => $invoice->id,
        'amount' => 200_000,
        'method' => 'qris',
        'external_id' => 'hist-wh',
        'status' => 'pending',
    ]);

    config(['services.qrisly.api_key' => 'test-key']);
    Http::fake(['*/payment-status/hist-wh' => Http::response(['data' => ['history_id' => 'hist-wh', 'payment_status' => 'paid', 'amount' => 200_000]])]);

    $this->postJson('/webhook/qrisly', [
        'event' => 'payment.success',
        'data' => ['qris_history_id' => 'hist-wh', 'amount' => 200_000, 'status' => 'paid'],
    ])->assertOk();

    expect(Payment::firstWhere('external_id', 'hist-wh')->receipt_number)
        ->toStartWith('KWT-')
        ->toEndWith('-0001');
});

it('backfills receipt numbers for existing successful payments ordered by paid_at', function () {
    $invoice = receiptInvoice();
    $make = fn (string $paidAt, string $status = 'success') => Payment::create([
        'invoice_id' => $invoice->id,
        'amount' => 1000,
        'method' => 'manual',
        'status' => $status,
        'paid_at' => $status === 'success' ? $paidAt : null,
    ]);
    $late = $make('2026-09-02 15:00');
    $early = $make('2026-09-02 08:00');
    $otherDay = $make('2026-09-05 10:00');
    $pending = $make('2026-09-02 09:00', 'pending');

    $migration = require database_path('migrations/2026_10_18_130000_add_receipt_number_to_payments_table.php');
    $migration->down();
    $migration->up();

    expect($early->fresh()->receipt_number)->toBe('KWT-20260902-0001')
        ->and($late->fresh()->receipt_number)->toBe('KWT-20260902-0002')
        ->and($otherDay->fresh()->receipt_number)->toBe('KWT-20260905-0001')
        ->and($pending->fresh()->receipt_number)->toBeNull();
});

// --- Unduh ----------------------------------------------------------------------

it('lets the admin download a receipt pdf', function () {
    $invoice = receiptInvoice();
    $payment = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1_000_000, method: 'manual');

    $response = $this->actingAs(User::factory()->create())
        ->get(route('payments.receipt', $payment))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    expect($response->getContent())->toStartWith('%PDF');
});

it('returns 404 for the admin download of a pending payment', function () {
    $invoice = receiptInvoice();
    $payment = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1000, externalId: 'p-1', status: 'pending');

    $this->actingAs(User::factory()->create())
        ->get(route('payments.receipt', $payment))
        ->assertNotFound();
});

it('requires login for the admin receipt route', function () {
    $invoice = receiptInvoice();
    $payment = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1000, method: 'manual');

    $this->get(route('payments.receipt', $payment))->assertRedirect();
});

it('lets the client download receipts of their own invoice only', function () {
    $invoice = receiptInvoice();
    $other = receiptInvoice();
    $payment = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1000, method: 'manual');
    $pending = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1000, externalId: 'p-2', status: 'pending');

    $response = $this->get(route('pay.receipt', [$invoice->public_token, $payment]))->assertOk();
    expect($response->getContent())->toStartWith('%PDF');

    $this->get(route('pay.receipt', [$other->public_token, $payment]))->assertNotFound();
    $this->get(route('pay.receipt', [$invoice->public_token, $pending]))->assertNotFound();
    $this->get(route('pay.receipt', ['token-salah', $payment]))->assertNotFound();
});

// --- Isi kuitansi & bea meterai -----------------------------------------------

it('renders receipt details', function () {
    $invoice = receiptInvoice(900_000, [
        'type' => 'installment',
        'installments' => ['count' => 3, 'first_due_date' => now()->addMonth()->toDateString(), 'interval_days' => 30],
    ]);
    $payment = app(RecordPayment::class)->execute(
        invoice: $invoice,
        amount: 300_000,
        scheduleId: $invoice->schedules[1]->id,
        method: 'manual',
        notes: 'Bayar tunai di kantor',
    );

    $html = receiptHtml($payment);

    expect($html)->toContain('KUITANSI')
        ->toContain($payment->receipt_number)
        ->toContain('Telah terima dari')
        ->toContain('PT Klien Kuitansi')
        ->toContain($invoice->invoice_number)
        ->toContain('cicilan ke-2 dari 3')
        ->toContain('Tunai')
        ->toContain('Rp 300.000');
});

it('shows the e-meterai box only above Rp5 juta and when enabled', function () {
    $small = app(RecordPayment::class)->execute(invoice: receiptInvoice(5_000_000), amount: 5_000_000, method: 'manual');
    $big = app(RecordPayment::class)->execute(invoice: receiptInvoice(5_000_001), amount: 5_000_001, method: 'manual');

    expect(receiptHtml($small))->not->toContain('e-Meterai')
        ->and(receiptHtml($big))->toContain('e-Meterai');

    Setting::query()->update(['stamp_duty_enabled' => false]);
    expect(receiptHtml($big, Setting::first()))->not->toContain('e-Meterai');
});

it('saves the stamp duty setting', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('settings.invoice.update'), [
            'app_invoice_prefix' => 'INV',
            'default_hourly_rate' => 0,
            'stamp_duty_enabled' => '0',
        ])
        ->assertSessionHasNoErrors();

    expect(Setting::first()->stamp_duty_enabled)->toBeFalse();
});

// --- Email ----------------------------------------------------------------------

it('emails the receipt to the client after a successful payment', function () {
    Mail::fake();
    $this->mock(WhatsAppService::class)->shouldReceive('sendPaymentReceived');

    $payment = app(RecordPayment::class)->execute(invoice: receiptInvoice(), amount: 1000, method: 'manual');
    $job = new SendPaymentReceivedNotification($payment);
    $job->handle(app(WhatsAppService::class));
    // Job yang sama terpanggil lagi (mis. webhook berulang) → tidak kirim dobel.
    $job->handle(app(WhatsAppService::class));

    Mail::assertSent(ReceiptMail::class, 1);
    Mail::assertSent(ReceiptMail::class, fn (ReceiptMail $mail) => $mail->hasTo('finance@klien.test')
        && $mail->payment->is($payment)
        && count($mail->attachments()) === 1);
});

it('skips the receipt email without a client email or for pending payments', function () {
    Mail::fake();
    $this->mock(WhatsAppService::class)->shouldReceive('sendPaymentReceived');

    $invoice = receiptInvoice();
    $pending = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1000, externalId: 'p-3', status: 'pending');
    (new SendPaymentReceivedNotification($pending))->handle(app(WhatsAppService::class));

    $invoice->client->update(['email' => null]);
    $paid = app(RecordPayment::class)->execute(invoice: $invoice, amount: 1000, method: 'manual');
    (new SendPaymentReceivedNotification($paid))->handle(app(WhatsAppService::class));

    Mail::assertNothingSent();
});

it('never throws when the receipt email fails', function () {
    Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP down'));
    $this->mock(WhatsAppService::class)->shouldReceive('sendPaymentReceived');

    $payment = app(RecordPayment::class)->execute(invoice: receiptInvoice(), amount: 1000, method: 'manual');

    (new SendPaymentReceivedNotification($payment))->handle(app(WhatsAppService::class));
})->throwsNoExceptions();

// --- PPh 23 ----------------------------------------------------------------------

it('accepts pph_rate on store and exposes it to the pay page', function () {
    $client = Client::create(['name' => 'PT Badan Usaha']);

    $this->actingAs(User::factory()->create())
        ->post(route('invoices.store'), [
            'client_id' => $client->id,
            'invoice_mode' => 'fixed',
            'type' => 'full',
            'issue_date' => now()->toDateString(),
            'tax_rate' => 11,
            'pph_rate' => 2,
            'items' => [['description' => 'Jasa konsultasi', 'unit_price' => 10_000_000]],
        ])
        ->assertSessionHasNoErrors();

    $invoice = Invoice::firstWhere('client_id', $client->id);
    expect((float) $invoice->pph_rate)->toBe(2.0)
        ->and((float) $invoice->pph_amount)->toBe(200_000.0)
        ->and((float) $invoice->total)->toBe(10_900_000.0)
        ->and($invoice->grossTotal())->toBe(11_100_000.0);

    $invoice->update(['status' => 'sent']);
    auth()->logout();

    $this->get(route('pay.show', $invoice->public_token))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('pay/show')
            ->where('invoice.pph_rate', '2.00')
            ->where('invoice.pph_amount', '200000.00')
            ->where('invoice.total', '10900000.00'));
});

it('rejects a pph_rate above 15%', function () {
    $client = Client::create(['name' => 'PT Badan Usaha']);

    $this->actingAs(User::factory()->create())
        ->post(route('invoices.store'), [
            'client_id' => $client->id,
            'invoice_mode' => 'fixed',
            'type' => 'full',
            'issue_date' => now()->toDateString(),
            'pph_rate' => 20,
            'items' => [['description' => 'Jasa', 'unit_price' => 1000]],
        ])
        ->assertSessionHasErrors('pph_rate');
});
