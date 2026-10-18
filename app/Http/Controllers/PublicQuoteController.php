<?php

namespace App\Http\Controllers;

use App\Actions\Quote\RespondToQuote;
use App\Models\Quote;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Halaman penawaran publik (tanpa login) via public_token: klien melihat,
 * menerima, atau menolak penawaran.
 */
class PublicQuoteController extends Controller
{
    public function show(string $token): Response
    {
        $quote = $this->find($token);
        $quote->load(['client:id,name,email,phone,address', 'project.parent', 'items.product:id,name', 'items.project:id,name,parent_id']);

        $setting = Setting::first() ?? new Setting;

        return Inertia::render('quote/show', [
            'quote' => $quote->only([
                'quote_number', 'issue_date', 'valid_until', 'status', 'public_token',
                'subtotal', 'discount', 'discount_type', 'discount_value', 'tax_rate', 'tax_amount',
                'pph_rate', 'pph_amount', 'total', 'notes', 'terms',
                'accepted_at', 'accepted_by', 'declined_at', 'decline_reason',
                'client', 'project', 'items',
            ]),
            'isPastValidity' => $quote->isPastValidity(),
            'canRespond' => $quote->canRespond(),
            'company' => $setting->only([
                'company_name', 'company_address', 'company_phone', 'company_email',
                'bank_account_info', 'invoice_footer_text', 'company_logo_path',
            ]),
        ]);
    }

    public function accept(Request $request, string $token, RespondToQuote $responder): RedirectResponse
    {
        $quote = $this->find($token);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $responder->accept($quote, $data['name'] ?? null, $data['note'] ?? null);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Terima kasih! Penawaran telah Anda setujui.');
    }

    public function decline(Request $request, string $token, RespondToQuote $responder): RedirectResponse
    {
        $quote = $this->find($token);
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $responder->decline($quote, $data['reason'] ?? null);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Terima kasih atas tanggapan Anda. Penawaran telah ditolak.');
    }

    private function find(string $token): Quote
    {
        $quote = Quote::where('public_token', $token)->firstOrFail();

        // Draft belum dikirim ke klien — hanya pengguna yang login boleh pratinjau.
        abort_if($quote->isDraft() && ! auth()->check(), 404);

        return $quote;
    }
}
