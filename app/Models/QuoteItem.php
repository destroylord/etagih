<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Baris penawaran: line_total = quantity × unit_price.
 *
 * @property int $id
 * @property int $quote_id
 * @property int|null $product_id
 * @property int|null $project_id
 * @property string $description
 * @property numeric-string|float $quantity
 * @property numeric-string|float $unit_price
 * @property numeric-string|float $line_total
 * @property int $sort_order
 * @property-read Quote $quote
 * @property-read Product|null $product
 * @property-read Project|null $project
 */
#[Fillable([
    'quote_id',
    'product_id',
    'project_id',
    'description',
    'quantity',
    'unit_price',
    'line_total',
    'sort_order',
])]
class QuoteItem extends Model
{
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Quote, $this>
     */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
