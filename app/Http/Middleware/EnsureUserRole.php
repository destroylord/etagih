<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Batasi rute berdasarkan role: `->middleware('role:admin')` (owner & admin)
 * atau `role:owner`. Role `admin` di parameter otomatis mencakup owner.
 */
class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $allowed = in_array('admin', $roles, true) ? [...$roles, 'owner'] : $roles;

        abort_unless(in_array($user->role, $allowed, true), 403, 'Halaman ini hanya untuk admin.');

        return $next($request);
    }
}
