<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\UpdateChecker;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $this->forwardSessionFlashToToast($request);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                // Hak akses turunan role (lihat App\Support\Access): staf hanya
                // boleh membuat sub-proyek & tugas di proyek yang ia ikuti.
                'can' => fn () => $request->user() instanceof User ? [
                    'manageClients' => $request->user()->isAdmin(),
                    'manageProjects' => $request->user()->isAdmin(),
                    'manageMembers' => $request->user()->isAdmin(),
                    'createSubProjects' => true,
                    'createTasks' => true,
                ] : null,
                // Jumlah notifikasi belum dibaca (lonceng).
                'unreadNotifications' => fn () => $request->user() instanceof User
                    ? $request->user()->unreadNotifications()->count()
                    : 0,
            ],
            // Kunci portal klien yang baru dibuat — hanya ada di request setelah dibuat.
            'newAccessKey' => fn () => $request->hasSession() ? $request->session()->get('access_key') : null,
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Update eTagih tersedia (admin saja; hanya dari cache, tanpa memanggil GitHub).
            'updateAvailable' => fn () => $request->user() instanceof User && $request->user()->isAdmin()
                ? app(UpdateChecker::class)->availableFromCache()
                : null,
        ];
    }

    /**
     * Controller memakai `->with('success'|'warning'|'error', ...)`. Teruskan
     * pesan tersebut ke flash Inertia `toast` supaya tampil sebagai notifikasi
     * (lihat resources/js/hooks/use-flash-toast.ts).
     */
    private function forwardSessionFlashToToast(Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        foreach (['success', 'warning', 'error', 'info'] as $type) {
            $message = $request->session()->get($type);
            if (is_string($message) && $message !== '') {
                Inertia::flash('toast', ['type' => $type, 'message' => $message]);

                return;
            }
        }
    }
}
