<?php

namespace App\Support;

use App\Models\Quote;
use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdf;

/**
 * Render PDF penawaran harga (download, stream, lampiran email). Memakai helper
 * gambar/warna yang sama dengan InvoicePdf supaya tampilannya seragam.
 */
class QuotePdf
{
    public static function make(Quote $quote, ?Setting $setting = null): DomPdf
    {
        $setting ??= Settings::current();
        $quote->loadMissing(['client', 'project.parent', 'items.product', 'items.project']);

        $pdf = Pdf::loadView('pdf.quote', [
            'quote' => $quote,
            'setting' => $setting,
            'accent' => InvoicePdf::accentColor($setting),
            'logo' => InvoicePdf::imageDataUri($setting->company_logo_path, 600, 200),
            'signature' => InvoicePdf::imageDataUri($setting->signature_path, 500, 200),
            'linkQr' => $quote->status === 'sent' ? InvoicePdf::qrDataUri($quote->publicUrl()) : null,
            'terms' => self::terms($quote),
            'amountInWords' => Terbilang::rupiah($quote->total),
        ])->setPaper('a4', 'portrait')
            ->setOption('isFontSubsettingEnabled', true);

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

    /**
     * Syarat penawaran per baris (penomoran / bullet di awal baris dibuang).
     *
     * @return list<string>
     */
    public static function terms(Quote $quote): array
    {
        $lines = array_map(
            fn (string $line): string => trim((string) preg_replace('/^\s*(\d+[.)]|[-*•])\s*/u', '', $line)),
            preg_split('/\R/', (string) $quote->terms) ?: [],
        );

        return array_values(array_filter($lines, fn (string $line): bool => $line !== ''));
    }
}
