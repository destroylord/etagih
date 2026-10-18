<?php

namespace App\Jobs;

use App\Support\SystemStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

/**
 * Job kecil yang di-dispatch scheduler tiap menit. Bila queue worker berjalan,
 * job ini mencatat waktu eksekusinya → halaman Status sistem tahu worker hidup.
 */
class QueueHeartbeat implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function handle(): void
    {
        Cache::put(SystemStatus::QUEUE_HEARTBEAT_KEY, now()->toIso8601String(), now()->addDay());
    }
}
