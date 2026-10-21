<?php

namespace App\Notifications\Tasks;

use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Support\Str;

/** Komentar baru di tugas (ke assignee & pembuat, kecuali penulis komentar). */
class TaskCommented extends TaskNotification
{
    public function __construct(Task $task, public readonly TaskComment $comment, public readonly string $authorName)
    {
        parent::__construct($task);
    }

    public function key(): string
    {
        return 'task_commented';
    }

    public function title(): string
    {
        return "Komentar baru di \"{$this->task->title}\"";
    }

    public function body(): string
    {
        return "{$this->authorName}: ".Str::limit($this->comment->body, 160);
    }
}
