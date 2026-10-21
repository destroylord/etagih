<?php

namespace App\Actions\WorkSession;

use App\Actions\Invoice\WorkSessionAction;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\RateResolver;
use RuntimeException;

/**
 * Mulai stopwatch untuk sebuah tugas: klien & proyek diambil dari proyek
 * tugas, uraian default = judul tugas, tarif default = tarif proyek
 * (sub-proyek → proyek utama → klien → default).
 *
 * Dipakai WorkSessionController@start (bila `task_id` dikirim) dan
 * TaskController@startTimer. Kunci "satu sesi aktif per pengguna" tetap
 * ditegakkan oleh WorkSessionAction::start().
 */
class StartWorkSession
{
    public function __construct(private readonly WorkSessionAction $action) {}

    /**
     * @throws RuntimeException bila pengguna masih punya sesi aktif
     */
    public function forTask(User $user, Task $task, ?string $description = null, ?float $unitPrice = null, ?string $notes = null): WorkSession
    {
        /** @var Project $project */
        $project = Project::query()->with(['parent', 'client'])->findOrFail($task->project_id);

        $description = trim((string) $description);

        return $this->action->start(
            userId: $user->id,
            clientId: $project->client_id,
            description: $description !== '' ? $description : $task->title,
            unitPrice: $unitPrice ?? RateResolver::forProject($project),
            notes: $notes,
            projectId: $project->id,
            taskId: $task->id,
        );
    }
}
