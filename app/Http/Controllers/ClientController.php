<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Support\ProjectStats;
use App\Support\XlsxWriter;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));

        $clients = Client::query()
            ->when($q !== '', fn ($w) => $w->where(function ($x) use ($q) {
                $x->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%");
            }))
            ->withCount(['invoices', 'products'])
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'filters' => ['q' => $q],
        ]);
    }

    public function show(Client $client, Request $request): Response
    {
        $invoices = $client->invoices()
            ->with(['project.parent', 'items.product', 'items.project', 'items.sessions', 'payments'])
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        $summary = $client->invoices()->where('status', '!=', 'cancelled')->toBase()
            ->selectRaw('COALESCE(SUM(total), 0) as total_billed, COALESCE(SUM(paid_amount), 0) as total_paid, COUNT(*) as invoice_count')
            ->first();

        $products = $client->products()->orderBy('name')->get();

        return Inertia::render('clients/show', [
            'client' => $client,
            'invoices' => $invoices,
            'products' => $products,
            'projects' => ProjectStats::tree($client->projects()->topLevel()->with('children')->get()),
            'summary' => [
                'total_billed' => round((float) $summary->total_billed, 2),
                'total_paid' => round((float) $summary->total_paid, 2),
                'outstanding' => round((float) $summary->total_billed - (float) $summary->total_paid, 2),
                'invoice_count' => (int) $summary->invoice_count,
                'product_count' => $products->count(),
            ],
        ]);
    }

    public function export(Client $client): HttpResponse
    {
        $client->load([
            'invoices' => fn ($q) => $q->orderByDesc('issue_date')->orderByDesc('id'),
            'invoices.items.product',
            'invoices.items.sessions',
            'invoices.payments',
            'products',
        ]);

        $invoices = $client->invoices;
        $products = $client->products;
        $writer = new XlsxWriter;

        $this->exportSummary($writer, $client, $invoices, $products);
        $this->exportItemDetail($writer, $invoices);
        $this->exportPayments($writer, $invoices);
        $this->exportProducts($writer, $products);

        $filename = 'klien-'.Str::slug($client->name).'-'.date('Ymd-His').'.xlsx';

        return response($writer->build(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @param  Collection<int, Invoice>  $invoices
     * @param  Collection<int, Product>  $products
     */
    private function exportSummary(XlsxWriter $writer, Client $client, Collection $invoices, Collection $products): void
    {
        $totalBilled = (float) $invoices->sum('total');
        $totalPaid = (float) $invoices->sum('paid_amount');
        $outstanding = $totalBilled - $totalPaid;

        $rows = [];
        $rows[] = [['v' => 'LAPORAN KLIEN', 's' => XlsxWriter::XF_SECTION]];
        $rows[] = [['v' => $client->name, 's' => XlsxWriter::XF_BOLD]];
        $rows[] = ['', ''];
        $rows[] = [['v' => 'Email', 's' => XlsxWriter::XF_BOLD], (string) $client->email];
        $rows[] = [['v' => 'Telepon', 's' => XlsxWriter::XF_BOLD], (string) $client->phone];
        $rows[] = [['v' => 'Alamat', 's' => XlsxWriter::XF_BOLD], (string) $client->address];
        $rows[] = [['v' => 'Catatan', 's' => XlsxWriter::XF_BOLD], (string) $client->notes];
        $rows[] = ['', ''];
        $rows[] = [['v' => 'RINGKASAN KEUANGAN', 's' => XlsxWriter::XF_SECTION]];
        $rows[] = [
            ['v' => 'Total Ditagih', 's' => XlsxWriter::XF_TABLE],
            ['v' => round($totalBilled, 2), 's' => XlsxWriter::XF_TABLE_MONEY],
        ];
        $rows[] = [
            ['v' => 'Total Dibayar', 's' => XlsxWriter::XF_TABLE],
            ['v' => round($totalPaid, 2), 's' => XlsxWriter::XF_TABLE_MONEY],
        ];
        $rows[] = [
            ['v' => 'Sisa Tagihan', 's' => XlsxWriter::XF_TOTAL_LABEL],
            ['v' => round($outstanding, 2), 's' => XlsxWriter::XF_TOTAL_MONEY],
        ];
        $rows[] = [
            ['v' => 'Jumlah Invoice', 's' => XlsxWriter::XF_TABLE],
            ['v' => $invoices->count(), 's' => XlsxWriter::XF_TABLE_NUMBER],
        ];
        $rows[] = [
            ['v' => 'Jumlah Produk', 's' => XlsxWriter::XF_TABLE],
            ['v' => $products->count(), 's' => XlsxWriter::XF_TABLE_NUMBER],
        ];
        $rows[] = ['', ''];
        $rows[] = [['v' => 'DETAIL TRANSAKSI', 's' => XlsxWriter::XF_SECTION]];
        $rows[] = [
            ['v' => 'No Invoice', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Tanggal', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Status', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Total', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Dibayar', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Sisa', 's' => XlsxWriter::XF_HEADER],
        ];
        foreach ($invoices as $inv) {
            $rows[] = [
                ['v' => $inv->invoice_number, 's' => XlsxWriter::XF_TABLE_BOLD],
                ['v' => $inv->issue_date->toDateString(), 's' => XlsxWriter::XF_TABLE],
                ['v' => $inv->status, 's' => XlsxWriter::XF_TABLE],
                ['v' => (float) $inv->total, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => (float) $inv->paid_amount, 's' => XlsxWriter::XF_TABLE_MONEY],
                ['v' => (float) $inv->remainingAmount(), 's' => XlsxWriter::XF_TABLE_MONEY_BOLD],
            ];
        }
        $rows[] = [
            ['v' => 'TOTAL', 's' => XlsxWriter::XF_TOTAL_LABEL],
            ['v' => '', 's' => XlsxWriter::XF_TOTAL_LABEL],
            ['v' => '', 's' => XlsxWriter::XF_TOTAL_LABEL],
            ['v' => round($totalBilled, 2), 's' => XlsxWriter::XF_TOTAL_MONEY],
            ['v' => round($totalPaid, 2), 's' => XlsxWriter::XF_TOTAL_MONEY],
            ['v' => round($outstanding, 2), 's' => XlsxWriter::XF_TOTAL_MONEY],
        ];

        $writer->addSheet('Ringkasan', $rows, ['columns' => [0 => 22, 1 => 30]]);
    }

    /**
     * @param  Collection<int, Invoice>  $invoices
     */
    private function exportItemDetail(XlsxWriter $writer, Collection $invoices): void
    {
        $rows = [];
        $rows[] = [['v' => 'RINCIAN PER INVOICE (PRODUK, URAIAN & HARGA)', 's' => XlsxWriter::XF_SECTION]];
        $rows[] = ['', ''];

        foreach ($invoices as $inv) {
            $rows[] = [
                ['v' => 'INVOICE  '.$inv->invoice_number, 's' => XlsxWriter::XF_SECTION],
                ['v' => 'Tanggal: '.$inv->issue_date->toDateString(), 's' => XlsxWriter::XF_SECTION],
                ['v' => 'Status: '.$inv->status, 's' => XlsxWriter::XF_SECTION],
                ['v' => '', 's' => XlsxWriter::XF_SECTION],
                ['v' => 'Mode: '.$inv->invoice_mode, 's' => XlsxWriter::XF_SECTION],
            ];
            $rows[] = [
                ['v' => 'Produk', 's' => XlsxWriter::XF_HEADER],
                ['v' => 'Uraian', 's' => XlsxWriter::XF_HEADER],
                ['v' => 'Qty/Jam', 's' => XlsxWriter::XF_HEADER],
                ['v' => 'Harga Satuan', 's' => XlsxWriter::XF_HEADER],
                ['v' => 'Jumlah', 's' => XlsxWriter::XF_HEADER],
            ];

            foreach ($inv->items as $it) {
                $rows[] = [
                    ['v' => $it->product->name ?? '-', 's' => XlsxWriter::XF_TABLE_BOLD],
                    ['v' => (string) $it->description, 's' => XlsxWriter::XF_TABLE],
                    $inv->invoice_mode === 'hourly'
                        ? ['v' => (float) $it->hours_qty, 's' => XlsxWriter::XF_TABLE_NUMBER]
                        : ['v' => '', 's' => XlsxWriter::XF_TABLE],
                    ['v' => (float) $it->unit_price, 's' => XlsxWriter::XF_TABLE_MONEY],
                    ['v' => (float) $it->line_total, 's' => XlsxWriter::XF_TABLE_MONEY],
                ];
            }

            $rows[] = [
                ['v' => 'Subtotal', 's' => XlsxWriter::XF_TABLE],
                ['v' => '', 's' => XlsxWriter::XF_TABLE],
                ['v' => '', 's' => XlsxWriter::XF_TABLE],
                ['v' => '', 's' => XlsxWriter::XF_TABLE],
                ['v' => (float) $inv->subtotal, 's' => XlsxWriter::XF_TABLE_MONEY],
            ];
            if ((float) $inv->discount > 0) {
                $rows[] = [
                    ['v' => 'Diskon', 's' => XlsxWriter::XF_TABLE],
                    ['v' => '', 's' => XlsxWriter::XF_TABLE],
                    ['v' => '', 's' => XlsxWriter::XF_TABLE],
                    ['v' => '', 's' => XlsxWriter::XF_TABLE],
                    ['v' => (float) $inv->discount, 's' => XlsxWriter::XF_TABLE_MONEY],
                ];
            }
            $rows[] = [
                ['v' => 'Total Tagihan', 's' => XlsxWriter::XF_TOTAL_LABEL],
                ['v' => '', 's' => XlsxWriter::XF_TOTAL_LABEL],
                ['v' => '', 's' => XlsxWriter::XF_TOTAL_LABEL],
                ['v' => '', 's' => XlsxWriter::XF_TOTAL_LABEL],
                ['v' => (float) $inv->total, 's' => XlsxWriter::XF_TOTAL_MONEY],
            ];
            $rows[] = [
                ['v' => 'Total Dibayar', 's' => XlsxWriter::XF_TABLE],
                ['v' => '', 's' => XlsxWriter::XF_TABLE],
                ['v' => '', 's' => XlsxWriter::XF_TABLE],
                ['v' => 'Sisa', 's' => XlsxWriter::XF_TABLE],
                ['v' => (float) $inv->remainingAmount(), 's' => XlsxWriter::XF_TABLE_MONEY_BOLD],
            ];
            $rows[] = ['', ''];
        }

        $writer->addSheet('Transaksi & Uraian', $rows, ['columns' => [0 => 22, 1 => 46, 2 => 12, 3 => 16, 4 => 16]]);
    }

    /**
     * @param  Collection<int, Invoice>  $invoices
     */
    private function exportPayments(XlsxWriter $writer, Collection $invoices): void
    {
        $rows = [[
            ['v' => 'No Invoice', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Tanggal Bayar', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Metode', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Status', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Jumlah', 's' => XlsxWriter::XF_HEADER],
        ]];

        foreach ($invoices as $inv) {
            foreach ($inv->payments as $p) {
                $rows[] = [
                    ['v' => $inv->invoice_number, 's' => XlsxWriter::XF_TABLE],
                    ['v' => $p->paid_at?->format('Y-m-d H:i') ?? ($p->created_at?->format('Y-m-d H:i') ?? ''), 's' => XlsxWriter::XF_TABLE],
                    ['v' => $p->method, 's' => XlsxWriter::XF_TABLE],
                    ['v' => $p->status, 's' => XlsxWriter::XF_TABLE],
                    ['v' => (float) $p->amount, 's' => XlsxWriter::XF_TABLE_MONEY],
                ];
            }
        }

        $writer->addSheet('Pembayaran', $rows, ['columns' => [0 => 22, 1 => 20, 2 => 16, 3 => 12, 4 => 14], 'freeze' => 1]);
    }

    /**
     * @param  Collection<int, Product>  $products
     */
    private function exportProducts(XlsxWriter $writer, Collection $products): void
    {
        $rows = [[
            ['v' => 'Nama Produk', 's' => XlsxWriter::XF_HEADER],
            ['v' => 'Status', 's' => XlsxWriter::XF_HEADER],
        ]];

        foreach ($products as $p) {
            $rows[] = [
                ['v' => $p->name, 's' => XlsxWriter::XF_TABLE],
                ['v' => $p->is_active ? 'Aktif' : 'Nonaktif', 's' => XlsxWriter::XF_TABLE],
            ];
        }

        $writer->addSheet('Produk', $rows, ['columns' => [0 => 32, 1 => 14], 'freeze' => 1]);
    }

    public function store(Request $request): RedirectResponse
    {
        $client = Client::create($request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
        ]));

        return back()
            ->with('success', 'Klien ditambahkan.')
            ->with('access_key', ['client_id' => $client->id, 'key' => $client->access_key]);
    }

    public function update(Request $request, Client $client): RedirectResponse
    {
        $client->update($request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
        ]));

        return back()->with('success', 'Klien diperbarui.');
    }

    public function destroy(Client $client): RedirectResponse
    {
        // Riwayat keuangan tidak boleh hilang bersama klien.
        $count = $client->invoices()->count();
        if ($count > 0) {
            return back()->with('error', "Klien tidak bisa dihapus karena masih punya {$count} invoice.");
        }

        $client->delete();

        return back()->with('success', 'Klien dihapus.');
    }

    /**
     * Buat kunci portal baru. Kunci lama langsung tidak berlaku; plaintext
     * hanya ditampilkan sekali (lewat flash `access_key`).
     */
    public function regenerateKey(Client $client): RedirectResponse
    {
        $key = $client->regenerateAccessKey();

        return back()
            ->with('success', 'Kunci akses baru dibuat. Salin sekarang — kunci tidak bisa dilihat lagi.')
            ->with('access_key', ['client_id' => $client->id, 'key' => $key]);
    }
}
