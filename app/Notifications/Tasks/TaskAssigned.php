<?php

namespace App\Notifications\Tasks;

use App\Models\Task;

/** Tugas ditugaskan ke pengguna (tidak dikirim bila menugaskan diri sendiri). */
class TaskAssigned extends TaskNotification
{
    public function __construct(Task $task, public readonly ?string $assignerName = null)
    {
        parent::__construct($task);
    }

    public function key(): string
    {
        return 'task_assigned';
    }

    public function title(): string
    {
        return 'Tugas baru: '.$this->task->title;
    }

    public function body(): string
    {
        $by = $this->assignerName ?: 'Seseorang';
        $due = $this->task->due_date ? ' Tenggat: '.$this->task->due_date->translatedFormat('d M Y').'.' : '';

        return "{$by} menugaskan \"{$this->task->title}\" ({$this->projectName()}) kepada Anda.{$due}";
    }
}
