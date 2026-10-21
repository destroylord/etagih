<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Access;
use App\Support\InvoiceReports;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        // Staf: semua angka & daftar hanya untuk klien dari proyek yang ia ikuti.
        $clientIds = Access::clientIds($user);
        $invoices = fn () => Invoice::query()->visibleTo($user);

        $monthStart = now()->startOfMonth();

        $stats = [
            'total_count' => $invoices()->count(),
            // Lunas bulan ini = pelunasan terjadi bulan ini (bukan sekadar diedit).
            'paid_this_month_count' => $invoices()->where('status', 'paid')
                ->whereHas('payments', fn ($q) => $q->where('status', 'success')->where('paid_at', '>=', $monthStart))
                ->count(),
            'paid_this_month_amount' => (float) Payment::where('status', 'success')
                ->when($clientIds !== null, fn ($q) => $q->whereHas('invoice', fn ($i) => $i->whereIn('client_id', $clientIds)))
                ->where('paid_at', '>=', $monthStart)->sum('amount'),
            'outstanding_amount' => (float) $invoices()->whereIn('status', ['sent', 'partial', 'overdue'])
                ->toBase()
                ->selectRaw('COALESCE(SUM(total - paid_amount), 0) as outstanding')
                ->value('outstanding'),
            'pending_count' => $invoices()->whereIn('status', ['sent', 'partial'])->count(),
            'overdue_count' => $invoices()->where('status', 'overdue')->count(),
        ];

        $recentInvoices = $invoices()->with('client')
            ->orderByDesc('id')
            ->limit(10)
            ->get(['id', 'invoice_number', 'client_id', 'total', 'paid_amount', 'status', 'issue_date', 'due_date']);

        // Tagihan yang jatuh tempo 14 hari ke depan (perlu di-follow-up).
        $upcomingDue = $invoices()->with('client:id,name')
            ->whereIn('status', ['sent', 'partial'])
            ->whereBetween('due_date', [now()->toDateString(), now()->addDays(14)->toDateString()])
            ->orderBy('due_date')
            ->limit(5)
            ->get(['id', 'invoice_number', 'client_id', 'total', 'paid_amount', 'status', 'due_date']);

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'recentInvoices' => $recentInvoices,
            'upcomingDue' => $upcomingDue,
            'revenue' => InvoiceReports::monthlyRevenue(6, clientIds: $clientIds),
        ]);
    }
}
