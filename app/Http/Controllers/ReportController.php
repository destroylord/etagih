<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Project;
use App\Support\InvoiceReports;
use App\Support\ProjectStats;
use App\Support\XlsxWriter;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $months = in_array($request->integer('months'), [6, 12, 24], true) ? $request->integer('months') : 12;
        $revenue = InvoiceReports::monthlyRevenue($months);

        $yearStart = now()->startOfYear();

        return Inertia::render('reports/index', [
            'months' => $months,
            'revenue' => $revenue,
            'aging' => InvoiceReports::aging(),
            'topClients' => InvoiceReports::topOutstandingClients(),
            // Proyek utama yang punya tagihan / nilai pekerjaan, beserta sub-proyeknya.
            'projects' => $this->projectSummary(),
            'summary' => [
                'revenue_period' => round(array_sum(array_column($revenue, 'amount')), 2),
                'revenue_ytd' => round((float) Payment::where('status', 'success')->where('paid_at', '>=', $yearStart)->sum('amount'), 2),
                'billed_ytd' => round((float) Invoice::whereNotIn('status', ['draft', 'cancelled'])->where('issue_date', '>=', $yearStart)->sum('total'), 2),
                'outstanding' => round(array_sum(array_column(InvoiceReports::aging(), 'amount')), 2),
            ],
        ]);
    }

    /**
     * Export semua invoice (sesuai filter) ke Excel.
     */
    public function exportInvoices(Request $request): HttpResponse
    {
        $data = $request->validate([
            'status' => ['nullable', 'string'],
            'type' => ['nullable', 'string'],
            'project_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $invoices = Invoice::query()
            ->with(['client:id,name', 'project.parent:id,name'])
            ->when($data['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($data['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->when($data['project_id'] ?? null, fn ($q, $v) => $q->whereIn('project_id', Project::query()->whereKey((int) $v)->first()?->selfAndChildIds() ?? [0]))
            ->when($data['date_from'] ?? null, fn ($q, $v) => $q->where('issue_date', '>=', $v))
            ->when($data['date_to'] ?? null, fn ($q, $v) => $q->where('issue_date', '<=', $v))
            ->when($data['q'] ?? null, function ($q, $v) {
                $like = '%'.$v.'%';
                $q->where(fn ($w) => $w->where('invoice_number', 'like', $like)
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $like)));
            })
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->get();

        $rows = [[
            ['v' => 'No Invoice', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Klien', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Proyek', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Tanggal', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Jatuh Tempo', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Status', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Tipe', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Subtotal', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Diskon', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Pajak', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Total', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Dibayar', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Sisa', 's' => XlsxWriter::XF_HEADER],
        ]];

        foreach ($invoices as $inv) {
            $rows[] = [
                ['v' => $inv->invoice_number, 's' => XlsxWriter::XF_TABLE_BOLD],
                ['v' => (string) ($inv->client->name ?? ''), 's' => XlsxWriter::XF_TABLE],
                ['v' => (string) ($inv->project->full_name ?? ''), 's' => XlsxWriter::XF_TABLE],
                ['v' => $inv->issue_date->toDateString(), 's' => XlsxWriter::XF_TABLE],
                ['v' => $inv->due_date?->toDateString() ?? '', 's' => XlsxWriter::XF_TABLE],
                ['v' => $inv->status, 's' => XlsxWriter::XF_TABLE],
                ['v' => $inv->type === 'installment' ? 'Cicilan' : 'Penuh', 's' => XlsxWriter::XF_TABLE],
                ['v' => (float) $inv->subtotal, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => (float) $inv->discount, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => (float) $inv->tax_amount, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => (float) $inv->total, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => (float) $inv->paid_amount, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => $inv->isCancelled() ? 0.0 : $inv->remainingAmount(), 's' => XlsxWriter::XF_TABLE_MONEY_BOLD],
            ];
        }

        $writer = new XlsxWriter;
        $writer->addSheet('Invoice', $rows, [
            'columns' => [0 => 22, 1 => 26, 2 => 26, 3 => 12, 4 => 12, 5 => 11, 6 => 10, 7 => 14, 8 => 12, 9 => 12, 10 => 14, 11 => 14, 12 => 14],
            'freeze' => 1,
        ]);

        return response($writer->build(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="invoices-'.date('Ymd-His').'.xlsx"',
        ]);
    }

    /**
     * Proyek utama yang punya tagihan / nilai pekerjaan / jam tercatat, beserta sub-proyeknya.
     *
     * @return list<array<string, mixed>>
     */
    private function projectSummary(): array
    {
        $projects = Project::query()->topLevel()->with(['children', 'client:id,name'])->orderBy('name')->get();
        $clients = $projects->mapWithKeys(fn (Project $p) => [$p->id => $p->client->only(['id', 'name'])]);

        $rows = array_filter(
            ProjectStats::tree($projects),
            fn (array $node) => $node['stats']['billed'] > 0 || $node['stats']['work_value'] > 0 || $node['stats']['tracked_seconds'] > 0,
        );
        usort($rows, fn (array $a, array $b) => $b['stats']['billed'] <=> $a['stats']['billed']);

        return array_map(fn (array $node) => [...$node, 'client' => $clients[$node['id']] ?? null], $rows);
    }
}
