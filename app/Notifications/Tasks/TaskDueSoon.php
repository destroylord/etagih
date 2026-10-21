<?php

namespace App\Notifications\Tasks;

/** Tenggat tugas besok (dikirim sekali oleh `tasks:remind`). */
class TaskDueSoon extends TaskNotification
{
    public function key(): string
    {
        return 'task_due_soon';
    }

    public function title(): string
    {
        return 'Tenggat besok: '.$this->task->title;
    }

    public function body(): string
    {
        $due = $this->task->due_date?->translatedFormat('d M Y') ?? '-';

        return "Tugas \"{$this->task->title}\" ({$this->projectName()}) jatuh tempo besok, {$due}.";
    }
}
