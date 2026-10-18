<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\StoreSettingsRequest;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\QrisAccount;
use App\Models\Setting;
use App\Support\InvoicePdf;
use App\Support\QrisStyle;
use App\Support\Settings;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;

class SettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/invoice', [
            'settings' => Settings::current(),
            'defaultTerms' => Setting::DEFAULT_TERMS,
            'qrisStyle' => QrisStyle::fromSetting(Settings::current()),
            'qrisAccounts' => QrisAccount::query()->latest('id')->get()->map(fn (QrisAccount $q) => [
                'id' => $q->id,
                'qris_id' => $q->qris_id,
                'name' => $q->name,
                'provider' => $q->provider,
                'merchant_name' => $q->merchant_name,
                'image_url' => $q->imageUrl(),
                'is_active' => $q->is_active,
                'created_at' => $q->created_at?->toIso8601String(),
            ]),
            // Fallback .env dipakai bila belum ada QRIS yang di-upload.
            'qrisEnvFallback' => (string) config('services.qrisly.merchant_id') !== '',
        ]);
    }

    public function update(StoreSettingsRequest $request): RedirectResponse
    {
        $data = $request->validated();
        unset($data['company_logo'], $data['signature']);

        if ($request->hasFile('company_logo')) {
            $newPath = $this->processLogo($request->file('company_logo'));
            $this->deleteStored(Settings::current()->company_logo_path);
            $data['company_logo_path'] = $newPath;
        } elseif ($request->boolean('remove_logo')) {
            $this->deleteStored(Settings::current()->company_logo_path);
            $data['company_logo_path'] = null;
        }

        if ($request->hasFile('signature')) {
            $newPath = $this->processSignature($request->file('signature'));
            $this->deleteStored(Settings::current()->signature_path);
            $data['signature_path'] = $newPath;
        } elseif ($request->boolean('remove_signature')) {
            $this->deleteStored(Settings::current()->signature_path);
            $data['signature_path'] = null;
        }

        $data['pdf_accent_color'] = strtolower($data['pdf_accent_color'] ?? '#1e3a8a');
        $data['pdf_watermark'] ??= 'logo';
        if (array_key_exists('qris_style', $data)) {
            $data['qris_style'] = QrisStyle::normalize(is_array($data['qris_style']) ? $data['qris_style'] : null);
        }

        $data['default_tax_rate'] = (float) ($data['default_tax_rate'] ?? 0);
        $data['reminder_interval_days'] = (int) ($data['reminder_interval_days'] ?? 3);
        $data['reminder_max_count'] = (int) ($data['reminder_max_count'] ?? 5);

        Settings::current()->fill($data)->save();

        return back()->with('success', 'Pengaturan disimpan.');
    }

    /**
     * Resize logo max 600x200, crop center, save as WebP.
     */
    private function processLogo(UploadedFile $file): string
    {
        $manager = new ImageManager(GdDriver::class);
        $image = $manager->decodePath($file->getRealPath());
        $image->scaleDown(width: 600, height: 200);
        $relative = 'invoice-assets/'.Str::random(20).'.webp';
        Storage::disk('public')->put(
            $relative,
            (string) $image->encodeUsingFormat(Format::WEBP, quality: 90),
        );

        return $relative;
    }

    /**
     * Tanda tangan: maks 500x200, simpan PNG supaya latar transparan tetap terjaga.
     */
    private function processSignature(UploadedFile $file): string
    {
        $image = (new ImageManager(GdDriver::class))->decodePath($file->getRealPath());
        $image->scaleDown(width: 500, height: 200);
        $relative = 'invoice-assets/signature-'.Str::random(20).'.png';
        Storage::disk('public')->put($relative, (string) $image->encodeUsingFormat(Format::PNG));

        return $relative;
    }

    private function deleteStored(?string $path): void
    {
        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }

    /**
     * Pratinjau PDF: pakai invoice terbaru, atau contoh invoice bila belum ada data.
     *
     * GET  → pengaturan tersimpan.
     * POST → isian form yang BELUM disimpan (termasuk logo/tanda tangan baru);
     *        tidak ada yang ditulis ke database maupun storage.
     */
    public function previewPdf(Request $request): HttpResponse
    {
        $invoice = Invoice::query()->where('status', '!=', 'cancelled')->latest('id')->first()
            ?? $this->sampleInvoice();

        if (! $request->isMethod('post')) {
            return InvoicePdf::make($invoice)->stream('pratinjau-invoice.pdf');
        }

        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'company_address' => ['nullable', 'string', 'max:5000'],
            'company_email' => ['nullable', 'string', 'max:255'],
            'company_phone' => ['nullable', 'string', 'max:32'],
            'company_tax_id' => ['nullable', 'string', 'max:64'],
            'bank_account_info' => ['nullable', 'string', 'max:5000'],
            'invoice_footer_text' => ['nullable', 'string', 'max:5000'],
            'invoice_terms' => ['nullable', 'string', 'max:5000'],
            'signer_name' => ['nullable', 'string', 'max:255'],
            'signer_title' => ['nullable', 'string', 'max:255'],
            'pdf_accent_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'pdf_watermark' => ['nullable', 'in:logo,text,none'],
            'pdf_watermark_text' => ['nullable', 'string', 'max:60'],
            'company_logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'signature' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
        ]);

        // Salinan in-memory — Settings::current() tidak ikut berubah.
        $setting = Settings::current()->replicate();
        unset($data['company_logo'], $data['signature']);
        $setting->fill($data);

        $images = [];
        if ($request->hasFile('company_logo')) {
            $images['logo'] = InvoicePdf::fileDataUri((string) $request->file('company_logo')->getRealPath(), 600, 200);
        } elseif ($request->boolean('remove_logo')) {
            $images['logo'] = null;
        }
        if ($request->hasFile('signature')) {
            $images['signature'] = InvoicePdf::fileDataUri((string) $request->file('signature')->getRealPath(), 500, 200);
        } elseif ($request->boolean('remove_signature')) {
            $images['signature'] = null;
        }

        return InvoicePdf::make($invoice, $setting, $images)->stream('pratinjau-invoice.pdf');
    }

    private function sampleInvoice(): Invoice
    {
        $invoice = new Invoice([
            'invoice_number' => (Settings::current()->app_invoice_prefix ?: 'INV').'-'.now()->format('Ymd').'-0001',
            'issue_date' => now(),
            'due_date' => now()->addDays(14),
            'invoice_mode' => 'fixed',
            'type' => 'full',
            'subtotal' => 7500000,
            'discount' => 500000,
            'discount_type' => 'amount',
            'discount_value' => 500000,
            'tax_rate' => 11,
            'tax_amount' => 770000,
            'total' => 7770000,
            'paid_amount' => 0,
            'status' => 'sent',
            'public_token' => 'contoh',
            'notes' => 'Terima kasih atas kerja samanya. Contoh catatan khusus untuk klien ini.',
            'recurrence' => 'none',
        ]);

        $client = new Client(['name' => 'PT Contoh Klien Indonesia', 'email' => 'finance@contoh.co.id', 'phone' => '0812-3456-7890', 'address' => "Jl. Sudirman No. 1\nJakarta Pusat 10220"]);

        $items = collect([
            ['description' => 'Desain UI/UX aplikasi (10 halaman)', 'unit_price' => 4500000],
            ['description' => 'Implementasi frontend & integrasi API', 'unit_price' => 2500000],
            ['description' => 'Maintenance & support 1 bulan', 'unit_price' => 500000],
        ])->map(function (array $row): InvoiceItem {
            $item = new InvoiceItem([...$row, 'line_total' => $row['unit_price']]);
            $item->setRelation('product', null);
            $item->setRelation('sessions', new EloquentCollection);

            return $item;
        });

        $invoice->setRelation('client', $client);
        $invoice->setRelation('items', new EloquentCollection($items->all()));
        $invoice->setRelation('schedules', new EloquentCollection);

        return $invoice;
    }
}
