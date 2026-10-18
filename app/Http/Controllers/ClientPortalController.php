<?php

namespace App\Http\Controllers;

use App\Models\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClientPortalController extends Controller
{
    private const SESSION_KEY = 'client_portal_id';

    /**
     * Halaman portal: daftar semua invoice (non-draft) milik client yang sedang login via key.
     */
    public function show(Request $request): Response|RedirectResponse
    {
        $clientId = $request->session()->get(self::SESSION_KEY);

        $client = $clientId ? Client::with([
            'invoices' => fn ($q) => $q
                ->where('status', '!=', 'draft')
                ->orderByDesc('issue_date')
                ->orderByDesc('id'),
            'invoices.payments',
            'invoices.project.parent',
        ])->whereKey($clientId)->first() : null;

        if (! $client) {
            return redirect()->route('home');
        }

        $invoices = $client->invoices;
        // Invoice yang dibatalkan tidak dihitung sebagai tagihan.
        $active = $invoices->where('status', '!=', 'cancelled');
        $totalBilled = (float) $active->sum('total');
        $totalPaid = (float) $active->sum('paid_amount');

        return Inertia::render('client-portal', [
            'client' => $client,
            'invoices' => $invoices,
            'summary' => [
                'total_billed' => round($totalBilled, 2),
                'total_paid' => round($totalPaid, 2),
                'outstanding' => round($totalBilled - $totalPaid, 2),
                'invoice_count' => $invoices->count(),
            ],
        ]);
    }

    /**
     * Login publik lewat kunci akses dari halaman Clients.
     */
    public function verify(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'access_key' => ['required', 'string'],
        ]);

        $client = Client::findByAccessKey($credentials['access_key']);

        if (! $client) {
            return back()->withErrors(['access_key' => 'Kunci akses tidak valid.']);
        }

        $request->session()->regenerate();
        $request->session()->put(self::SESSION_KEY, $client->id);

        return redirect()->route('client.portal');
    }

    public function logout(Request $request): RedirectResponse
    {
        $request->session()->forget(self::SESSION_KEY);

        return redirect()->route('home');
    }
}
