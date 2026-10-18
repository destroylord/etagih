<?php

namespace App\Http\Controllers;

use App\Http\Middleware\RedirectToSetup;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Wizard instalasi pertama: buat akun pemilik + profil bisnis dasar.
 * Hanya bisa dipakai selama tabel users masih kosong.
 */
class SetupController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        if (User::query()->exists()) {
            return redirect()->route('login');
        }

        $setting = Settings::current();

        return Inertia::render('setup', [
            'requiresToken' => $this->requiredToken() !== null,
            'token' => (string) $request->query('token', ''),
            'appVersion' => (string) config('app.version'),
            'defaults' => [
                'company_name' => $setting->company_name ?? '',
                'company_email' => $setting->company_email ?? '',
                'company_phone' => $setting->company_phone ?? '',
                'app_invoice_prefix' => $setting->app_invoice_prefix ?: 'INV',
                'default_tax_rate' => (float) ($setting->default_tax_rate ?? 0),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_if(User::query()->exists(), 404);

        $required = $this->requiredToken();
        if ($required !== null && ! hash_equals($required, (string) $request->input('token'))) {
            throw ValidationException::withMessages(['token' => 'Token setup tidak valid. Lihat SETUP_TOKEN di file .env server.']);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', Password::min(8), 'confirmed'],
            'company_name' => ['required', 'string', 'max:255'],
            'company_email' => ['nullable', 'string', 'email', 'max:255'],
            'company_phone' => ['nullable', 'string', 'max:32'],
            'app_invoice_prefix' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9._\/-]+$/'],
            'default_tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [
            'app_invoice_prefix.regex' => 'Prefix hanya boleh huruf, angka, titik, garis miring, strip, atau garis bawah.',
        ]);

        // Kunci supaya dua submit bersamaan tidak membuat dua pemilik.
        $user = Cache::lock('etagih:setup', 15)->block(5, function () use ($data): ?User {
            if (User::query()->exists()) {
                return null;
            }

            return DB::transaction(function () use ($data): User {
                $user = new User;
                $user->forceFill([
                    'name' => $data['name'],
                    'email' => strtolower($data['email']),
                    'password' => Hash::make($data['password']),
                    'role' => 'owner',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ])->save();

                Settings::current()->fill([
                    'company_name' => $data['company_name'],
                    'company_email' => $data['company_email'] ?? null,
                    'company_phone' => $data['company_phone'] ?? null,
                    'app_invoice_prefix' => strtoupper($data['app_invoice_prefix']),
                    'default_tax_rate' => (float) ($data['default_tax_rate'] ?? 0),
                ])->save();

                return $user;
            });
        });

        abort_if($user === null, 404);

        Cache::put(RedirectToSetup::CACHE_KEY, true, now()->addMinutes(10));

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('dashboard')
            ->with('success', 'Selamat datang di eTagih! Lengkapi logo, rekening, dan QRIS di Pengaturan → Invoice.');
    }

    private function requiredToken(): ?string
    {
        $token = config('app.setup_token');

        return is_string($token) && $token !== '' ? $token : null;
    }
}
