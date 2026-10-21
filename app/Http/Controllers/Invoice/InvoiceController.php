<?php

namespace App\Http\Controllers\Invoice;

use App\Actions\Invoice\CancelInvoice;
use App\Actions\Invoice\CreateInvoice;
use App\Actions\Invoice\DuplicateInvoice;
use App\Actions\Invoice\InvoiceLineBuilder;
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
use App\Models\Task;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\Access;
use App\Support\RateResolver;
use App\Support\Settings;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
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
        $user = $this->user($request);
        $query = Invoice::with(['client', 'project.parent'])->visibleTo($user)->latest('id');

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
            'projects' => WorkSessionController::projectOptions(true, $user),
            // Jumlah invoice per status untuk tab filter.
            'statusCounts' => Invoice::query()
                ->visibleTo($user)
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $this->user($request);
        $clientIds = Access::clientIds($user);

        return Inertia::render('invoices/create', [
            'defaultTaxRate' => (float) Settings::current()->default_tax_rate,
            // Dari tombol "Buat invoice" di halaman klien / Time Tracker.
            'preselectedClientId' => $request->integer('client_id') ?: null,
            'preselectedMode' => $request->query('mode') === 'hourly' ? 'hourly' : null,
            'preselectedProjectId' => $request->integer('project_id') ?: null,
            'clients' => Client::visibleTo($user)->orderBy('name')->get(['id', 'name', 'phone', 'email', 'hourly_rate']),
            'projects' => WorkSessionController::projectOptions(false, $user),
            'products' => Product::active()
                ->when($clientIds !== null, fn ($q) => $q->where(fn ($w) => $w->whereNull('client_id')->orWhereIn('client_id', $clientIds)))
                ->orderBy('name')->get(['id', 'name', 'client_id']),
            // Semua sessions completed (unbilled) — frontend filter by client yg dipilih.
            // Batasi 500 baris; invoice dengan lebih banyak session butuh flow berbeda.
            'unbilledSessions' => WorkSession::with(['client', 'project.parent'])
                ->where('status', 'completed')
                ->when($clientIds !== null, fn ($q) => $q->whereIn('client_id', $clientIds))
                ->orderByDesc('started_at')
                ->limit(500)
                ->get(['id', 'client_id', 'project_id', 'task_id', 'description', 'unit_price', 'duration_seconds', 'started_at']),
            // Staf tidak boleh membuat klien baru dari form invoice.
            'canCreateClient' => $user->isAdmin(),
        ]);
    }

    /**
     * Tugas selesai, bisa ditagih, dan belum masuk invoice untuk klien tertentu
     * (JSON untuk form invoice). `invoice_id` opsional: saat edit, tugas yang
     * sudah ada di invoice draft itu ikut ditampilkan.
     *
     * Saran baris per tugas:
     * - mode `fixed` : uraian = judul, harga = fixed_price, atau jam × tarif bila tanpa harga tetap.
     * - mode `hourly`: sesi Time Tracker tugas (session_ids) × tarif; tugas berharga
     *   tetap tanpa sesi → 1 jam × fixed_price (jam manual).
     * Tarif: sub-proyek → proyek utama → klien → default (RateResolver::forProject).
     */
    public function billableTasks(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'invoice_id' => ['nullable', 'integer'],
        ]);
        $clientId = (int) $data['client_id'];
        abort_unless(Access::canSeeClient($user, $clientId), 404);

        $invoiceId = isset($data['invoice_id']) ? (int) $data['invoice_id'] : null;

        $tasks = Task::query()
            ->visibleTo($user)
            ->with(['project.parent', 'project.client'])
            ->where('status', 'done')
            ->where('billable', true)
            ->whereHas('project', fn ($p) => $p->where('client_id', $clientId))
            ->where(fn ($q) => $q->whereNull('invoice_id')
                ->when($invoiceId, fn ($w) => $w->orWhere('invoice_id', $invoiceId)))
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        $sessions = WorkSession::query()
            ->whereIn('task_id', $tasks->pluck('id'))
            ->where(fn ($q) => $q->where('status', 'completed')
                ->when($invoiceId, fn ($w) => $w->orWhere(fn ($b) => $b->where('status', 'billed')->where('invoice_id', $invoiceId))))
            ->get(['id', 'task_id', 'duration_seconds', 'unit_price'])
            ->groupBy('task_id');

        return response()->json([
            'tasks' => $tasks->map(function (Task $task) use ($sessions) {
                $own = $sessions->get($task->id, collect());
                $seconds = (int) $own->sum('duration_seconds');
                $hours = round($seconds / 3600, 4);
                $rate = RateResolver::forProject($task->project);
                $fixed = $task->fixed_price !== null ? (float) $task->fixed_price : null;
                $sessionIds = $own->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

                return [
                    'id' => $task->id,
                    'title' => $task->title,
                    'project_id' => $task->project_id,
                    'project_full_name' => $task->project->full_name,
                    'completed_at' => $task->completed_at?->toIso8601String(),
                    'fixed_price' => $fixed,
                    'session_ids' => $sessionIds,
                    'total_seconds' => $seconds,
                    'hours' => $hours,
                    'unit_price' => $rate,
                    'invoice_id' => $task->invoice_id,
                    'suggested' => [
                        'fixed' => [
                            'task_id' => $task->id,
                            'project_id' => $task->project_id,
                            'description' => $task->title,
                            'unit_price' => $fixed ?? round($hours * $rate, 2),
                        ],
                        'hourly' => $sessionIds !== [] || $fixed === null
                            ? [
                                'task_id' => $task->id,
                                'project_id' => $task->project_id,
                                'description' => $task->title,
                                'unit_price' => $rate,
                                'session_ids' => $sessionIds,
                                'hours_qty' => $sessionIds === [] ? 0 : null,
                            ]
                            : [
                                'task_id' => $task->id,
                                'project_id' => $task->project_id,
                                'description' => $task->title.' (harga tetap)',
                                'unit_price' => $fixed,
                                'session_ids' => [],
                                'hours_qty' => 1,
                            ],
                    ],
                ];
            })->values(),
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
            'invoice' => $invoice->load(['client', 'project.parent', 'items.product', 'items.project', 'items.sessions', 'items.task:id,title', 'schedules', 'payments', 'recurringParent:id,invoice_number']),
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

    public function edit(Request $request, Invoice $invoice): Response
    {
        abort_unless($invoice->status === 'draft', 422, 'Hanya invoice draft yang bisa diedit.');
        $user = $this->user($request);
        $clientIds = Access::clientIds($user);

        return Inertia::render('invoices/edit', [
            'invoice' => $invoice->load(['client', 'project.parent', 'items', 'items.project', 'items.sessions', 'items.task:id,title', 'schedules']),
            'clients' => Client::visibleTo($user)->orderBy('name')->get(['id', 'name', 'phone', 'email', 'hourly_rate']),
            'projects' => WorkSessionController::projectOptions(false, $user),
            'products' => Product::with('client')
                ->when($clientIds !== null, fn ($q) => $q->where(fn ($w) => $w->whereNull('client_id')->orWhereIn('client_id', $clientIds)))
                ->orderBy('name')->get(['id', 'name', 'client_id']),
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

            // Tugas yang ditagihkan di draft ini kembali "belum ditagih".
            InvoiceLineBuilder::releaseTasks($invoice);

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

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
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
