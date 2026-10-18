<?php

namespace App\Support;

use App\Models\Payment;
use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdf;

/**
 * Render PDF kuitansi (bukti penerimaan uang) untuk satu pembayaran sukses.
 *
 * Memakai helper & gaya yang sama dengan InvoicePdf (warna aksen, logo,
 * tanda tangan, terbilang). Bea meterai: dokumen penerimaan uang dengan
 * nilai > Rp5.000.000 wajib bermeterai Rp10.000 (UU 10/2020) → tampilkan
 * kotak "Tempel e-Meterai" di samping tanda tangan bila diaktifkan.
 */
class ReceiptPdf
{
    /** Batas nominal kena bea meterai (UU 10/2020 tentang Bea Meterai). */
    public const STAMP_DUTY_THRESHOLD = 5_000_000;

    /** Tarif bea meterai (Rp). */
    public const STAMP_DUTY_AMOUNT = 10_000;

    public static function make(Payment $payment, ?Setting $setting = null): DomPdf
    {
        $setting ??= Settings::current();
        $payment->loadMissing(['invoice.client', 'invoice.project.parent', 'schedule']);

        return Pdf::loadView('pdf.receipt', [
            'payment' => $payment,
            'invoice' => $payment->invoice,
            'setting' => $setting,
            'accent' => InvoicePdf::accentColor($setting),
            'logo' => InvoicePdf::imageDataUri($setting->company_logo_path, 600, 200),
            'signature' => InvoicePdf::imageDataUri($setting->signature_path, 500, 200),
            'amountInWords' => Terbilang::rupiah($payment->amount),
            'needsStamp' => self::needsStamp((float) $payment->amount, $setting),
        ])->setPaper('a5', 'landscape')
            ->setOption('isFontSubsettingEnabled', true);
    }

    /** Apakah kuitansi perlu ditempel e-Meterai (setting aktif & nominal > Rp5 juta). */
    public static function needsStamp(float $amount, Setting $setting): bool
    {
        // null = kolom belum ter-load (instance baru) → ikut default migrasi (aktif).
        return ($setting->stamp_duty_enabled ?? true) && $amount > self::STAMP_DUTY_THRESHOLD;
    }

    public static function filename(Payment $payment): string
    {
        return 'Kuitansi-'.($payment->receipt_number ?: 'pembayaran-'.$payment->id).'.pdf';
    }
}
