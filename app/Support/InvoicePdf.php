<?php

namespace App\Support;

use App\Models\Invoice;
use App\Models\Setting;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdf;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Satu-satunya tempat render PDF invoice (download, stream, lampiran email, pratinjau).
 *
 * Gambar (logo, tanda tangan) dikonversi ke data-URI PNG supaya DomPDF tidak
 * bergantung pada path file / dukungan WebP, dan QR link pembayaran dibuat SVG.
 */
class InvoicePdf
{
    /**
     * `$images` meng-override logo/tanda tangan (data-URI, atau null = tanpa gambar)
     * — dipakai pratinjau dengan file yang belum disimpan.
     *
     * @param  array{logo?: string|null, signature?: string|null}  $images
     */
    public static function make(Invoice $invoice, ?Setting $setting = null, array $images = []): DomPdf
    {
        $setting ??= Settings::current();
        $invoice->loadMissing(['client', 'project.parent', 'items.product', 'items.project', 'items.sessions', 'schedules']);

        $payable = $invoice->isPayable() || $invoice->status === 'draft';

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'setting' => $setting,
            'accent' => self::accentColor($setting),
            'logo' => array_key_exists('logo', $images) ? $images['logo'] : self::imageDataUri($setting->company_logo_path, 600, 200),
            'signature' => array_key_exists('signature', $images) ? $images['signature'] : self::imageDataUri($setting->signature_path, 500, 200),
            'payQr' => $payable && $invoice->public_token
                ? QrisStyle::dataUri(QrisStyle::qrSvg($invoice->publicUrl(), QrisStyle::fromSetting($setting), 240))
                : null,
            'terms' => $setting->invoiceTerms(),
            'amountInWords' => Terbilang::rupiah($invoice->total),
        ])->setPaper('a4', 'portrait')
            // Hanya glyph yang dipakai yang di-embed → file jauh lebih kecil.
            ->setOption('isFontSubsettingEnabled', true);

        // Nomor halaman "Halaman X dari Y" — DomPDF tidak mendukung counter(pages)
        // di CSS, jadi ditulis ke canvas setelah render (berlaku untuk semua halaman).
        $pdf->render();
        $dompdf = $pdf->getDomPDF();
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('DejaVu Sans');
        $canvas->page_text(
            $canvas->get_width() - 42 - 78,
            $canvas->get_height() - 40,
            'Halaman {PAGE_NUM} dari {PAGE_COUNT}',
            $font,
            6.5,
            [0.58, 0.64, 0.72],
        );

        return $pdf;
    }

    public static function accentColor(Setting $setting): string
    {
        $color = (string) $setting->pdf_accent_color;

        return preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? $color : '#1e3a8a';
    }

    /**
     * File di disk `public` → data:image/png;base64,… (null bila tidak ada / gagal).
     */
    public static function imageDataUri(?string $path, int $maxWidth, int $maxHeight): ?string
    {
        if (! $path || ! Storage::disk('public')->exists($path)) {
            return null;
        }

        return self::fileDataUri(Storage::disk('public')->path($path), $maxWidth, $maxHeight);
    }

    /**
     * File lokal (mis. upload sementara) → data:image/png;base64,… (null bila gagal).
     */
    public static function fileDataUri(string $absolutePath, int $maxWidth, int $maxHeight): ?string
    {
        try {
            $image = (new ImageManager(GdDriver::class))->decodePath($absolutePath);
            $image->scaleDown(width: $maxWidth, height: $maxHeight);

            return 'data:image/png;base64,'.base64_encode((string) $image->encodeUsingFormat(Format::PNG));
        } catch (Throwable) {
            return null;
        }
    }

    public static function qrDataUri(string $text): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(240, 1), new SvgImageBackEnd));

        return 'data:image/svg+xml;base64,'.base64_encode($writer->writeString($text));
    }
}
