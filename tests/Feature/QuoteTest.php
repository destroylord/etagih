<?php

use App\Actions\Quote\CreateQuote;
use App\Mail\QuoteMail;
use App\Mail\QuoteRespondedMail;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Quote;
use App\Models\Setting;
use App\Models\User;
use App\Support\QuotePdf;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'company_name' => 'Studio Uji']);
    $this->withoutVite();
    Queue::fake();
    Mail::fake();
    config(['services.wa.api_key' => 'wa-key']);
    Http::fake(['api.fonnte.com/*' => Http::response(['status' => true])]);
    $this->admin = User::factory()->create();
    $this->actingAs($this->admin);
    $this->client = Client::create(['name' => 'PT Klien', 'email' => 'klien@example.com', 'phone' => '08123456789']);
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function quotePayload(Client $client, array $overrides = []): array
{
    return array_merge([
        'client_id' => $client->id,
        'issue_date' => now()->toDateString(),
        'valid_until' => now()->addDays(14)->toDateString(),
        'items' => [
            ['description' => 'Desain logo', 'quantity' => 2, 'unit_price' => 500000],
            ['description' => 'Hosting', 'quantity' => 1, 'unit_price' => 1000000],
        ],
    ], $overrides);
}

function makeQuote(Client $client, array $overrides = [], string $status = 'draft'): Quote
{
    $quote = app(CreateQuote::class)->execute(quotePayload($client, $overrides));
    if ($status !== 'draft') {
        $quote->update(['status' => $status]);
    }

    return $quote->fresh();
}

// --- Buat & ubah --------------------------------------------------------------

it('creates a quote with quantity, discount, PPN and PPh totals', function () {
    $this->post(route('quotes.store'), quotePayload($this->client, [
        'discount_type' => 'percent',
        'discount_value' => 10,
        'tax_rate' => 11,
        'pph_rate' => 2,
        'notes' => 'Catatan',
        'terms' => "1. DP 50%\n2. Revisi 2x",
    ]))->assertRedirect();

    $quote = Quote::with('items')->sole();

    // subtotal 2×500rb + 1jt = 2jt; diskon 10% = 200rb; DPP 1,8jt; PPN 198rb; PPh 36rb
    expect($quote->status)->toBe('draft')
        ->and((float) $quote->items[0]->quantity)->toBe(2.0)
        ->and((float) $quote->items[0]->line_total)->toBe(1000000.0)
        ->and((float) $quote->subtotal)->toBe(2000000.0)
        ->and((float) $quote->discount)->toBe(200000.0)
        ->and((float) $quote->tax_amount)->toBe(198000.0)
        ->and((float) $quote->pph_amount)->toBe(36000.0)
        ->and((float) $quote->total)->toBe(1962000.0)
        ->and($quote->terms)->toContain('DP 50%');
});

it('defaults valid_until to issue date + 14 days', function () {
    $quote = makeQuote($this->client, ['valid_until' => null, 'issue_date' => '2026-10-01']);

    expect($quote->valid_until->toDateString())->toBe('2026-10-15');
});

it('numbers quotes PNW-YYYYMMDD-XXXX sequentially', function () {
    $a = makeQuote($this->client);
    $b = makeQuote($this->client);
    $today = now()->format('Ymd');

    expect($a->quote_number)->toBe("PNW-{$today}-0001")
        ->and($b->quote_number)->toBe("PNW-{$today}-0002");
});

it('updates a draft quote and recalculates totals', function () {
    $quote = makeQuote($this->client);

    $this->put(route('quotes.update', $quote), quotePayload($this->client, [
        'items' => [['description' => 'Paket', 'quantity' => 3, 'unit_price' => 100000]],
        'tax_rate' => 11,
    ]))->assertRedirect(route('quotes.show', $quote));

    $quote->refresh();
    expect($quote->items)->toHaveCount(1)
        ->and((float) $quote->subtotal)->toBe(300000.0)
        ->and((float) $quote->total)->toBe(333000.0);
});

it('rejects editing a sent quote and a zero quantity', function () {
    $quote = makeQuote($this->client, status: 'sent');
    $this->put(route('quotes.update', $quote), quotePayload($this->client))->assertStatus(422);

    $this->post(route('quotes.store'), quotePayload($this->client, [
        'items' => [['description' => 'X', 'quantity' => 0, 'unit_price' => 1]],
    ]))->assertSessionHasErrors('items.0.quantity');
});

it('rejects a project of another client', function () {
    $other = Client::create(['name' => 'Lain']);
    $project = Project::create(['client_id' => $other->id, 'name' => 'Proyek lain', 'status' => 'active']);

    $this->post(route('quotes.store'), quotePayload($this->client, ['project_id' => $project->id]))
        ->assertSessionHasErrors('project_id');
});

// --- Halaman admin ----------------------------------------------------------

