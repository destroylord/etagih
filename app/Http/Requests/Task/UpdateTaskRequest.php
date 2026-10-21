<?php

namespace App\Http\Requests\Task;

use App\Models\Project;
use App\Models\Task;
use Illuminate\Validation\Validator;

/**
 * Ubah tugas — boleh sebagian (hanya field yang dikirim yang diubah), mis.
 * panel samping yang hanya mengganti prioritas. Aturan akses sama dengan
 * StoreTaskRequest; penerima tugas dicek ulang bila proyek dipindah.
 */
class UpdateTaskRequest extends StoreTaskRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['project_id'] = ['sometimes', 'required', 'integer', 'exists:projects,id'];
        $rules['title'] = ['sometimes', 'required', 'string', 'max:255'];

        // Tenggat dibandingkan dengan tanggal mulai yang tersimpan bila tidak dikirim.
        $task = $this->route('task');
        if (! $this->has('start_date') && $task instanceof Task && $task->start_date !== null) {
            $rules['due_date'] = ['nullable', 'date', 'after_or_equal:'.$task->start_date->toDateString()];
        }

        return $rules;
    }

    protected function targetProjectId(): ?int
    {
        $task = $this->route('task');

        return $this->filled('project_id')
            ? $this->integer('project_id')
            : ($task instanceof Task ? $task->project_id : null);
    }

    /** Tugas yang sudah ditagih tidak boleh dipindah ke proyek klien lain (invoicenya milik klien lama). */
    protected function validateAccess(Validator $validator, ?int $projectId, ?int $assigneeId): void
    {
        parent::validateAccess($validator, $projectId, $assigneeId);

        $task = $this->route('task');
        if (! $task instanceof Task || ! $task->isBilled() || $projectId === null || $projectId === $task->project_id) {
            return;
        }

        $clients = Project::query()->whereIn('id', [$projectId, $task->project_id])->pluck('client_id', 'id');
        if ($clients->get($projectId) !== $clients->get($task->project_id)) {
            $validator->errors()->add('project_id', 'Tugas sudah ditagihkan di invoice; tidak bisa dipindah ke proyek klien lain.');
        }
    }

    protected function targetAssigneeId(): ?int
    {
        if ($this->has('assignee_id')) {
            return $this->filled('assignee_id') ? $this->integer('assignee_id') : null;
        }

        // Proyek dipindah: penerima tugas lama harus tetap punya akses.
        $task = $this->route('task');
        if ($task instanceof Task && $this->filled('project_id') && $this->integer('project_id') !== $task->project_id) {
            return $task->assignee_id;
        }

        return null;
    }
}
