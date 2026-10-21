<?php

namespace App\Notifications\Tasks;

/** Tugas lewat tenggat (dikirim sekali oleh `tasks:remind`). */
class TaskOverdue extends TaskNotification
{
    public function key(): string
    {
        return 'task_overdue';
    }

    public function title(): string
    {
        return 'Lewat tenggat: '.$this->task->title;
    }

    public function body(): string
    {
        $due = $this->task->due_date?->translatedFormat('d M Y') ?? '-';

        return "Tugas \"{$this->task->title}\" ({$this->projectName()}) melewati tenggat {$due} dan belum selesai.";
    }
}
