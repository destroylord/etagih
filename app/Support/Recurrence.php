<?php

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Interval invoice berulang.
 */
class Recurrence
{
    public const OPTIONS = ['none', 'weekly', 'monthly', 'quarterly', 'yearly'];

    public static function next(string $recurrence, CarbonInterface|string $from): ?string
    {
        $date = Carbon::parse($from)->startOfDay();

        return match ($recurrence) {
            'weekly' => $date->addWeek()->toDateString(),
            'monthly' => $date->addMonthNoOverflow()->toDateString(),
            'quarterly' => $date->addMonthsNoOverflow(3)->toDateString(),
            'yearly' => $date->addYearNoOverflow()->toDateString(),
            default => null,
        };
    }
}
