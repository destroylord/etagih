<?php

namespace App\Http\Requests\Quote;

use App\Models\Project;
use App\Models\Quote;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreQuoteRequest extends FormRequest
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
            'client_id' => ['nullable', 'integer', 'exists:clients,id', 'required_without:client.name'],
            'client.name' => ['nullable', 'required_without:client_id', 'string', 'max:255'],
            'client.phone' => ['nullable', 'string', 'max:32'],
            'client.email' => ['nullable', 'email', 'max:255'],
            'client.address' => ['nullable', 'string', 'max:5000'],

            'project_id' => ['nullable', 'integer', 'exists:projects,id'],

            'issue_date' => ['required', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'discount_type' => ['nullable', Rule::in(['amount', 'percent'])],
            'discount_value' => ['nullable', 'numeric', 'min:0', Rule::when($this->input('discount_type') === 'percent', ['max:100'])],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pph_rate' => ['nullable', 'numeric', 'min:0', 'max:15'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'terms' => ['nullable', 'string', 'max:5000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:99999999'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.project_id' => ['nullable', 'integer', 'exists:projects,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'items.*.description' => 'uraian',
            'items.*.quantity' => 'qty',
            'items.*.unit_price' => 'harga',
            'valid_until' => 'berlaku sampai',
            'issue_date' => 'tanggal penawaran',
        ];
    }

    /**
     * Proyek penawaran harus milik klien yang sama; proyek per item harus
     * proyek penawaran itu sendiri atau sub-proyeknya (sama dengan invoice).
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $clientId = $this->input('client_id');
            $quote = $this->route('quote');
            if ($quote instanceof Quote) {
                $clientId = $quote->client_id; // klien tidak berubah saat edit
            }

            $projectIds = array_filter([
                $this->input('project_id'),
                ...array_map(fn ($row) => is_array($row) ? ($row['project_id'] ?? null) : null, (array) $this->input('items', [])),
            ]);
            if ($projectIds === []) {
                return;
            }

            if (! $clientId) {
                $validator->errors()->add('project_id', 'Simpan klien baru terlebih dulu sebelum memilih proyek.');

                return;
            }

            $projects = Project::query()->whereIn('id', $projectIds)->get()->keyBy('id');
            $quoteProject = $this->input('project_id') ? $projects->get((int) $this->input('project_id')) : null;

            if ($quoteProject && $quoteProject->client_id !== (int) $clientId) {
                $validator->errors()->add('project_id', 'Proyek tidak milik klien ini.');

                return;
            }

            foreach ((array) $this->input('items', []) as $i => $row) {
                $itemProjectId = is_array($row) ? ($row['project_id'] ?? null) : null;
                if (! $itemProjectId) {
                    continue;
                }

                $itemProject = $projects->get((int) $itemProjectId);
                $ok = $itemProject
                    && $itemProject->client_id === (int) $clientId
                    && (! $quoteProject
                        || $itemProject->id === $quoteProject->id
                        || $itemProject->parent_id === $quoteProject->id);

                if (! $ok) {
                    $validator->errors()->add("items.{$i}.project_id", 'Sub-proyek harus bagian dari proyek penawaran ini.');
                }
            }
        }];
    }
}
