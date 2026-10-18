<?php

namespace App\Http\Controllers;

use App\Actions\Quote\ConvertQuoteToInvoice;
use App\Actions\Quote\CreateQuote;
use App\Actions\Quote\DuplicateQuote;
use App\Actions\Quote\RespondToQuote;
use App\Actions\Quote\SendQuote;
use App\Actions\Quote\UpdateQuote;
use App\Http\Requests\Quote\StoreQuoteRequest;
use App\Http\Requests\Quote\UpdateQuoteRequest;
use App\Models\Client;
use App\Models\Product;
use App\Models\Quote;
use App\Support\QuotePdf;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Penawaran harga (quotation): draft → terkirim → diterima/ditolak/kedaluwarsa
 * → diubah menjadi invoice.
 */
class QuoteController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Quote::with(['client:id,name', 'project.parent'])->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }
        if ($request->filled('q')) {
            $search = '%'.$request->string('q').'%';
            $query->where(function ($q) use ($search) {
                $q->where('quote_number', 'like', $search)
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $search));
            });
        }

        return Inertia::render('quotes/index', [
            'quotes' => $query->paginate(20)->withQueryString(),
            'filters' => $request->only(['status', 'q', 'client_id']),
            'clients' => Client::orderBy('name')->get(['id', 'name']),
            'statusCounts' => Quote::query()
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status')
                ->map(fn ($n) => (int) $n),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('quotes/create', [
            'defaultTaxRate' => (float) Settings::current()->default_tax_rate,
            'defaultValidDays' => Quote::DEFAULT_VALID_DAYS,
            'preselectedClientId' => $request->integer('client_id') ?: null,
            'preselectedProjectId' => $request->integer('project_id') ?: null,
            ...$this->formOptions(),
        ]);
    }

    public function store(StoreQuoteRequest $request, CreateQuote $creator): RedirectResponse
    {
        $quote = $creator->execute($request->validated());

        return redirect()
            ->route('quotes.show', $quote)
            ->with('success', 'Penawaran dibuat (draft). Klik "Kirim ke klien" untuk mengirim.');
    }

    public function show(Quote $quote): Response
    {
        $setting = Settings::current();

        return Inertia::render('quotes/show', [
            'quote' => $quote->load([
                'client', 'project.parent', 'items.product', 'items.project',
                'convertedInvoice:id,invoice_number,status,total',
            ]),
            'publicUrl' => $quote->publicUrl(),
            'isPastValidity' => $quote->isPastValidity(),
            'settings' => [
                'company_name' => $setting->company_name,
                'company_address' => $setting->company_address,
                'company_email' => $setting->company_email,
                'company_phone' => $setting->company_phone,
                'logo_url' => $setting->logoUrl(),
                'invoice_footer_text' => $setting->invoice_footer_text,
                'signature_url' => $setting->signatureUrl(),
                'signer_name' => $setting->signer_name,
                'signer_title' => $setting->signer_title,
            ],
        ]);
    }

    public function edit(Quote $quote): Response
    {
        abort_unless($quote->isDraft(), 422, 'Hanya penawaran draft yang bisa diedit.');

        return Inertia::render('quotes/edit', [
            'quote' => $quote->load(['client', 'project.parent', 'items']),
            ...$this->formOptions(),
        ]);
    }

    /**
     * Update isi draft. Body `mark_as` (accepted|declined) dipakai tombol
     * "Tandai diterima/ditolak" — mencatat jawaban klien yang diterima di luar aplikasi.
     */
    public function update(Request $request, Quote $quote, UpdateQuote $updater, RespondToQuote $responder): RedirectResponse
    {
        if ($request->has('mark_as')) {
            return $this->mark($request, $quote, $responder);
        }

        abort_unless($quote->isDraft(), 422, 'Hanya penawaran draft yang bisa diedit.');

        /** @var UpdateQuoteRequest $validated */
        $validated = app(UpdateQuoteRequest::class);
        $updated = $updater->execute($quote, $validated->validated());

        return redirect()->route('quotes.show', $updated)->with('success', 'Penawaran diperbarui.');
    }

    public function destroy(Quote $quote): RedirectResponse
    {
        abort_unless($quote->isDraft(), 422, 'Hanya draft yang bisa dihapus.');

        $quote->delete();

        return redirect()->route('quotes.index')->with('success', 'Penawaran dihapus.');
    }

    /** Draft → kirim; sudah terkirim → kirim ulang. */
    public function send(Quote $quote, SendQuote $sender): RedirectResponse
    {
        if (! $quote->isDraft()) {
            try {
                $result = $sender->resend($quote);
            } catch (RuntimeException $e) {
                return back()->with('error', $e->getMessage());
            }

            return back()->with(...$this->notifyMessage($result['wa_sent'], $result['email_sent'], 'Penawaran dikirim ulang'));
        }

        if ($quote->items()->doesntExist()) {
            return back()->with('error', 'Penawaran belum punya item.');
        }

        $result = $sender->execute($quote);

        return redirect()->route('quotes.show', $result['quote'])
            ->with(...$this->notifyMessage($result['wa_sent'], $result['email_sent'], 'Penawaran dikirim'));
    }

    public function convert(Quote $quote, ConvertQuoteToInvoice $converter): RedirectResponse
    {
        try {
            $result = $converter->execute($quote);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $invoice = $result['invoice'];

        if (! $result['created']) {
            return redirect()->route($invoice->status === 'draft' ? 'invoices.edit' : 'invoices.show', $invoice)
                ->with('info', "Penawaran ini sudah diubah menjadi invoice {$invoice->invoice_number}.");
        }

        return redirect()->route('invoices.edit', $invoice)
            ->with('success', "Invoice draft {$invoice->invoice_number} dibuat dari penawaran {$quote->quote_number}. Periksa lalu simpan.");
    }

    public function duplicate(Quote $quote, DuplicateQuote $duplicator): RedirectResponse
    {
        $copy = $duplicator->execute($quote);

        return redirect()->route('quotes.edit', $copy)
            ->with('success', "Penawaran diduplikat menjadi draft {$copy->quote_number}. Periksa lalu simpan.");
    }

    /** Download PDF; `?inline=1` untuk ditampilkan di browser. */
    public function pdf(Request $request, Quote $quote): HttpResponse
    {
        $pdf = QuotePdf::make($quote);
        $filename = $quote->quote_number.'.pdf';

        return $request->boolean('inline') ? $pdf->stream($filename) : $pdf->download($filename);
    }

    private function mark(Request $request, Quote $quote, RespondToQuote $responder): RedirectResponse
    {
        $data = $request->validate([
            'mark_as' => ['required', Rule::in(['accepted', 'declined'])],
            'name' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            if ($data['mark_as'] === 'accepted') {
                $responder->accept($quote, $data['name'] ?? null, $data['note'] ?? null, byClient: false);
                $message = 'Penawaran ditandai diterima. Lanjutkan dengan "Ubah jadi invoice".';
            } else {
                $responder->decline($quote, $data['reason'] ?? null, byClient: false);
                $message = 'Penawaran ditandai ditolak.';
            }
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', $message);
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'clients' => Client::orderBy('name')->get(['id', 'name', 'phone', 'email', 'hourly_rate']),
            'projects' => WorkSessionController::projectOptions(),
            'products' => Product::active()->orderBy('name')->get(['id', 'name', 'client_id']),
        ];
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
