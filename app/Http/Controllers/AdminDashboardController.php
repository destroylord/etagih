<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Support\InvoiceReports;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    public function index(): Response
    {
        $monthStart = now()->startOfMonth();

        $stats = [
            'total_count' => Invoice::count(),
            // Lunas bulan ini = pelunasan terjadi bulan ini (bukan sekadar diedit).
            'paid_this_month_count' => Invoice::where('status', 'paid')
                ->whereHas('payments', fn ($q) => $q->where('status', 'success')->where('paid_at', '>=', $monthStart))
                ->count(),
            'paid_this_month_amount' => (float) Payment::where('status', 'success')
                ->where('paid_at', '>=', $monthStart)->sum('amount'),
            'outstanding_amount' => (float) Invoice::whereIn('status', ['sent', 'partial', 'overdue'])
                ->toBase()
                ->selectRaw('COALESCE(SUM(total - paid_amount), 0) as outstanding')
                ->value('outstanding'),
            'pending_count' => Invoice::whereIn('status', ['sent', 'partial'])->count(),
            'overdue_count' => Invoice::where('status', 'overdue')->count(),
        ];

        $recentInvoices = Invoice::with('client')
            ->orderByDesc('id')
            ->limit(10)
            ->get(['id', 'invoice_number', 'client_id', 'total', 'paid_amount', 'status', 'issue_date', 'due_date']);

        // Tagihan yang jatuh tempo 14 hari ke depan (perlu di-follow-up).
        $upcomingDue = Invoice::with('client:id,name')
            ->whereIn('status', ['sent', 'partial'])
            ->whereBetween('due_date', [now()->toDateString(), now()->addDays(14)->toDateString()])
            ->orderBy('due_date')
            ->limit(5)
            ->get(['id', 'invoice_number', 'client_id', 'total', 'paid_amount', 'status', 'due_date']);

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'recentInvoices' => $recentInvoices,
            'upcomingDue' => $upcomingDue,
            'revenue' => InvoiceReports::monthlyRevenue(6),
        ]);
    }
}
