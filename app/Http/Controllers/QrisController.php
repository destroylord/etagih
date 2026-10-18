<?php

namespace App\Http\Controllers;

use App\Models\QrisAccount;
use App\Services\QrislyService;
use App\Support\InvoicePdf;
use App\Support\QrisStyle;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Kelola QRIS statis merchant (upload ke QRISLY) dan pratinjau gaya QR.
 */
class QrisController extends Controller
{
    /**
     * Upload gambar QRIS → POST /upload-qris di QRISLY → simpan qris_id.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'qris_image' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
        ], [], ['name' => 'nama QRIS', 'qris_image' => 'gambar QRIS']);

        $file = $request->file('qris_image');

        try {
            $result = QrislyService::fromConfig()
                ->uploadQris($data['name'], (string) $file->getRealPath(), $file->getClientOriginalName());
        } catch (RuntimeException $e) {
            // Sebagai error field supaya dialog upload tetap terbuka dengan pesannya.
            return back()->withErrors(['qris_image' => $e->getMessage()]);
        }

        $path = $file->storeAs('qris', Str::random(24).'.'.$file->extension(), 'public');

        $account = QrisAccount::query()->updateOrCreate(
            ['qris_id' => $result['qris_id']],
            [
                'name' => $result['name'],
                'provider' => $result['provider'],
                'merchant_name' => $result['merchant_name'],
                'image_path' => $path ?: null,
            ],
        );

        // QRIS pertama (atau bila diminta) langsung jadi QRIS aktif.
        if ($request->boolean('activate') || ! QrisAccount::query()->where('is_active', true)->exists()) {
            $account->activate();
        }

        return back()->with('success', "QRIS \"{$account->name}\" berhasil didaftarkan ke QRISLY.");
    }

    public function activate(QrisAccount $qris): RedirectResponse
    {
        $qris->activate();

        return back()->with('success', "QRIS \"{$qris->name}\" sekarang dipakai untuk pembayaran.");
    }

    /**
     * Hapus dari aplikasi (QRISLY belum menyediakan endpoint hapus).
     */
    public function destroy(QrisAccount $qris): RedirectResponse
    {
        if ($qris->image_path) {
            Storage::disk('public')->delete($qris->image_path);
        }

        $wasActive = $qris->is_active;
        $qris->delete();

        if ($wasActive) {
            QrisAccount::query()->latest('id')->first()?->activate();
        }

        return back()->with('success', 'QRIS dihapus dari aplikasi.');
    }

    /**
     * Pratinjau kartu QRIS dari gaya yang sedang diedit (belum disimpan).
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate(self::styleRules('style'));

        $style = QrisStyle::normalize($request->input('style', []));
        $setting = Settings::current();

        return response()->json([
            'svg' => QrisStyle::cardSvg(
                QrisStyle::SAMPLE_PAYLOAD,
                $style,
                150000,
                $setting->company_name ?: QrisAccount::active()?->merchant_name,
                InvoicePdf::imageDataUri($setting->company_logo_path, 300, 300),
            ),
            'contrast' => round(QrisStyle::contrast($style['fg_color'], $style['bg_color']), 2),
        ]);
    }

    /**
     * Aturan validasi gaya QR (dipakai juga oleh StoreSettingsRequest).
     *
     * @return array<string, mixed>
     */
    public static function styleRules(string $prefix = 'qris_style'): array
    {
        $hex = ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'];

        return [
            $prefix => ['nullable', 'array'],
            "{$prefix}.fg_color" => $hex,
            "{$prefix}.bg_color" => [...$hex, function (string $attribute, mixed $value, \Closure $fail) use ($prefix) {
                $fg = request()->input("{$prefix}.fg_color") ?: QrisStyle::DEFAULTS['fg_color'];
                if (is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) && preg_match('/^#[0-9a-fA-F]{6}$/', (string) $fg)
                    && QrisStyle::contrast((string) $fg, $value) < 3) {
                    $fail('Kontras warna QR terlalu rendah — QR bisa gagal di-scan. Pakai warna titik yang lebih gelap atau latar yang lebih terang.');
                }
            }],
            "{$prefix}.eye_color" => $hex,
            "{$prefix}.frame_color" => $hex,
            "{$prefix}.module" => ['nullable', 'in:'.implode(',', QrisStyle::MODULES)],
            "{$prefix}.eye" => ['nullable', 'in:'.implode(',', QrisStyle::EYES)],
            "{$prefix}.frame" => ['nullable', 'in:'.implode(',', QrisStyle::FRAMES)],
            "{$prefix}.logo" => ['nullable', 'in:none,company'],
            "{$prefix}.title" => ['nullable', 'string', 'max:40'],
            "{$prefix}.caption" => ['nullable', 'string', 'max:80'],
            "{$prefix}.show_amount" => ['nullable', 'boolean'],
        ];
    }
}
