<?php

use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\QrisAccount;
use App\Models\Setting;
use App\Models\User;
use App\Support\QrisStyle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'company_name' => 'Toko Uji']);
    config(['services.qrisly.api_key' => 'test-key', 'services.qrisly.merchant_id' => null]);
    $this->actingAs(User::factory()->create());
});

function fakeUpload(string $qrisId = '9d6c9f9e-8c33-4f42-8b1f-0e6a3e2e7d10'): void
{
    Http::fake(['*/upload-qris' => Http::response(['success' => true, 'data' => [
        'qris_id' => $qrisId, 'provider' => 'DANA', 'name' => 'QRIS Utama', 'merchant_name' => 'TOKO UJI',
    ]])]);
}

it('uploads a qris to qrisly and makes the first one active', function () {
    fakeUpload();

    $this->post(route('qris.store'), [
        'name' => 'QRIS Utama',
        'qris_image' => UploadedFile::fake()->image('qris.png', 600, 600),
    ])->assertSessionHasNoErrors()->assertSessionHas('success');

    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/api/v1/qrisly/upload-qris')
        && $r->hasHeader('x-api-key', 'test-key')
        && $r->isMultipart()
        && str_contains($r->header('Content-Type')[0] ?? '', 'multipart/form-data'));

    $qris = QrisAccount::first();
    expect($qris->qris_id)->toBe('9d6c9f9e-8c33-4f42-8b1f-0e6a3e2e7d10')
        ->and($qris->provider)->toBe('DANA')
        ->and($qris->is_active)->toBeTrue();
    Storage::disk('public')->assertExists($qris->image_path);
});

it('shows the qrisly error on the upload field when the gateway rejects it', function () {
    Http::fake(['*/upload-qris' => Http::response(['message' => 'Invalid QRIS image', 'code' => 400, 'status' => 'error'], 400)]);

    $this->post(route('qris.store'), [
        'name' => 'QRIS Rusak',
        'qris_image' => UploadedFile::fake()->image('qris.png'),
    ])->assertSessionHasErrors(['qris_image' => 'QRISLY: Invalid QRIS image']);

    expect(QrisAccount::count())->toBe(0);
});

it('switches the active qris and reassigns it when the active one is deleted', function () {
    $a = QrisAccount::create(['qris_id' => 'a', 'name' => 'A', 'is_active' => true]);
    $b = QrisAccount::create(['qris_id' => 'b', 'name' => 'B']);

    $this->post(route('qris.activate', $b));
    expect($a->fresh()->is_active)->toBeFalse()->and($b->fresh()->is_active)->toBeTrue();

    $this->delete(route('qris.destroy', $b));
    expect($a->fresh()->is_active)->toBeTrue();
});

it('generates payments with the active qris id', function () {
    QrisAccount::create(['qris_id' => 'aktif-123', 'name' => 'Aktif', 'is_active' => true]);
    Http::fake(['*/generate-qris' => Http::response(['data' => [
        'history_id' => 'h1', 'qris_string' => QrisStyle::SAMPLE_PAYLOAD, 'final_amount' => 100003, 'expiry_time' => now()->addMinutes(10)->toIso8601String(),
    ]])]);

    $client = Client::create(['name' => 'Klien']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id, 'invoice_mode' => 'fixed', 'type' => 'full',
        'issue_date' => now()->toDateString(), 'items' => [['description' => 'X', 'unit_price' => 100000]],
    ]);
    $invoice->update(['status' => 'sent']);

    $this->postJson(route('pay.pay', $invoice->public_token))
        ->assertOk()
        ->assertJsonPath('history_id', 'h1')
        ->assertJson(fn ($json) => $json->where('qris_svg', fn ($svg) => str_starts_with($svg, '<svg') && str_contains($svg, 'Rp 100.003'))->etc());

    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/generate-qris') && $r['qris_id'] === 'aktif-123');
});

it('saves the qris style and renders a live preview', function () {
    $style = ['fg_color' => '#134e4a', 'bg_color' => '#ffffff', 'module' => 'rounded', 'eye' => 'circle', 'frame' => 'card', 'frame_color' => '#0f766e', 'title' => 'Kopi Senja', 'show_amount' => '1'];

    $this->postJson(route('qris.preview'), ['style' => $style])
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('svg', fn ($svg) => str_contains($svg, 'Kopi Senja') && str_contains($svg, '#0f766e'))->etc());

    $this->post('/settings/invoice', ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 1, 'qris_style' => $style])
        ->assertSessionHasNoErrors();

    $saved = QrisStyle::fromSetting(Setting::first());
    expect($saved['module'])->toBe('rounded')->and($saved['title'])->toBe('Kopi Senja');
});

it('rejects a low-contrast qr style', function () {
    $this->post('/settings/invoice', [
        'app_invoice_prefix' => 'INV', 'default_hourly_rate' => 1,
        'qris_style' => ['fg_color' => '#dddddd', 'bg_color' => '#ffffff'],
    ])->assertSessionHasErrors('qris_style.bg_color');
});

it('renders every qr style combination as valid svg', function (string $module, string $eye, string $frame) {
    $svg = QrisStyle::cardSvg(QrisStyle::SAMPLE_PAYLOAD, QrisStyle::normalize(['module' => $module, 'eye' => $eye, 'frame' => $frame, 'logo' => 'company']), 50000, 'Toko', 'data:image/png;base64,AAAA');

    expect(simplexml_load_string($svg))->not->toBeFalse();
})->with(['square', 'rounded', 'dots'])->with(['square', 'rounded', 'circle'])->with(['none', 'simple', 'card']);