it('renders index with status counts, create, show and edit pages', function () {
    $quote = makeQuote($this->client);
    makeQuote($this->client, status: 'sent');

    $this->get(route('quotes.index', ['status' => 'sent']))->assertInertia(fn (Assert $page) => $page
        ->component('quotes/index')
        ->has('quotes.data', 1)
        ->where('statusCounts.draft', 1)
        ->where('statusCounts.sent', 1));

    $this->get(route('quotes.create'))->assertInertia(fn (Assert $page) => $page->component('quotes/create'));
    $this->get(route('quotes.show', $quote))->assertInertia(fn (Assert $page) => $page->component('quotes/show')->has('quote.items', 2));
    $this->get(route('quotes.edit', $quote))->assertInertia(fn (Assert $page) => $page->component('quotes/edit'));
});

it('lets staff users manage quotes', function () {
    $this->actingAs(User::factory()->state(['role' => 'staff'])->create());

    $this->get(route('quotes.index'))->assertOk();
    $this->post(route('quotes.store'), quotePayload($this->client))->assertRedirect();
    expect(Quote::count())->toBe(1);
});

// --- Kirim --------------------------------------------------------------------

it('sends a quote via email with pdf and whatsapp', function () {
    $quote = makeQuote($this->client);

    $this->post(route('quotes.send', $quote))->assertRedirect(route('quotes.show', $quote));

    expect($quote->fresh()->status)->toBe('sent')
        ->and($quote->fresh()->sent_at)->not->toBeNull();
    Mail::assertSent(QuoteMail::class, fn (QuoteMail $m) => $m->hasTo('klien@example.com'));
    Http::assertSent(fn ($r) => str_contains($r->url(), 'fonnte.com/send')
        && str_contains((string) $r['message'], '/q/'.$quote->public_token));
});

it('resends a sent quote', function () {
    $quote = makeQuote($this->client, status: 'sent');

    $this->post(route('quotes.send', $quote))->assertSessionHas('success');
    Mail::assertSent(QuoteMail::class);
    expect($quote->fresh()->status)->toBe('sent');
});

it('attaches a quote pdf that renders', function () {
    $quote = makeQuote($this->client, ['tax_rate' => 11, 'pph_rate' => 2, 'discount_value' => 50000, 'terms' => 'DP 50%'], 'sent');

    expect(substr(QuotePdf::make($quote)->output(), 0, 4))->toBe('%PDF');

    $response = $this->get(route('quotes.pdf', $quote));
    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('application/pdf');

    foreach (['draft', 'accepted', 'declined', 'expired'] as $status) {
        $quote->update(['status' => $status]);
        expect(substr(QuotePdf::make($quote->fresh())->output(), 0, 4))->toBe('%PDF');
    }
});

// --- Halaman publik ---------------------------------------------------------

it('hides draft quotes publicly but shows sent ones', function () {
    $draft = makeQuote($this->client);
    $sent = makeQuote($this->client, status: 'sent');

    auth()->logout();

    $this->get('/q/'.$draft->public_token)->assertNotFound();
    $this->get('/q/'.$sent->public_token)->assertInertia(fn (Assert $page) => $page
        ->component('quote/show')
        ->where('quote.quote_number', $sent->quote_number)
        ->where('canRespond', true)
        ->has('quote.items', 2));
});

it('lets the client accept a quote and notifies admins', function () {
    $quote = makeQuote($this->client, status: 'sent');
    auth()->logout();

    $this->post('/q/'.$quote->public_token.'/accept', ['name' => 'Budi', 'note' => 'Mulai minggu depan'])
        ->assertSessionHas('success');

    $quote->refresh();
    expect($quote->status)->toBe('accepted')
        ->and($quote->accepted_at)->not->toBeNull()
        ->and($quote->accepted_by)->toBe('Budi')
        ->and($quote->response_note)->toBe('Mulai minggu depan');
    Mail::assertSent(QuoteRespondedMail::class, fn ($m) => $m->hasTo($this->admin->email));

    // Tidak bisa dijawab dua kali.
    $this->post('/q/'.$quote->public_token.'/decline')->assertSessionHas('error');
    expect($quote->fresh()->status)->toBe('accepted');
});

it('lets the client decline a quote with a reason', function () {
    $quote = makeQuote($this->client, status: 'sent');
    auth()->logout();

    $this->post('/q/'.$quote->public_token.'/decline', ['reason' => 'Terlalu mahal'])->assertSessionHas('success');

    $quote->refresh();
    expect($quote->status)->toBe('declined')
        ->and($quote->declined_at)->not->toBeNull()
        ->and($quote->decline_reason)->toBe('Terlalu mahal');
    Mail::assertSent(QuoteRespondedMail::class);
});

