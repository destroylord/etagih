<?php

namespace App\Http\Requests\Task;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Buat tugas. Proyek harus terlihat oleh pengguna; penerima tugas harus
 * pengguna aktif yang punya akses ke proyek (admin, atau anggota proyek utama).
 */
class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'status' => ['nullable', Rule::in(Task::STATUSES)],
            'priority' => ['nullable', Rule::in(Task::PRIORITIES)],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', ...($this->filled('start_date') ? ['after_or_equal:start_date'] : [])],
            'estimate_minutes' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'billable' => ['sometimes', 'boolean'],
            'fixed_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Pilih proyek untuk tugas ini.',
            'project_id.exists' => 'Proyek tidak ditemukan.',
            'title.required' => 'Judul tugas wajib diisi.',
            'title.max' => 'Judul tugas maksimal 255 karakter.',
            'status.in' => 'Status tugas tidak valid.',
            'priority.in' => 'Prioritas tidak valid.',
            'assignee_id.exists' => 'Pengguna tidak ditemukan.',
            'start_date.date' => 'Tanggal mulai tidak valid.',
            'due_date.date' => 'Tenggat tidak valid.',
            'due_date.after_or_equal' => 'Tenggat tidak boleh sebelum tanggal mulai.',
            'estimate_minutes.integer' => 'Estimasi harus berupa menit (angka bulat).',
            'estimate_minutes.min' => 'Estimasi tidak boleh negatif.',
            'fixed_price.numeric' => 'Harga tetap harus berupa angka.',
            'fixed_price.min' => 'Harga tetap tidak boleh negatif.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'project_id' => 'proyek',
            'title' => 'judul',
            'description' => 'deskripsi',
            'assignee_id' => 'penerima tugas',
            'start_date' => 'tanggal mulai',
            'due_date' => 'tenggat',
            'estimate_minutes' => 'estimasi',
            'fixed_price' => 'harga tetap',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateAccess($validator, $this->targetProjectId(), $this->targetAssigneeId());
        }];
    }

    /** Proyek tujuan (input, atau proyek tugas saat ini untuk update). */
    protected function targetProjectId(): ?int
    {
        return $this->filled('project_id') ? $this->integer('project_id') : null;
    }

    /** Penerima tugas yang perlu dicek (null = tidak ada / tidak berubah). */
    protected function targetAssigneeId(): ?int
    {
        return $this->filled('assignee_id') ? $this->integer('assignee_id') : null;
    }

    protected function validateAccess(Validator $validator, ?int $projectId, ?int $assigneeId): void
    {
        $user = $this->user();
        if (! $user instanceof User || $projectId === null) {
            return;
        }

        $project = Project::query()->find($projectId);
        if (! $project instanceof Project || ! Access::canSeeProject($user, $project)) {
            $validator->errors()->add('project_id', 'Anda tidak punya akses ke proyek ini.');

            return;
        }

        if ($assigneeId === null) {
            return;
        }

        $assignee = User::query()->find($assigneeId);
        if (! $assignee instanceof User || ! $assignee->is_active) {
            $validator->errors()->add('assignee_id', 'Penerima tugas harus pengguna aktif.');

            return;
        }

        if (! Access::userCanWorkOn($assignee, $project)) {
            $validator->errors()->add('assignee_id', "{$assignee->name} bukan anggota proyek ini. Tambahkan dulu sebagai anggota proyek.");
        }
    }
}
