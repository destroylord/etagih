<?php

namespace App\Support;

use App\Models\Quote;
use Illuminate\Support\Facades\Cache;

/**
 * Generator nomor penawaran: PNW-YYYYMMDD-XXXX.
 *
 * Sama dengan InvoiceNumberGenerator: counter harian di cache (atomic via lock),
 * self-heal dari nomor terakhir di DB bila cache kosong. Prefix tetap (konstanta),
 * bukan pengaturan.
 */
class QuoteNumberGenerator
{
    private const COUNTER_TTL_HOURS = 26;

    public function next(): string
    {
        $prefix = Quote::NUMBER_PREFIX;
        $today = now()->format('Ymd');

        return Cache::lock("quote_counter:{$today}", 10)->block(5, function () use ($prefix, $today) {
            $counterKey = "quote_counter_value:{$today}";

            $next = Cache::has($counterKey)
                ? (int) Cache::get($counterKey) + 1
                : $this->lastSequence($prefix, $today) + 1;

            // Jaga-jaga: bila nomor sudah dipakai (cache tertinggal), lompati.
            while (Quote::where('quote_number', sprintf('%s-%s-%04d', $prefix, $today, $next))->exists()) {
                $next++;
            }

            Cache::put($counterKey, $next, now()->addHours(self::COUNTER_TTL_HOURS));

            return sprintf('%s-%s-%04d', $prefix, $today, $next);
        });
    }

    private function lastSequence(string $prefix, string $today): int
    {
        return (int) Quote::query()
            ->where('quote_number', 'like', "{$prefix}-{$today}-%")
            ->pluck('quote_number')
            ->reduce(function (int $max, $number) use ($prefix, $today): int {
                if (preg_match("/^{$prefix}-{$today}-(\d+)$/", (string) $number, $m)) {
                    return max($max, (int) $m[1]);
                }

                return $max;
            }, 0);
    }
}
