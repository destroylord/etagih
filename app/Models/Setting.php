<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property array<string, mixed>|null $qris_style
 */
#[Fillable([
    'company_name',
    'company_address',
    'company_email',
    'company_phone',
    'company_logo_path',
    'bank_account_info',
    'invoice_footer_text',
    'app_invoice_prefix',
    'default_hourly_rate',
    'wa_template_invoice',
    'wa_template_payment_received',
    'wa_template_reminder',
    'wa_template_reminder_upcoming',
    'default_tax_rate',
    'reminder_days_before',
    'reminder_interval_days',
    'reminder_max_count',
    'company_tax_id',
    'invoice_terms',
    'signature_path',
    'signer_name',
    'signer_title',
    'pdf_accent_color',
    'pdf_watermark',
    'pdf_watermark_text',
    'qris_style',
    'stamp_duty_enabled',
])]
class Setting extends Model
{
    protected function casts(): array
    {
        return [
            'default_hourly_rate' => 'decimal:2',
            'default_tax_rate' => 'decimal:2',
            'reminder_interval_days' => 'integer',
            'reminder_max_count' => 'integer',
            'qris_style' => 'array',
            'stamp_duty_enabled' => 'boolean',
        ];
    }

    public function hourlyRate(): float
    {
        return (float) ($this->default_hourly_rate ?? 0);
    }

    /**
     * Hari sebelum jatuh tempo untuk kirim pengingat, mis. "3,1" → [3, 1].
     *
     * @return list<int>
     */
    public function reminderDaysBefore(): array
    {
        $days = array_map(fn (string $d): int => (int) trim($d), explode(',', (string) $this->reminder_days_before));

        return array_values(array_unique(array_filter($days, fn (int $d): bool => $d > 0)));
    }

    /** Syarat & ketentuan default bila belum diisi di Pengaturan. */
    public const DEFAULT_TERMS = <<<'TXT'
Pembayaran dianggap sah setelah dana diterima di rekening kami atau terkonfirmasi melalui QRIS.
Mohon cantumkan nomor invoice pada berita transfer untuk mempercepat verifikasi.
Pembayaran yang melewati tanggal jatuh tempo dapat menyebabkan penundaan layanan atau pekerjaan berikutnya.
Keberatan atas isi invoice dapat diajukan paling lambat 7 (tujuh) hari sejak tanggal terbit.
TXT;

    /**
     * Daftar butir syarat & ketentuan (satu baris = satu butir).
     *
     * @return list<string>
     */
    public function invoiceTerms(): array
    {
        $text = trim((string) $this->invoice_terms) !== '' ? (string) $this->invoice_terms : self::DEFAULT_TERMS;

        $lines = array_map(
            fn (string $line): string => trim((string) preg_replace('/^\s*(\d+[.)]|[-*•])\s*/u', '', $line)),
            preg_split('/\R/', $text) ?: [],
        );

        return array_values(array_filter($lines, fn (string $line): bool => $line !== ''));
    }

    public function signatureUrl(): ?string
    {
        return $this->signature_path ? asset('storage/'.$this->signature_path) : null;
    }

    public function logoUrl(): ?string
    {
        if (! $this->company_logo_path) {
            return null;
        }

        return asset('storage/'.$this->company_logo_path);
    }
}
