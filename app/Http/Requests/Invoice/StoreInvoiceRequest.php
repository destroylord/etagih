<?php

namespace App\Http\Requests\Invoice;

use App\Models\Invoice;
use App\Models\Project;
use App\Support\Recurrence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreInvoiceRequest extends FormRequest
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

            // Proyek / sub-proyek milik klien (dicek di after()).
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],

            'invoice_mode' => ['required', Rule::in(['fixed', 'hourly'])],
            'type' => ['required', Rule::in(['full', 'installment'])],

            'issue_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'discount_type' => ['nullable', Rule::in(['amount', 'percent'])],
            'discount_value' => ['nullable', 'numeric', 'min:0', Rule::when($this->input('discount_type') === 'percent', ['max:100'])],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            // PPh 23 yang dipotong klien (umumnya 2% untuk jasa; 0 = tidak dipotong).
            'pph_rate' => ['nullable', 'numeric', 'min:0', 'max:15'],
            'recurrence' => ['nullable', Rule::in(Recurrence::OPTIONS)],
            'recurrence_auto_send' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.hours_qty' => ['nullable', 'numeric', 'min:0'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'items.*.session_ids' => ['nullable', 'array'],
            'items.*.session_ids.*' => ['integer', 'exists:work_sessions,id'],

            'installments' => ['required_if:type,installment', 'array'],
            'installments.count' => ['required_with:installments', 'integer', 'min:2', 'max:24'],
            'installments.first_due_date' => ['required_with:installments', 'date'],
            'installments.interval_days' => ['nullable', 'integer', 'min:7', 'max:365'],
        ];
    }

    /**
     * Proyek invoice harus milik klien yang sama; proyek per item harus
     * proyek invoice itu sendiri atau sub-proyeknya.
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
            $invoice = $this->route('invoice');
            if ($invoice instanceof Invoice) {
                $clientId = $invoice->client_id; // klien tidak berubah saat edit
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
            $invoiceProject = $this->input('project_id') ? $projects->get((int) $this->input('project_id')) : null;

            if ($invoiceProject && $invoiceProject->client_id !== (int) $clientId) {
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
                    && (! $invoiceProject
                        || $itemProject->id === $invoiceProject->id
                        || $itemProject->parent_id === $invoiceProject->id);

                if (! $ok) {
                    $validator->errors()->add("items.{$i}.project_id", 'Sub-proyek harus bagian dari proyek invoice ini.');
                }
            }
        }];
    }
}
