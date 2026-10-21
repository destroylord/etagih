<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Support\Access;

/**
 * Hak akses tugas (auto-discovery: App\Models\Task → App\Policies\TaskPolicy).
 *
 * - view / comment     : proyek tugas terlihat oleh pengguna.
 * - create             : proyek terlihat.
 * - update / move      : admin, penerima tugas (assignee), atau pembuatnya.
 * - delete             : admin atau pembuat, dan tugas belum ditagih.
 * - deleteComment      : admin atau penulis komentar.
 * - checklist          : sama dengan update.
 */
class TaskPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Task $task): bool
    {
        return Access::canSeeProject($user, $task->project_id);
    }

    public function create(User $user, ?Project $project = null): bool
    {
        return $project === null || Access::canSeeProject($user, $project);
    }

    public function update(User $user, Task $task): bool
    {
        if (! $this->view($user, $task)) {
            return false;
        }

        return $user->isAdmin()
            || $task->assignee_id === $user->id
            || $task->created_by === $user->id;
    }

    /** Pindah status / urutan (papan kanban). */
    public function move(User $user, Task $task): bool
    {
        return $this->update($user, $task);
    }

    public function delete(User $user, Task $task): bool
    {
        if ($task->isBilled() || ! $this->view($user, $task)) {
            return false;
        }

        return $user->isAdmin() || $task->created_by === $user->id;
    }

    public function comment(User $user, Task $task): bool
    {
        return $this->view($user, $task);
    }

    /** Dipanggil: `$user->can('deleteComment', [$comment->task, $comment])`. */
    public function deleteComment(User $user, Task $task, TaskComment $comment): bool
    {
        if (! $this->view($user, $task)) {
            return false;
        }

        return $user->isAdmin() || $comment->user_id === $user->id;
    }
}
