<?php

namespace App\Http\Controllers;

use App\Support\Settings;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Throwable;

/**
 * PWA ringan: manifest dinamis (nama usaha dari Pengaturan), service worker
 * dengan versi mengikuti build Vite, dan halaman offline.
 */
class PwaController extends Controller
{
    /** Warna tema = latar aplikasi mode terang (lihat resources/css/app.css). */
    public const THEME_COLOR = '#ffffff';

    public const THEME_COLOR_DARK = '#0a0a0a';

    public const SW_TEMPLATE = 'resources/pwa/sw.js';

    public function manifest(): JsonResponse
    {
        $business = $this->businessName();
        $icon = ['src' => '/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'];

        $manifest = [
            'id' => '/',
            'name' => $business ? "{$business} · eTagih" : (string) config('app.name', 'eTagih'),
            'short_name' => $business ? trim(Str::limit($business, 12, '')) : 'eTagih',
            'description' => 'Invoice, penawaran, tugas, dan pelacak waktu untuk freelancer & agensi.',
            'lang' => 'id',
            'dir' => 'ltr',
            'start_url' => '/dashboard?source=pwa',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'any',
            'background_color' => self::THEME_COLOR,
            'theme_color' => self::THEME_COLOR,
            'categories' => ['business', 'finance', 'productivity'],
            'icons' => [
                $icon + ['purpose' => 'any'],
                ['src' => '/icons/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '/icons/maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
            'shortcuts' => [
                ['name' => 'Task saya', 'short_name' => 'Task', 'url' => '/tasks?source=pwa', 'icons' => [$icon]],
                ['name' => 'Mulai timer', 'short_name' => 'Timer', 'url' => '/time-tracker?source=pwa', 'icons' => [$icon]],
                ['name' => 'Invoice baru', 'short_name' => 'Invoice', 'url' => '/invoices/create?source=pwa', 'icons' => [$icon]],
                ['name' => 'Klien', 'short_name' => 'Klien', 'url' => '/clients?source=pwa', 'icons' => [$icon]],
            ],
        ];

        return response()
            ->json($manifest, 200, [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            ->header('Content-Type', 'application/manifest+json')
            ->header('Cache-Control', 'public, max-age=3600');
    }

    public function serviceWorker(): Response
    {
        $script = str_replace('__ETAGIH_SW_VERSION__', self::version(), (string) file_get_contents(base_path(self::SW_TEMPLATE)));

        return response($script, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Service-Worker-Allowed' => '/',
        ]);
    }

    public function offline(): View
    {
        return view('pwa.offline');
    }

    /**
     * Versi cache SW: berubah setiap build Vite baru atau saat template SW
     * berubah, supaya cache lama dibuang otomatis.
     */
    public static function version(): string
    {
        $buildManifest = public_path('build/manifest.json');
        $build = is_file($buildManifest) ? (string) md5_file($buildManifest) : (string) config('app.version', 'dev');
        $template = (string) md5_file(base_path(self::SW_TEMPLATE));

        return substr(md5($build.$template), 0, 12);
    }

    private function businessName(): ?string
    {
        try {
            $name = trim((string) Settings::current()->company_name);
        } catch (Throwable) {
            // Database belum siap (instalasi baru) — pakai nama aplikasi.
            return null;
        }

        return $name !== '' ? $name : null;
    }
}
