<?php

namespace App\Console\Commands;

use App\Models\Quote;
use Illuminate\Console\Command;

class ExpireQuotes extends Command
{
    protected $signature = 'quotes:expire';

    protected $description = 'Tandai penawaran terkirim yang melewati masa berlaku sebagai kedaluwarsa.';

    public function handle(): int
    {
        $count = Quote::query()
            ->where('status', 'sent')
            ->whereNotNull('valid_until')
            ->where('valid_until', '<', now()->toDateString())
            ->update(['status' => 'expired', 'updated_at' => now()]);

        $this->info("Marked {$count} quote(s) expired.");

        return self::SUCCESS;
    }
}
