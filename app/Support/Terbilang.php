<?php

namespace App\Support;

/**
 * Angka → kata dalam Bahasa Indonesia ("terbilang"), untuk invoice resmi.
 *
 * Terbilang::rupiah(1250000) → "Satu Juta Dua Ratus Lima Puluh Ribu Rupiah"
 */
class Terbilang
{
    private const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

    public static function rupiah(float|int|string $amount): string
    {
        $value = (int) round((float) $amount);

        if ($value === 0) {
            return 'Nol Rupiah';
        }

        return ucwords(trim(self::words($value))).' Rupiah';
    }

    private static function words(int $n): string
    {
        return match (true) {
            $n < 0 => 'minus '.self::words(-$n),
            $n < 12 => self::SATUAN[$n],
            $n < 20 => self::words($n - 10).' belas',
            $n < 100 => self::words(intdiv($n, 10)).' puluh '.self::words($n % 10),
            $n < 200 => 'seratus '.self::words($n - 100),
            $n < 1_000 => self::words(intdiv($n, 100)).' ratus '.self::words($n % 100),
            $n < 2_000 => 'seribu '.self::words($n - 1_000),
            $n < 1_000_000 => self::words(intdiv($n, 1_000)).' ribu '.self::words($n % 1_000),
            $n < 1_000_000_000 => self::words(intdiv($n, 1_000_000)).' juta '.self::words($n % 1_000_000),
            $n < 1_000_000_000_000 => self::words(intdiv($n, 1_000_000_000)).' miliar '.self::words($n % 1_000_000_000),
            default => self::words(intdiv($n, 1_000_000_000_000)).' triliun '.self::words($n % 1_000_000_000_000),
        };
    }
}
