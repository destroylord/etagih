<?php

namespace App\Support;

use App\Models\Invoice;
use Illuminate\Support\Facades\Cache;

/**
 * Generator nomor invoice: PREFIX-YYYYMMDD-XXXX
 *
 * XXXX di-reset ke 0001 tiap hari, atomic via cache lock.
 * Single-tenant (Settings::current()->app_invoice_prefix).
 */
class InvoiceNumberGenerator
{
    private const COUNTER_TTL_HOURS = 26;

    /**
     * Generate nomor invoice berikutnya.
     *
     * Pattern: PREFIX-YYYYMMDD-XXXX (4 digit, padded zero).
     */
    public function next(): string
    {
        $prefix = Settings::current()->app_invoice_prefix ?: 'INV';
        $today = now()->format('Ymd');
        $lockKey = "invoice_counter:{$today}";

        return Cache::lock($lockKey, 10)->block(5, function () use ($prefix, $today) {
            $counterKey = "invoice_counter_value:{$today}";

            // ponytail: counter hanya di cache dan bisa hilang (cache:clear, driver
            // non-persisten, TTL lewat) -> bila cache kosong, self-heal dari nomor
            // terakhir yang sudah tersimpan di DB hari ini, bukan mulai dari 0,
            // supaya tidak menabrak unique index. Sudah di dalam lock jadi tetap atomic.
            $next = Cache::has($counterKey)
                ? (int) Cache::get($counterKey) + 1
                : $this->lastSequence($prefix, $today) + 1;

            Cache::put($counterKey, $next, now()->addHours(self::COUNTER_TTL_HOURS));

            return sprintf('%s-%s-%04d', $prefix, $today, $next);
        });
    }

    private function lastSequence(string $prefix, string $today): int
    {
        return (int) Invoice::query()
            ->where('invoice_number', 'like', "{$prefix}-{$today}-%")
            ->pluck('invoice_number')
            ->reduce(function (int $max, $number) use ($prefix, $today): int {
                if (preg_match("/^{$prefix}-{$today}-(\d+)$/", (string) $number, $m)) {
                    return max($max, (int) $m[1]);
                }

                return $max;
            }, 0);
    }
}
