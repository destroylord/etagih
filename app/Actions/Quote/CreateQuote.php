<?php

namespace App\Actions\Quote;

use App\Models\Client;
use App\Models\Quote;
use App\Support\QuoteNumberGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CreateQuote
{
    public function __construct(
        private readonly QuoteNumberGenerator $numbers,
        private readonly QuoteLineBuilder $lines,
    ) {}

    /**
     * Payload tervalidasi (lihat StoreQuoteRequest): client_id | client{name,...},
     * project_id, issue_date, valid_until, discount_type/discount_value, tax_rate,
     * pph_rate, notes, terms, items[{description, quantity, unit_price, product_id, project_id}].
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(array $data): Quote
    {
        return DB::transaction(function () use ($data) {
            $client = $this->resolveClient($data);

            $quote = new Quote([
                'client_id' => $client->id,
                'project_id' => empty($data['project_id']) ? null : (int) $data['project_id'],
                'quote_number' => $this->numbers->next(),
                'issue_date' => $data['issue_date'],
                'valid_until' => self::validUntil($data),
                'status' => 'draft',
                'public_token' => Str::random(40),
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
            ]);
            $quote->save();

            $this->lines->buildItems($quote, $data);
            $quote->save();

            return $quote->fresh(['items']) ?? $quote;
        });
    }

    /**
     * Berlaku sampai: input, atau default tanggal terbit + 14 hari.
     *
     * @param  array<string, mixed>  $data
     */
    public static function validUntil(array $data): string
    {
        if (! empty($data['valid_until'])) {
            return (string) $data['valid_until'];
        }

        return CarbonImmutable::parse((string) $data['issue_date'])
            ->addDays(Quote::DEFAULT_VALID_DAYS)
            ->toDateString();
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
