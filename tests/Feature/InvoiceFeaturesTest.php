<?php

use App\Actions\Invoice\CreateInvoice;
use App\Mail\InvoiceMail;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV']);
    Queue::fake();
    Mail::fake();
    config(['services.qrisly.api_key' => 'test-key', 'services.qrisly.merchant_id' => '12345', 'services.wa.api_key' => 'wa-key']);
    Http::fake(['api.fonnte.com/*' => Http::response(['status' => true])]);
    $this->actingAs(User::factory()->create());
});

function makeInvoice(array $overrides = []): Invoice
{
    $client = Client::create(['name' => 'PT Uji', 'email' => 'klien@example.com', 'phone' => '08123456789']);

    return app(CreateInvoice::class)->execute(array_merge([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(14)->toDateString(),
        'items' => [['description' => 'Jasa', 'unit_price' => 1000000]],
    ], $overrides));
}

// --- Pajak & diskon ---------------------------------------------------------

it('applies percent discount then tax on the discounted base', function () {
    $invoice = makeInvoice(['discount_type' => 'percent', 'discount_value' => 10, 'tax_rate' => 11]);

    expect((float) $invoice->subtotal)->toBe(1000000.0)
        ->and((float) $invoice->discount)->toBe(100000.0)
        ->and((float) $invoice->tax_amount)->toBe(99000.0)
        ->and((float) $invoice->total)->toBe(999000.0);
});

it('caps a nominal discount at the subtotal', function () {
    $invoice = makeInvoice(['discount_type' => 'amount', 'discount_value' => 5000000]);

    expect((float) $invoice->discount)->toBe(1000000.0)
        ->and((float) $invoice->total)->toBe(0.0);
});

// --- Kirim (WA + email) -----------------------------------------------------

it('sends invoice by email with pdf and by whatsapp', function () {
    $invoice = makeInvoice();

    $this->post(route('invoices.send', $invoice))->assertRedirect();

    expect($invoice->fresh()->status)->toBe('sent');
    Mail::assertSent(InvoiceMail::class, fn ($m) => $m->hasTo('klien@example.com'));
    Http::assertSent(fn ($r) => str_contains($r->url(), 'fonnte.com/send'));
});

it('can resend a sent invoice but not a draft', function () {
    $invoice = makeInvoice();
    $this->post(route('invoices.resend', $invoice))->assertSessionHas('error');

    $invoice->update(['status' => 'sent']);
    $this->post(route('invoices.resend', $invoice))->assertSessionHas('success');
    Mail::assertSent(InvoiceMail::class);
});

// --- Pembayaran manual ------------------------------------------------------

it('records a manual payment and marks invoice paid', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'sent']);

    $this->post(route('invoices.payments.store', $invoice), [
        'amount' => 1000000,
        'paid_at' => now()->toDateString(),
        'notes' => 'Transfer BCA',
    ])->assertSessionHas('success');

    $payment = Payment::first();
    expect($payment->method)->toBe('manual')
        ->and($payment->notes)->toBe('Transfer BCA')
        ->and($invoice->fresh()->status)->toBe('paid');
});

it('rejects manual payment above remaining or on a draft', function () {
    $invoice = makeInvoice();
    $this->post(route('invoices.payments.store', $invoice), ['amount' => 10, 'paid_at' => now()->toDateString()])
        ->assertSessionHas('error');

    $invoice->update(['status' => 'sent']);
    $this->post(route('invoices.payments.store', $invoice), ['amount' => 2000000, 'paid_at' => now()->toDateString()])
        ->assertSessionHasErrors('amount');
    expect(Payment::count())->toBe(0);
});

// --- Batal (void) -----------------------------------------------------------

it('cancels an unpaid sent invoice, expires qris and releases sessions', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'sent']);
    Payment::create(['invoice_id' => $invoice->id, 'amount' => 1000000, 'method' => 'qris', 'external_id' => 'h1', 'status' => 'pending']);
    $session = WorkSession::create([
        'client_id' => $invoice->client_id, 'invoice_id' => $invoice->id, 'description' => 'x',
        'unit_price' => 1, 'started_at' => now(), 'duration_seconds' => 900, 'status' => 'billed',
    ]);

    $this->post(route('invoices.cancel', $invoice), ['reason' => 'Salah harga'])->assertSessionHas('success');

    expect($invoice->fresh()->status)->toBe('cancelled')
        ->and($invoice->fresh()->cancel_reason)->toBe('Salah harga')
        ->and(Payment::first()->status)->toBe('expired')
        ->and($session->fresh()->status)->toBe('completed');

    // Halaman bayar menolak pembayaran.
    $this->postJson(route('pay.pay', $invoice->public_token))->assertStatus(422);
});

it('refuses to cancel an invoice that already received payment', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'partial', 'paid_amount' => 100]);

    $this->post(route('invoices.cancel', $invoice))->assertSessionHas('error');
    expect($invoice->fresh()->status)->toBe('partial');
});

// --- Duplikat & berulang ----------------------------------------------------

it('duplicates an invoice as a new draft', function () {
    $invoice = makeInvoice(['tax_rate' => 11]);
    $invoice->update(['status' => 'paid']);

    $this->post(route('invoices.duplicate', $invoice))->assertRedirect();

    $copy = Invoice::latest('id')->first();
    expect($copy->id)->not->toBe($invoice->id)
        ->and($copy->status)->toBe('draft')
        ->and($copy->invoice_number)->not->toBe($invoice->invoice_number)
        ->and((float) $copy->total)->toBe((float) $invoice->total)
        ->and($copy->items)->toHaveCount(1);
});

