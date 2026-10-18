<?php

namespace App\Support;

use App\Models\Payment;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;

/**
 * Generator nomor kuitansi: KWT-YYYYMMDD-XXXX (tanggal = tanggal bayar).
 *
 * Pola sama dengan InvoiceNumberGenerator (counter harian di cache + lock),
 * ditambah: nomor tidak pernah lebih kecil dari nomor terakhir di DB untuk
 * tanggal tsb. Jadi aman walau cache hilang, dan aman untuk pembayaran
 * manual bertanggal mundur (counter per tanggal bayar, bukan per hari ini).
 */
class ReceiptNumberGenerator
{
    public const PREFIX = 'KWT';

    private const COUNTER_TTL_HOURS = 26;

    public function next(?CarbonInterface $date = null): string
    {
        $day = ($date ?? now())->format('Ymd');

        return Cache::lock("receipt_counter:{$day}", 10)->block(5, function () use ($day) {
            $counterKey = "receipt_counter_value:{$day}";

            $next = max((int) Cache::get($counterKey, 0), $this->lastSequence($day)) + 1;

            Cache::put($counterKey, $next, now()->addHours(self::COUNTER_TTL_HOURS));

            return sprintf('%s-%s-%04d', self::PREFIX, $day, $next);
        });
    }

    private function lastSequence(string $day): int
    {
        $prefix = self::PREFIX."-{$day}-";

        return (int) Payment::query()
            ->where('receipt_number', 'like', "{$prefix}%")
            ->pluck('receipt_number')
            ->reduce(function (int $max, $number) use ($prefix): int {
                $seq = substr((string) $number, strlen($prefix));

                return ctype_digit($seq) ? max($max, (int) $seq) : $max;
            }, 0);
    }
}