it('rejects accepting an expired quote', function () {
    $quote = makeQuote($this->client, ['issue_date' => now()->subDays(20)->toDateString(), 'valid_until' => now()->subDay()->toDateString()], 'sent');
    auth()->logout();

    $this->get('/q/'.$quote->public_token)->assertInertia(fn (Assert $page) => $page->where('canRespond', false));
    $this->post('/q/'.$quote->public_token.'/accept')->assertSessionHas('error');

    expect($quote->fresh()->status)->toBe('sent');
    Mail::assertNotSent(QuoteRespondedMail::class);
});

it('lets admins mark a quote accepted or declined manually', function () {
    $quote = makeQuote($this->client, status: 'sent');

    $this->put(route('quotes.update', $quote), ['mark_as' => 'declined', 'reason' => 'Via telepon'])->assertSessionHas('success');
    expect($quote->fresh()->status)->toBe('declined');

    $this->put(route('quotes.update', $quote), ['mark_as' => 'accepted'])->assertSessionHas('success');
    expect($quote->fresh()->status)->toBe('accepted');
    Mail::assertNotSent(QuoteRespondedMail::class);

    $draft = makeQuote($this->client);
    $this->put(route('quotes.update', $draft), ['mark_as' => 'accepted'])->assertSessionHas('error');
});

// --- Ubah jadi invoice ------------------------------------------------------

it('converts an accepted quote into a draft invoice with the same total', function () {
    $project = Project::create(['client_id' => $this->client->id, 'name' => 'Website', 'status' => 'active']);
    $quote = makeQuote($this->client, [
        'project_id' => $project->id,
        'discount_type' => 'amount',
        'discount_value' => 100000,
        'tax_rate' => 11,
        'pph_rate' => 2,
    ], 'accepted');

    $response = $this->post(route('quotes.convert', $quote));

    $invoice = Invoice::with('items')->sole();
    $response->assertRedirect(route('invoices.edit', $invoice));

    expect($invoice->status)->toBe('draft')
        ->and($invoice->project_id)->toBe($project->id)
        ->and((float) $invoice->total)->toBe((float) $quote->total)
        ->and((float) $invoice->tax_rate)->toBe(11.0)
        ->and((float) $invoice->pph_rate)->toBe(2.0)
        ->and($invoice->items)->toHaveCount(2)
        ->and((float) $invoice->items[0]->unit_price)->toBe(1000000.0)
        ->and($invoice->items[0]->description)->toBe('Desain logo (2 × Rp 500.000)')
        ->and($invoice->items[1]->description)->toBe('Hosting')
        ->and($invoice->notes)->toContain($quote->quote_number);

    $quote->refresh();
    expect($quote->status)->toBe('converted')
        ->and($quote->converted_invoice_id)->toBe($invoice->id);

    // Idempotent: konversi kedua mengarah ke invoice yang sama.
    $this->post(route('quotes.convert', $quote))->assertRedirect(route('invoices.edit', $invoice));
    expect(Invoice::count())->toBe(1);
});

it('does not convert draft or declined quotes', function () {
    $draft = makeQuote($this->client);
    $this->post(route('quotes.convert', $draft))->assertSessionHas('error');

    $declined = makeQuote($this->client, status: 'declined');
    $this->post(route('quotes.convert', $declined))->assertSessionHas('error');

    expect(Invoice::count())->toBe(0);
});

// --- Duplikat, hapus, kedaluwarsa ----------------------------------------------

it('duplicates a quote as a new draft', function () {
    $quote = makeQuote($this->client, ['tax_rate' => 11], 'declined');

    $this->post(route('quotes.duplicate', $quote))->assertRedirect();

    $copy = Quote::latest('id')->first();
    expect($copy->id)->not->toBe($quote->id)
        ->and($copy->status)->toBe('draft')
        ->and((float) $copy->total)->toBe((float) $quote->total)
        ->and($copy->items)->toHaveCount(2);
});

it('deletes only draft quotes', function () {
    $sent = makeQuote($this->client, status: 'sent');
    $this->delete(route('quotes.destroy', $sent))->assertStatus(422);

    $draft = makeQuote($this->client);
    $this->delete(route('quotes.destroy', $draft))->assertRedirect(route('quotes.index'));
    expect(Quote::find($draft->id))->toBeNull();
});

it('expires sent quotes past their validity', function () {
    $old = makeQuote($this->client, ['issue_date' => now()->subDays(20)->toDateString(), 'valid_until' => now()->subDay()->toDateString()], 'sent');
    $fresh = makeQuote($this->client, status: 'sent');
    $draft = makeQuote($this->client, ['issue_date' => now()->subDays(20)->toDateString(), 'valid_until' => now()->subDay()->toDateString()]);

    $this->artisan('quotes:expire')->assertSuccessful();

    expect($old->fresh()->status)->toBe('expired')
        ->and($fresh->fresh()->status)->toBe('sent')
        ->and($draft->fresh()->status)->toBe('draft');
});
