<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Instalasi baru (belum ada user sama sekali): arahkan halaman depan & halaman
 * auth ke wizard /setup supaya pemilik bisa membuat akun pertamanya.
 *
 * Hasil "sudah ada user" di-cache sebentar supaya tidak query tiap request;
 * hasil "belum ada user" tidak di-cache (setelah setup langsung berlaku).
 */
class RedirectToSetup
{
    public const CACHE_KEY = 'etagih:has-users';

    /** Path yang dialihkan ke /setup selama belum ada user. */
    private const PATHS = [
        '/',
        'login',
        'register',
        'forgot-password',
        'reset-password*',
        'two-factor-challenge',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.setup_redirect')
            || ! $request->isMethod('GET')
            || ! $request->is(...self::PATHS)
            || self::hasUsers()) {
            return $next($request);
        }

        return redirect()->route('setup.show', array_filter(['token' => $request->query('token')]));
    }

    public static function hasUsers(): bool
    {
        if (Cache::get(self::CACHE_KEY) === true) {
            return true;
        }

        try {
            $exists = User::query()->exists();
        } catch (Throwable) {
            // Database belum siap (mis. migrasi belum jalan) — jangan blokir request.
            return true;
        }

        if ($exists) {
            Cache::put(self::CACHE_KEY, true, now()->addMinutes(10));
        }

        return $exists;
    }
}
