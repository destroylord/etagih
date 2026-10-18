<?php

use App\Support\InvoiceNumberFormatter;

it('builds yearly invoice number with prefix, year, padded counter', function () {
    $svc = new InvoiceNumberFormatter;
    $out = $svc->generate([
        'invoice_prefix' => 'INV',
        'invoice_padding' => 4,
        'invoice_reset_period' => 'yearly',
    ], 7, '2026-01-01');

    expect($out)->toBe('INV-2026-0007');
});

it('builds monthly invoice number with YYYY-MM segment', function () {
    $svc = new InvoiceNumberFormatter;
    $out = $svc->generate([
        'invoice_prefix' => 'INV',
        'invoice_padding' => 4,
        'invoice_reset_period' => 'monthly',
    ], 42, '2026-03-15');

    expect($out)->toBe('INV-2026-03-0042');
});

it('omits period segment when reset_period is none', function () {
    $svc = new InvoiceNumberFormatter;
    $out = $svc->generate([
        'invoice_prefix' => 'INV',
        'invoice_padding' => 5,
        'invoice_reset_period' => 'none',
    ], 123, '2026-01-01');

    expect($out)->toBe('INV-00123');
});

it('uses defaults when config fields missing', function () {
    $svc = new InvoiceNumberFormatter;
    $out = $svc->generate([], 3, '2026-01-01');

    expect($out)->toBe('INV-2026-0003');
});

it('throws when prefix empty', function () {
    $svc = new InvoiceNumberFormatter;
    $svc->generate(['invoice_prefix' => '   '], 1, '2026-01-01');
})->throws(InvalidArgumentException::class);

it('zero-pads even when counter is zero', function () {
    $svc = new InvoiceNumberFormatter;
    $out = $svc->generate([
        'invoice_prefix' => 'INV',
        'invoice_padding' => 4,
        'invoice_reset_period' => 'none',
    ], 0, '2026-01-01');

    expect($out)->toBe('INV-0000');
});
