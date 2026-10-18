<?php

namespace App\Support;

/**
 * Pure formatter invoice number dengan strategi yearly/monthly/none.
 *
 * Tidak menyimpan state / counter — caller (action/controller) yang bertanggung
 * jawab increment counter secara atomic. Class ini tinggal merangkai string
 * dari prefix + period + counter pakai padding.
 *
 * Format:
 *   - yearly  → "INV-2026-0001"
 *   - monthly → "INV-2026-03-0042"
 *   - none    → "INV-00123"
 *
 * Digunakan oleh InvoiceNumberGeneratorTest (pure test, tanpa DB).
 *
 * Catatan: App\Actions\Invoice\GenerateInvoiceNumber memakai generator terpisah
 * (App\Support\InvoiceNumberGenerator) yang strategi DAILY (PREFIX-YYYYMMDD-XXXX)
 * dengan atomic cache lock + self-heal dari DB. Dua strategi ini tidak 1:1
 * substitutable — class ini berdiri sendiri untuk caller yang butuh yearly/monthly.
 */
class InvoiceNumberFormatter
{
    /**
     * @param  array{invoice_prefix?: string, invoice_padding?: int, invoice_reset_period?: string}  $settings
     */
    public function generate(array $settings, int $counter, ?string $period = null): string
    {
        $prefix = trim((string) ($settings['invoice_prefix'] ?? 'INV'));
        $padding = max(1, (int) ($settings['invoice_padding'] ?? 4));
        $reset = strtolower((string) ($settings['invoice_reset_period'] ?? 'yearly'));

        if ($prefix === '') {
            throw new \InvalidArgumentException('invoice_prefix is empty.');
        }

        $periodSegment = match ($reset) {
            'monthly' => $this->resolvePeriod($period, 'Y-m'),
            'yearly' => $this->resolvePeriod($period, 'Y'),
            default => null,
        };

        $body = str_pad((string) max(0, $counter), $padding, '0', STR_PAD_LEFT);

        return $periodSegment === null
            ? "{$prefix}-{$body}"
            : "{$prefix}-{$periodSegment}-{$body}";
    }

    private function resolvePeriod(?string $override, string $format): string
    {
        if ($override !== null && $override !== '') {
            return (new \DateTimeImmutable($override))->format($format);
        }

        return (new \DateTimeImmutable('now'))->format($format);
    }
}
