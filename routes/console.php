<?php

use App\Jobs\QueueHeartbeat;
use App\Support\SystemStatus;
use App\Support\UpdateChecker;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('invoices:mark-overdue')->dailyAt('00:05');
Schedule::command('invoices:generate-recurring')->dailyAt('06:00');
Schedule::command('app:invoice-reminders')->dailyAt('09:00');
Schedule::command('sessions:cleanup-stale')->dailyAt('00:30');
Schedule::command('quotes:expire')->dailyAt('00:10');
// Pengingat tugas: tenggat besok & baru lewat tenggat (masing-masing sekali).
Schedule::command('tasks:remind')->dailyAt('07:00');

// Status sistem: detak scheduler & queue worker tiap menit, cek update harian.
Schedule::call(fn () => SystemStatus::touchScheduler())->everyMinute()->name('etagih:heartbeat-scheduler');
Schedule::job(new QueueHeartbeat)->everyMinute()->name('etagih:heartbeat-queue');
Schedule::call(fn () => app(UpdateChecker::class)->refresh())->dailyAt('03:17')->name('etagih:update-check');
