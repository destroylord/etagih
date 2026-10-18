<?php

namespace App\Console\Commands;

use App\Actions\Invoice\WorkSessionAction;
use Illuminate\Console\Command;

/**
 * Flag work sessions 'running' yang kelamaan (>stale_hours) jadi 'cancelled'.
 * Handle crash / lupa stop dari Time Tracker. Schedule via routes/console.php.
 */
class CleanupStaleSessions extends Command
{
    protected $signature = 'sessions:cleanup-stale';

    protected $description = 'Mark stale running work sessions as cancelled.';

    public function handle(WorkSessionAction $action): int
    {
        $count = $action->cleanupStale();

        $this->info("Marked {$count} stale running session(s) as cancelled.");

        return self::SUCCESS;
    }
}