it('generates recurring invoices when the next date arrives', function () {
    $invoice = makeInvoice(['recurrence' => 'monthly', 'recurrence_auto_send' => true]);
    $this->post(route('invoices.send', $invoice));

    expect($invoice->fresh()->recurrence_next_date->toDateString())->toBe(now()->addMonthNoOverflow()->toDateString());

    $this->travel(32)->days();
    $this->artisan('invoices:generate-recurring')->assertSuccessful();

    $child = Invoice::where('recurring_parent_id', $invoice->id)->first();
    expect($child)->not->toBeNull()
        ->and($child->status)->toBe('sent')
        ->and($invoice->fresh()->recurrence_next_date->gt(now()))->toBeTrue();

    // Run kedua di hari yang sama tidak membuat duplikat.
    $this->artisan('invoices:generate-recurring');
    expect(Invoice::where('recurring_parent_id', $invoice->id)->count())->toBe(1);
});

// --- Klien ------------------------------------------------------------------

it('blocks deleting a client that still has invoices', function () {
    $invoice = makeInvoice();

    $this->delete(route('clients.destroy', $invoice->client_id))->assertSessionHas('error');
    expect(Client::find($invoice->client_id))->not->toBeNull();
});

it('stores the portal key hashed and regenerating invalidates the old key', function () {
    $client = Client::create(['name' => 'Portal', 'access_key' => 'kunci-lama-123']);

    expect($client->fresh()->getAttributes())->not->toHaveKey('access_key')
        ->and($client->fresh()->access_key_hash)->toBe(hash('sha256', 'kunci-lama-123'))
        ->and($client->fresh()->toArray())->not->toHaveKey('access_key_hash');

    $this->post(route('clients.access-key', $client))->assertSessionHas('access_key');

    expect(Client::findByAccessKey('kunci-lama-123'))->toBeNull();
});

// --- Webhook ----------------------------------------------------------------

it('ignores a forged webhook when the gateway says unpaid', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'sent']);
    Payment::create(['invoice_id' => $invoice->id, 'amount' => 1000000, 'method' => 'qris', 'external_id' => 'h-forged', 'status' => 'pending']);
    Http::fake(['*/payment-status/h-forged' => Http::response(['data' => ['payment_status' => 'unpaid', 'amount' => 0]])]);

    $this->postJson('/webhook/qrisly', ['data' => ['qris_history_id' => 'h-forged', 'status' => 'paid', 'amount' => 1000000]])
        ->assertOk();

    expect($invoice->fresh()->status)->toBe('sent')
        ->and((float) $invoice->fresh()->paid_amount)->toBe(0.0);
});

// --- Halaman bayar ----------------------------------------------------------

it('hides draft invoices from the public and blocks payment', function () {
    $invoice = makeInvoice();
    auth()->logout();

    $this->get(route('pay.show', $invoice->public_token))->assertNotFound();
    $this->postJson(route('pay.pay', $invoice->public_token))->assertStatus(422);
});

it('generates a qris for a payable invoice and reuses the pending one', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'sent']);
    Http::fake(['*/generate-qris' => Http::response(['data' => [
        'history_id' => 'hist-1', 'qris_string' => '000201...', 'final_amount' => 1000003, 'expiry_time' => now()->addMinutes(10)->toIso8601String(),
    ]])]);

    $this->postJson(route('pay.pay', $invoice->public_token))->assertOk()->assertJson(['history_id' => 'hist-1']);
    $this->postJson(route('pay.pay', $invoice->public_token))->assertOk()->assertJson(['history_id' => 'hist-1']);

    expect(Payment::where('status', 'pending')->count())->toBe(1);
});

it('status polling reconciles a pending qris with the gateway', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'sent']);
    Payment::create(['invoice_id' => $invoice->id, 'amount' => 1000000, 'method' => 'qris', 'external_id' => 'h-poll', 'status' => 'pending']);
    Http::fake(['*/payment-status/h-poll' => Http::response(['data' => ['payment_status' => 'paid', 'amount' => 1000000]])]);

    $this->getJson(route('pay.status', $invoice->public_token))->assertOk()->assertJson(['paid' => true]);
});

// --- Laporan ----------------------------------------------------------------

it('renders reports and exports invoices to excel', function () {
    $invoice = makeInvoice();
    $invoice->update(['status' => 'overdue', 'due_date' => now()->subDays(40)]);

    $this->get(route('reports.index'))->assertOk()->assertInertia(fn ($page) => $page
        ->component('reports/index')
        ->has('revenue', 12)
        ->where('aging.2.key', '31_60')
        ->where('aging.2.count', 1));

    $this->get(route('invoices.export', ['status' => 'overdue']))
        ->assertOk()
        ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('withholds PPh 23 from the amount the client pays', function () {
    $invoice = makeInvoice(['discount_type' => 'amount', 'discount_value' => 100000, 'tax_rate' => 11, 'pph_rate' => 2]);

    // DPP 900.000, PPN 99.000, PPh 18.000 → dibayar 981.000
    expect((float) $invoice->pph_amount)->toBe(18000.0)
        ->and((float) $invoice->total)->toBe(981000.0)
        ->and($invoice->grossTotal())->toBe(999000.0)
        ->and($invoice->remainingAmount())->toBe(981000.0);

    $html = view('pdf.invoice', [
        'invoice' => $invoice->load(['client', 'items.product', 'items.sessions', 'schedules']),
        'setting' => Setting::first(), 'accent' => '#1e3a8a', 'logo' => null, 'signature' => null,
        'payQr' => null, 'terms' => [], 'amountInWords' => '',
    ])->render();
    expect($html)->toContain('PPh 23 (2%) dipotong klien')->and($html)->toContain('TOTAL DIBAYAR');
});
