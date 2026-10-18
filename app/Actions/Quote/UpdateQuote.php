<?php

namespace App\Actions\Quote;

use App\Models\Quote;
use Illuminate\Support\Facades\DB;

class UpdateQuote
{
    public function __construct(private readonly QuoteLineBuilder $lines) {}

    /**
     * Update penawaran draft secara in-place. Nomor & public_token tidak berubah;
     * item lama dihapus lalu dibuat ulang (atomic).
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Quote $quote, array $data): Quote
    {
        return DB::transaction(function () use ($quote, $data) {
            $quote->fill([
                'project_id' => empty($data['project_id']) ? null : (int) $data['project_id'],
                'issue_date' => $data['issue_date'],
                'valid_until' => CreateQuote::validUntil($data),
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
            ])->save();

            $quote->items()->delete();
            $this->lines->buildItems($quote, $data);
            $quote->save();

            return $quote->fresh(['items']) ?? $quote;
        });
    }
}
