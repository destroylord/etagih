<?php

namespace App\Support;

use App\Models\Invoice;
use App\Models\Payment;
use Carbon\CarbonInterface;

/**
 * Agregasi laporan (pendapatan, umur piutang, klien). Dihitung di PHP supaya
 * sama hasilnya di MySQL maupun SQLite — volume data single-tenant kecil.
 */
class InvoiceReports
{
    /** Status yang dihitung sebagai piutang aktif. */
    public const OPEN_STATUSES = ['sent', 'partial', 'overdue'];

    /**
     * Pendapatan (pembayaran sukses) per bulan, N bulan terakhir termasuk bulan ini.
     *
     * @return list<array{month: string, label: string, amount: float, count: int}>
     */
    public static function monthlyRevenue(int $months = 12, ?CarbonInterface $until = null): array
    {
        $end = ($until ?? now())->copy()->endOfMonth();
        $start = $end->copy()->subMonthsNoOverflow($months - 1)->startOfMonth();

        $payments = Payment::query()
            ->where('status', 'success')
            ->whereBetween('paid_at', [$start, $end])
            ->get(['amount', 'paid_at'])
            ->groupBy(fn (Payment $p) => $p->paid_at->format('Y-m'));

        $rows = [];
        // Tanggal di app ini immutable (CarbonImmutable) → assign ulang hasil add.
        for ($m = $start; $m->lte($end); $m = $m->addMonthNoOverflow()) {
            $key = $m->format('Y-m');
            $group = $payments->get($key);
            $rows[] = [
                'month' => $key,
                'label' => $m->translatedFormat('M Y'),
                'amount' => round((float) ($group?->sum('amount') ?? 0), 2),
                'count' => $group?->count() ?? 0,
            ];
        }

        return $rows;
    }

    /**
     * Umur piutang berdasarkan jatuh tempo.
     *
     * @return list<array{key: string, label: string, amount: float, count: int}>
     */
    public static function aging(?CarbonInterface $today = null): array
    {
        $today = ($today ?? now())->copy()->startOfDay();

        $buckets = [
            'current' => ['label' => 'Belum jatuh tempo', 'amount' => 0.0, 'count' => 0],
            '1_30' => ['label' => '1–30 hari', 'amount' => 0.0, 'count' => 0],
            '31_60' => ['label' => '31–60 hari', 'amount' => 0.0, 'count' => 0],
            '61_90' => ['label' => '61–90 hari', 'amount' => 0.0, 'count' => 0],
            '90_plus' => ['label' => '> 90 hari', 'amount' => 0.0, 'count' => 0],
        ];

        $invoices = Invoice::query()
            ->whereIn('status', self::OPEN_STATUSES)
            ->get(['id', 'due_date', 'total', 'paid_amount']);

        foreach ($invoices as $invoice) {
            $remaining = $invoice->remainingAmount();
            if ($remaining <= 0) {
                continue;
            }

            $daysLate = $invoice->due_date && $invoice->due_date->lt($today)
                ? (int) $invoice->due_date->diffInDays($today)
                : 0;

            $key = match (true) {
                $daysLate === 0 => 'current',
                $daysLate <= 30 => '1_30',
                $daysLate <= 60 => '31_60',
                $daysLate <= 90 => '61_90',
                default => '90_plus',
            };

            $buckets[$key]['amount'] = round($buckets[$key]['amount'] + $remaining, 2);
            $buckets[$key]['count']++;
        }

        $rows = [];
        foreach ($buckets as $key => $b) {
            $rows[] = ['key' => $key, ...$b];
        }

        return $rows;
    }

    /**
     * Klien dengan piutang terbesar.
     *
     * @return list<array{id: int, name: string, outstanding: float, invoice_count: int}>
     */
    public static function topOutstandingClients(int $limit = 5): array
    {
        $rows = Invoice::query()
            ->whereIn('status', self::OPEN_STATUSES)
            ->with('client:id,name')
            ->get(['id', 'client_id', 'total', 'paid_amount'])
            ->groupBy('client_id')
            ->map(fn ($group) => [
                'id' => (int) $group->first()->client_id,
                'name' => (string) ($group->first()->client->name ?? '—'),
                'outstanding' => round((float) $group->sum(fn (Invoice $i) => $i->remainingAmount()), 2),
                'invoice_count' => $group->count(),
            ])
            ->filter(fn (array $row) => $row['outstanding'] > 0)
            ->sortByDesc('outstanding')
            ->take($limit)
            ->toBase()
            ->all();

        return array_values($rows);
    }
}
