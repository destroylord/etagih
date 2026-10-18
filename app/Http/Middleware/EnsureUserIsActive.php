<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pengguna yang dinonaktifkan admin langsung dikeluarkan pada request berikutnya
 * (termasuk yang masuk lewat passkey / sesi "ingat saya").
 */
class EnsureUserIsActive
{
    public const MESSAGE = 'Akun Anda telah dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->is_active === false) {
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            if ($request->expectsJson()) {
                abort(403, self::MESSAGE);
            }

            return redirect()->route('login')->withErrors(['email' => self::MESSAGE]);
        }

        return $next($request);
    }
}
