<?php

use App\Http\Controllers\PwaController;
use App\Models\Setting;
use App\Models\User;
use App\Support\Settings;

test('manifest memakai nama usaha dari pengaturan', function () {
    Settings::current()->update(['company_name' => 'Studio Kreatif Nusantara']);

    $response = $this->get('/manifest.webmanifest')->assertOk();

    expect($response->headers->get('Content-Type'))->toBe('application/manifest+json')
        ->and($response->headers->get('Cache-Control'))->toContain('max-age=3600');

    $manifest = json_decode((string) $response->getContent(), true);

    expect($manifest)
        ->name->toBe('Studio Kreatif Nusantara · eTagih')
        ->short_name->toBe('Studio Kreat')
        ->id->toBe('/')
        ->start_url->toBe('/dashboard?source=pwa')
        ->scope->toBe('/')
        ->display->toBe('standalone')
        ->lang->toBe('id')
        ->and(mb_strlen($manifest['short_name']))->toBeLessThanOrEqual(12)
        ->and(array_column($manifest['shortcuts'], 'name'))
        ->toBe(['Task saya', 'Mulai timer', 'Invoice baru', 'Klien'])
        ->and(collect($manifest['icons'])->where('purpose', 'maskable'))->toHaveCount(1);

    foreach ($manifest['icons'] as $icon) {
        expect(public_path(ltrim($icon['src'], '/')))->toBeFile();
        [$w, $h] = getimagesize(public_path(ltrim($icon['src'], '/')));
        expect("{$w}x{$h}")->toBe($icon['sizes']);
    }
});

test('manifest memakai nama aplikasi bila nama usaha kosong', function () {
    Setting::query()->delete();
    config(['app.name' => 'eTagih']);

    $this->get('/manifest.webmanifest')
        ->assertOk()
        ->assertJsonPath('name', 'eTagih')
        ->assertJsonPath('short_name', 'eTagih');
});

test('service worker disajikan sebagai javascript dengan versi build', function () {
    $response = $this->get('/sw.js')->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('application/javascript')
        ->and($response->headers->get('Cache-Control'))->toContain('no-cache')
        ->and($response->headers->get('Service-Worker-Allowed'))->toBe('/');

    $script = (string) $response->getContent();

    expect($script)
        ->toContain("const VERSION = '".PwaController::version()."'")
        ->not->toContain('__ETAGIH_SW_VERSION__')
        ->toContain("OFFLINE_URL = '/offline'")
        ->toContain('SKIP_WAITING')
        ->toContain('X-Inertia');

    // Rute berisi data / publik untuk klien tidak boleh di-cache.
    foreach (['pay', 'q', 'client-portal', 'invitation', 'setup', 'login', 'notifications', 'storage', 'settings\/system\/backup', 'pdf', 'receipt'] as $path) {
        expect($script)->toContain($path);
    }
});

test('halaman offline bisa dibuka tanpa login', function () {
    $this->get('/offline')
        ->assertOk()
        ->assertSee('Anda sedang offline')
        ->assertSee('Coba lagi');
});

test('rute pwa tidak memakai sesi', function () {
    foreach (['/manifest.webmanifest', '/sw.js', '/offline'] as $url) {
        $response = $this->get($url)->assertOk();

        expect(collect($response->headers->getCookies())->map->getName())
            ->not->toContain(config('session.cookie'));
    }
});

test('layout memuat manifest dan meta pwa', function () {
    $this->withoutVite();
    User::factory()->create();

    $this->get('/login')
        ->assertOk()
        ->assertSee('<link rel="manifest" href="/manifest.webmanifest">', false)
        ->assertSee('apple-mobile-web-app-capable', false)
        ->assertSee('name="theme-color"', false);
});
