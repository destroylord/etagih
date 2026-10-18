<?php

namespace App\Services;

class PaymentStatus
{
    public static function fromQrisly(?string $status): string
    {
        return match (strtolower((string) $status)) {
            'paid', 'success', 'completed' => 'success',
            'pending', 'unpaid' => 'pending',
            'expire', 'expired' => 'expired',
            'failed', 'cancel', 'cancelled' => 'failed',
            default => 'pending',
        };
    }
}
