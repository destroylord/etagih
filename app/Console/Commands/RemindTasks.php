<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Models\User;
use App\Notifications\Tasks\TaskDueSoon;
use App\Notifications\Tasks\TaskOverdue;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Kirim pengingat tugas ke penerima tugas (assignee) aktif:
 * - tenggat besok  → TaskDueSoon (sekali, ditandai due_soon_notified_at)
 * - lewat tenggat  → TaskOverdue (sekali, ditandai overdue_notified_at;
 *   hanya tugas yang lewat tenggat maks. 7 hari supaya upgrade pertama
 *   tidak membanjiri pengingat lama).
 *
 * Aman dijalankan berkali-kali (idempoten). Ganti tenggat → penanda direset
 * (lihat Task::booted()).
 */
class RemindTasks extends Command
{
    public const OVERDUE_LOOKBACK_DAYS = 7;

    protected $signature = 'tasks:remind';

    protected $description = 'Kirim pengingat tugas yang jatuh tempo besok / lewat tenggat.';

    public function handle(): int
    {
        $today = now()->startOfDay();
        $tomorrow = $today->addDay();

        $dueSoon = $this->baseQuery()
            ->whereDate('due_date', $tomorrow->toDateString())
            ->whereNull('due_soon_notified_at')
            ->get();

        foreach ($dueSoon as $task) {
            $this->notifyAssignee($task, new TaskDueSoon($task));
            $task->forceFill(['due_soon_notified_at' => now()])->saveQuietly();
        }

        $overdue = $this->baseQuery()
            ->whereDate('due_date', '<', $today->toDateString())
            ->whereDate('due_date', '>=', $today->subDays(self::OVERDUE_LOOKBACK_DAYS)->toDateString())
            ->whereNull('overdue_notified_at')
            ->get();

        foreach ($overdue as $task) {
            $this->notifyAssignee($task, new TaskOverdue($task));
            $task->forceFill(['overdue_notified_at' => now()])->saveQuietly();
        }

        $this->info("Pengingat: {$dueSoon->count()} tenggat besok, {$overdue->count()} lewat tenggat.");

        return self::SUCCESS;
    }

    /**
     * Tugas terbuka dengan assignee aktif.
     *
     * @return Builder<Task>
     */
    private function baseQuery(): Builder
    {
        return Task::query()
            ->open()
            ->whereNotNull('due_date')
            ->whereHas('assignee', fn ($q) => $q->where('is_active', true))
            ->with('assignee');
    }

    private function notifyAssignee(Task $task, TaskDueSoon|TaskOverdue $notification): void
    {
        $assignee = $task->assignee;
        if ($assignee instanceof User && $assignee->is_active) {
            $assignee->notify($notification);
        }
    }
}
