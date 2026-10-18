<?php

namespace App\Http\Controllers\Invoice;

use App\Actions\Invoice\CancelInvoice;
use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\DuplicateInvoice;
use App\Actions\Invoice\RecordPayment;
use App\Actions\Invoice\SendInvoice;
use App\Actions\Invoice\UpdateInvoice;
use App\Http\Controllers\Controller;
use App\Http\Controllers\WorkSessionController;
use App\Http\Requests\Invoice\StoreInvoiceRequest;
use App\Http\Requests\Invoice\UpdateInvoiceRequest;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Project;
use App\Models\WorkSession;
use App\Support\Settings;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class InvoiceController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Invoice::with(['client', 'project.parent'])->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('project_id')) {
            $project = Project::find($request->integer('project_id'));
            $query->whereIn('project_id', $project ? $project->selfAndChildIds() : [0]);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }
        if ($request->filled('q')) {
            $search = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', $search)
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $search));
            });
        }

        return Inertia::render('invoices/index', [
            'invoices' => $query->paginate(20)->withQueryString(),
            'filters' => $request->only(['status', 'type', 'q', 'project_id']),
            'projects' => WorkSessionController::projectOptions(true),
            // Jumlah invoice per status untuk tab filter.
            'statusCounts' => Invoice::query()
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('invoices/create', [
            'defaultTaxRate' => (float) Settings::current()->default_tax_rate,
            // Dari tombol "Buat invoice" di halaman klien / Time Tracker.
            'preselectedClientId' => $request->integer('client_id') ?: null,
            'preselectedMode' => $request->query('mode') === 'hourly' ? 'hourly' : null,
            'preselectedProjectId' => $request->integer('project_id') ?: null,
            'clients' => Client::orderBy('name')->get(['id', 'name', 'phone', 'email', 'hourly_rate']),
            'projects' => WorkSessionController::projectOptions(),
            'products' => Product::active()->orderBy('name')->get(['id', 'name', 'client_id']),
            // Semua sessions completed (unbilled) — frontend filter by client yg dipilih.
            // Batasi 500 baris; invoice dengan lebih banyak session butuh flow berbeda.
            'unbilledSessions' => WorkSession::with(['client', 'project.parent'])
                ->where('status', 'completed')
                ->orderByDesc('started_at')
                ->limit(500)
                ->get(['id', 'client_id', 'project_id', 'description', 'unit_price', 'duration_seconds', 'started_at']),
        ]);
    }

    public function store(StoreInvoiceRequest $request, CreateInvoice $creator): RedirectResponse
    {
        $invoice = $creator->execute($request->validated());

        return redirect()
            ->route('invoices.show', $invoice)
            ->with('success', 'Invoice dibuat (draft). Klik "Kirim" untuk mengirim ke client.');
    }

    public function show(Invoice $invoice): Response
    {
        $setting = Settings::current();

        return Inertia::render('invoices/show', [
            'invoice' => $invoice->load(['client', 'project.parent', 'items.product', 'items.project', 'items.sessions', 'schedules', 'payments', 'recurringParent:id,invoice_number']),
            'settings' => [
                'company_name' => $setting->company_name,
                'company_address' => $setting->company_address,
                'company_email' => $setting->company_email,
                'company_phone' => $setting->company_phone,
                'logo_url' => $setting->logoUrl(),
                'invoice_footer_text' => $setting->invoice_footer_text,
                'company_tax_id' => $setting->company_tax_id,
                'signature_url' => $setting->signatureUrl(),
                'signer_name' => $setting->signer_name,
                'signer_title' => $setting->signer_title,
                'terms' => $setting->invoiceTerms(),
                'accent_color' => $setting->pdf_accent_color,
                'stamp_duty_enabled' => (bool) ($setting->stamp_duty_enabled ?? true),
            ],
            'recurringChildren' => Invoice::where('recurring_parent_id', $invoice->id)
                ->latest('issue_date')
                ->limit(12)
                ->get(['id', 'invoice_number', 'issue_date', 'status', 'total']),
        ]);
    }

    public function edit(Invoice $invoice): Response
    {
        abort_unless($invoice->status === 'draft', 422, 'Hanya invoice draft yang bisa diedit.');

        return Inertia::render('invoices/edit', [
            'invoice' => $invoice->load(['client', 'project.parent', 'items', 'items.project', 'items.sessions', 'schedules']),
            'clients' => Client::orderBy('name')->get(['id', 'name', 'phone', 'email', 'hourly_rate']),
            'projects' => WorkSessionController::projectOptions(),
            'products' => Product::with('client')->orderBy('name')->get(['id', 'name', 'client_id']),
            // Sessions yg masih unbilled utk client ini (belum masuk invoice lain).
            'unbilledSessions' => WorkSession::with(['client', 'project.parent'])
                ->where('client_id', $invoice->client_id)
                ->where('status', 'completed')
                ->orderByDesc('started_at')
                ->get(),
        ]);
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice, UpdateInvoice $updater): RedirectResponse
    {
        abort_unless($invoice->status === 'draft', 422, 'Hanya invoice draft yang bisa diedit.');

        $data = $request->validated();

        // Untuk full payment, installments tidak dikirim — pakai dummy agar validasi
        // tidak reject. BuildInstallmentSchedules tetap di-skip di Updater jika type=full.
        if (($data['type'] ?? 'full') !== 'installment') {
            $data['installments'] = [];
        }

        $updated = $updater->execute($invoice, $data);

        return redirect()->route('invoices.show', $updated)->with('success', 'Invoice diperbarui.');
    }

    public function destroy(Invoice $invoice): RedirectResponse
    {
        abort_unless($invoice->status === 'draft', 422, 'Hanya draft yang bisa dihapus.');

        DB::transaction(function () use ($invoice) {
            // Kembalikan sesi Time Tracker ke pool "belum ditagih" — tanpa ini sesi
            // tetap "billed" dengan invoice_id null dan jamnya tidak bisa ditagih lagi.
            WorkSession::where('invoice_id', $invoice->id)
                ->where('status', 'billed')
                ->update(['invoice_id' => null, 'invoice_item_id' => null, 'status' => 'completed']);

            $invoice->delete();
        });

        return redirect()->route('invoices.index')->with('success', 'Invoice dihapus.');
    }

    public function send(Invoice $invoice, SendInvoice $sender): RedirectResponse
    {
        $result = $sender->execute($invoice);
        $invoice = $result['invoice'];

        if (! $result['sent']) {
            // Status bukan draft → nothing to do, gak ngirim WA lagi.
            return redirect()->route('invoices.show', $invoice)->with('success', 'Invoice sudah dikirim sebelumnya.');
        }

        return redirect()->route('invoices.show', $invoice)
            ->with(...$this->notifyMessage($result['wa_sent'], $result['email_sent'], 'Invoice dikirim'));
    }

    public function resend(Invoice $invoice, SendInvoice $sender): RedirectResponse
    {
        try {
            $result = $sender->resend($invoice);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with(...$this->notifyMessage($result['wa_sent'], $result['email_sent'], 'Invoice dikirim ulang'));
    }

    public function cancel(Request $request, Invoice $invoice, CancelInvoice $canceller): RedirectResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        try {
            $canceller->execute($invoice, $data['reason'] ?? null);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Invoice dibatalkan.');
    }

    public function duplicate(Invoice $invoice, DuplicateInvoice $duplicator): RedirectResponse
    {
        $copy = $duplicator->execute($invoice);

        return redirect()->route('invoices.edit', $copy)
            ->with('success', "Invoice diduplikat menjadi draft {$copy->invoice_number}. Periksa lalu simpan.");
    }

    public function stopRecurrence(Invoice $invoice): RedirectResponse
    {
        $invoice->update(['recurrence' => 'none', 'recurrence_next_date' => null]);

        return back()->with('success', 'Invoice berulang dihentikan.');
    }

    /**
     * Catat pembayaran manual (transfer bank, tunai, dll).
     */
    public function recordPayment(Request $request, Invoice $invoice, RecordPayment $recorder): RedirectResponse
    {
        if (! in_array($invoice->status, ['sent', 'partial', 'overdue'], true)) {
            return back()->with('error', 'Pembayaran hanya bisa dicatat untuk invoice yang sudah dikirim dan belum lunas.');
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:'.$invoice->remainingAmount()],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'schedule_id' => ['nullable', 'integer', Rule::exists('payment_schedules', 'id')->where('invoice_id', $invoice->id)],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'amount.max' => 'Nominal melebihi sisa tagihan.',
        ]);

        $recorder->execute(
            invoice: $invoice,
            amount: (float) $data['amount'],
            scheduleId: isset($data['schedule_id']) ? (int) $data['schedule_id'] : null,
            method: 'manual',
            paidAt: Carbon::parse($data['paid_at'])->setTimeFrom(now()),
            notes: $data['notes'] ?? null,
        );

        return back()->with('success', 'Pembayaran dicatat.');
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function notifyMessage(bool $waSent, bool $emailSent, string $prefix): array
    {
        $channels = array_keys(array_filter(['WhatsApp' => $waSent, 'email' => $emailSent]));

        if ($channels !== []) {
            return ['success', $prefix.' via '.implode(' & ', $channels).'.'];
        }

        return ['warning', $prefix.', tapi notifikasi WhatsApp/email GAGAL terkirim. Pastikan nomor HP/email klien valid dan cek storage/logs/laravel.log.'];
    }
}
