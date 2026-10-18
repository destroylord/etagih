<?php

namespace App\Actions\Invoice;

use App\Models\Client;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CreateInvoice
{
    public function __construct(
        private readonly GenerateInvoiceNumber $genNumber,
        private readonly InvoiceLineBuilder $lines,
    ) {}

    /**
     * Payload tervalidasi (lihat StoreInvoiceRequest): client_id | client{name,...},
     * invoice_mode, type, issue_date, due_date, discount_type/discount_value,
     * tax_rate, recurrence, notes, items[], installments{count, first_due_date, interval_days}.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(array $data): Invoice
    {
        return DB::transaction(function () use ($data) {
            $client = $this->resolveClient($data);

            $invoice = new Invoice([
                'client_id' => $client->id,
                'project_id' => empty($data['project_id']) ? null : (int) $data['project_id'],
                'invoice_number' => $this->genNumber->execute(),
                'issue_date' => $data['issue_date'],
                'due_date' => empty($data['due_date']) ? null : $data['due_date'],
                'invoice_mode' => $data['invoice_mode'],
                'type' => $data['type'],
                'status' => 'draft',
                'public_token' => Str::random(40),
                'notes' => $data['notes'] ?? null,
                'recurrence' => $data['recurrence'] ?? 'none',
                'recurrence_auto_send' => (bool) ($data['recurrence_auto_send'] ?? false),
            ]);
            $invoice->save();

            $this->lines->buildItems($invoice, $data);

            if ($data['type'] === 'installment' && ! empty($data['installments'])) {
                $this->lines->buildSchedules($invoice, $data['installments']);
            }

            $invoice->save();

            return $invoice->fresh(['items', 'schedules']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveClient(array $data): Client
    {
        if (! empty($data['client_id'])) {
            return Client::query()->findOrFail((int) $data['client_id']);
        }
        if (! empty($data['client']) && ! empty($data['client']['name'])) {
            return Client::create($data['client']);
        }
        throw new InvalidArgumentException('client_id or client.name is required.');
    }
}
