<?php

use App\Actions\Invoice\CreateInvoice;
use App\Models\Client;
use App\Models\Setting;
use App\Models\User;
use App\Support\InvoicePdf;
use App\Support\Terbilang;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');
    Setting::query()->updateOrCreate(['id' => 1], [
        'app_invoice_prefix' => 'INV',
        'company_name' => 'Studio Uji',
        'signer_name' => 'Budi Santoso',
        'signer_title' => 'Direktur',
    ]);
});

function pdfInvoice(string $status = 'sent')
{
    $client = Client::create(['name' => 'PT Klien']);
    $invoice = app(CreateInvoice::class)->execute([
        'client_id' => $client->id,
        'invoice_mode' => 'fixed',
        'type' => 'full',
        'issue_date' => now()->toDateString(),
        'tax_rate' => 11,
        'items' => [['description' => 'Jasa desain', 'unit_price' => 1000000]],
    ]);
    $invoice->update(['status' => $status]);

    return $invoice->fresh();
}

it('says amounts in Indonesian words', function () {
    expect(Terbilang::rupiah(0))->toBe('Nol Rupiah')
        ->and(Terbilang::rupiah(1110000))->toBe('Satu Juta Seratus Sepuluh Ribu Rupiah')
        ->and(Terbilang::rupiah(18981000))->toBe('Delapan Belas Juta Sembilan Ratus Delapan Puluh Satu Ribu Rupiah')
        ->and(Terbilang::rupiah(2000000000))->toBe('Dua Miliar Rupiah');
});

it('renders the pdf for every status', function (string $status) {
    $pdf = InvoicePdf::make(pdfInvoice($status))->output();

    expect($pdf)->toStartWith('%PDF')
        ->and(strlen($pdf))->toBeLessThan(300_000); // font subsetting aktif
})->with(['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']);

it('includes terms, signer and amount in words in the template', function () {
    $invoice = pdfInvoice();
    $html = view('pdf.invoice', [
        'invoice' => $invoice->load(['client', 'items.product', 'items.sessions', 'schedules']),
        'setting' => Setting::first(),
        'accent' => '#1e3a8a',
        'logo' => null,
        'signature' => null,
        'payQr' => InvoicePdf::qrDataUri($invoice->publicUrl()),
        'terms' => Setting::first()->invoiceTerms(),
        'amountInWords' => Terbilang::rupiah($invoice->total),
    ])->render();

    expect($html)->toContain('Syarat &amp; Ketentuan')
        ->and($html)->toContain('Budi Santoso')
        ->and($html)->toContain('Satu Juta Seratus Sepuluh Ribu Rupiah')
        ->and($html)->toContain('data:image/svg+xml;base64');
});

it('splits custom terms into numbered points', function () {
    $setting = Setting::first();
    $setting->invoice_terms = "1. Bayar tepat waktu\n\n- Sertakan nomor invoice\nGaransi 30 hari";

    expect($setting->invoiceTerms())->toBe(['Bayar tepat waktu', 'Sertakan nomor invoice', 'Garansi 30 hari']);

    $setting->invoice_terms = '';
    expect($setting->invoiceTerms())->not->toBeEmpty();
});

it('saves pdf branding settings with a signature upload', function () {
    $this->actingAs(User::factory()->create())
        ->post('/settings/invoice', [
            'app_invoice_prefix' => 'INV',
            'default_hourly_rate' => 100000,
            'pdf_accent_color' => '#0F766E',
            'pdf_watermark' => 'text',
            'pdf_watermark_text' => 'RAHASIA',
            'signer_name' => 'Siti',
            'signer_title' => 'Finance',
            'company_tax_id' => '01.234.567.8-901.000',
            'signature' => UploadedFile::fake()->image('ttd.png', 600, 200),
        ])
        ->assertSessionHasNoErrors();

    $setting = Setting::first();
    expect($setting->pdf_accent_color)->toBe('#0f766e')
        ->and($setting->pdf_watermark)->toBe('text')
        ->and($setting->signature_path)->toEndWith('.png');
    Storage::disk('public')->assertExists($setting->signature_path);
    expect(InvoicePdf::imageDataUri($setting->signature_path, 500, 200))->toStartWith('data:image/png;base64');
});

it('rejects an invalid accent color', function () {
    $this->actingAs(User::factory()->create())
        ->post('/settings/invoice', ['app_invoice_prefix' => 'INV', 'default_hourly_rate' => 1, 'pdf_accent_color' => 'red'])
        ->assertSessionHasErrors('pdf_accent_color');
});

it('streams a pdf preview even without any invoice', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('settings.invoice.pdf-preview'))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('previews unsaved settings without persisting anything', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('settings.invoice.pdf-preview'), [
            'company_name' => 'Nama Belum Disimpan',
            'pdf_accent_color' => '#6b21a8',
            'pdf_watermark' => 'none',
            'signer_name' => 'Penanda Baru',
            'signature' => UploadedFile::fake()->image('ttd.png', 400, 150),
        ])
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    $setting = Setting::first();
    expect($setting->company_name)->toBe('Studio Uji')
        ->and($setting->signer_name)->toBe('Budi Santoso')
        ->and($setting->signature_path)->toBeNull();
    expect(Storage::disk('public')->allFiles())->toBeEmpty();
});

it('reports validation errors on the unsaved preview as json', function () {
    $this->actingAs(User::factory()->create())
        ->postJson(route('settings.invoice.pdf-preview'), ['pdf_accent_color' => 'merah'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('pdf_accent_color');
});
