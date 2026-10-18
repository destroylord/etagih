<?php

namespace App\Actions\Invoice;

use App\Support\InvoiceNumberGenerator as Generator;

/**
 * Atomic generator nomor invoice: INV-YYYYMMDD-XXXX
 * Counter di-reset setiap hari, disimpan di cache counter locks agar tidak duplicate
 * di multi-request (maksimum aman untuk single-user app).
 */
class GenerateInvoiceNumber
{
    public function __construct(private readonly Generator $generator) {}

    public function execute(): string
    {
        return $this->generator->next();
    }
}
