<?php

use App\Jobs\QueueHeartbeat;
use App\Models\User;
use App\Support\BackupBuilder;
use App\Support\SystemStatus;
use App\Support\UpdateChecker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    config(['app.version' => '1.1.0', 'app.update_repo' => 'contoh/etagih', 'app.update_check' => true]);
});

function fakeRelease(string $tag = 'v1.2.0'): void
{
    Http::fake([
        'api.github.com/repos/contoh/etagih/releases/latest' => Http::response([
            'tag_name' => $tag,
            'html_url' => "https://github.com/contoh/etagih/releases/tag/{$tag}",
            'published_at' => '2026-10-01T00:00:00Z',
        ]),
    ]);
}

// ---- Halaman & akses ---------------------------------------------------------

test('admin bisa membuka status sistem', function () {
    fakeRelease();
    $this->actingAs(User::factory()->create());

    $this->get(route('system.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/system')
            ->has('checks')
            ->where('update.status', 'available')
            ->where('update.latest', '1.2.0'));
});

test('staf tidak bisa membuka status sistem, uji kirim, dan backup', function () {
    $this->actingAs(User::factory()->state(['role' => 'staff'])->create());

    $this->get(route('system.show'))->assertForbidden();
    $this->post(route('system.test-mail'))->assertForbidden();
    $this->post(route('system.test-whatsapp'), ['phone' => '08123456789'])->assertForbidden();
    $this->get(route('system.backup'))->assertForbidden();
});

test('kirim email uji ke user yang login', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('system.show'))
        ->post(route('system.test-mail'))
        ->assertRedirect(route('system.show'))
        ->assertSessionHas('success');
});

test('kirim WA uji memakai Fonnte', function () {
    config(['services.wa.api_key' => 'token-fonnte']);
    Http::fake(['api.fonnte.com/*' => Http::response(['status' => true])]);

    $this->actingAs(User::factory()->create())
        ->post(route('system.test-whatsapp'), ['phone' => '0812-3456-789'])
        ->assertSessionHas('success');

    Http::assertSent(fn ($request) => str_contains($request->url(), '/send') && $request['target'] === '628123456789');
});

test('kirim WA uji gagal bila token kosong', function () {
    config(['services.wa.api_key' => '']);

    $this->actingAs(User::factory()->create())
        ->post(route('system.test-whatsapp'), ['phone' => '08123456789'])
        ->assertSessionHas('error');
});

// ---- Heartbeat ---------------------------------------------------------------

function findCheck(string $key): array
{
    return collect(app(SystemStatus::class)->checks())->firstWhere('key', $key);
}

test('heartbeat scheduler & queue', function () {
    config(['app.update_check' => false, 'queue.default' => 'database']);

    expect(findCheck('scheduler')['status'])->toBe('error')
        ->and(findCheck('queue')['status'])->toBe('error');

    SystemStatus::touchScheduler();
    (new QueueHeartbeat)->handle();

    expect(findCheck('scheduler')['status'])->toBe('ok')
        ->and(findCheck('queue')['status'])->toBe('ok');

    $this->travel(4)->minutes();
    expect(findCheck('scheduler')['status'])->toBe('warning')
        ->and(findCheck('queue')['status'])->toBe('ok');

    $this->travel(2)->minutes();
    expect(findCheck('queue')['status'])->toBe('error');
});

test('jadwal heartbeat terdaftar', function () {
    $this->artisan('schedule:list')
        ->expectsOutputToContain('etagih:heartbeat-scheduler')
        ->expectsOutputToContain('etagih:heartbeat-queue')
        ->expectsOutputToContain('etagih:update-check');
});

// ---- Update checker ----------------------------------------------------------

test('perbandingan semver', function (string $candidate, string $current, bool $newer) {
    expect(UpdateChecker::isNewer($candidate, $current))->toBe($newer);
})->with([
    ['1.2.0', '1.1.0', true],
    ['v1.10.0', '1.9.3', true],
    ['1.1.0', '1.1.0', false],
    ['1.0.9', '1.1.0', false],
    ['2.0', '1.9.9', true],
    ['1.2.0', '1.2.0-beta.1', true],
    ['1.2.0-beta.2', '1.2.0-beta.1', true],
    ['1.2.0-beta.1', '1.2.0', false],
    ['bukan-versi', '1.0.0', false],
]);

test('update checker menyimpan hasil di cache', function () {
    fakeRelease('v1.2.0');
    $checker = app(UpdateChecker::class);

    expect($checker->cached())->toBeNull();

    $info = $checker->refresh();
    expect($info['status'])->toBe('available')
        ->and($info['latest'])->toBe('1.2.0')
        ->and($checker->availableFromCache())->toMatchArray(['current' => '1.1.0', 'latest' => '1.2.0']);

    $checker->check();
    Http::assertSentCount(1);
});

test('update checker: versi sama = terbaru', function () {
    fakeRelease('v1.1.0');

    expect(app(UpdateChecker::class)->refresh()['status'])->toBe('up_to_date')
        ->and(app(UpdateChecker::class)->availableFromCache())->toBeNull();
});

test('update checker toleran terhadap kegagalan', function () {
    Http::fake(['api.github.com/*' => Http::response('rate limited', 403)]);
    expect(app(UpdateChecker::class)->refresh()['status'])->toBe('unknown');

    Cache::flush();
    Http::fake(fn () => throw new RuntimeException('timeout'));
    expect(app(UpdateChecker::class)->refresh()['status'])->toBe('unknown');
});

test('update checker nonaktif lewat konfigurasi atau versi dev', function () {
    Http::fake();

    config(['app.update_check' => false]);
    expect(app(UpdateChecker::class)->check()['status'])->toBe('disabled');

    config(['app.update_check' => true, 'app.version' => 'dev']);
    expect(app(UpdateChecker::class)->check()['status'])->toBe('disabled');

    Http::assertNothingSent();
});

test('updateAvailable dibagikan ke admin saja dan hanya dari cache', function () {
    Http::fake();
    $admin = User::factory()->create();
    $staff = User::factory()->state(['role' => 'staff'])->create();

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('updateAvailable', null));
    Http::assertNothingSent();

    Cache::put(UpdateChecker::CACHE_KEY, [
        'status' => 'available', 'current' => '1.1.0', 'latest' => '1.2.0',
        'url' => 'https://github.com/contoh/etagih/releases/tag/v1.2.0',
        'published_at' => null, 'checked_at' => now()->toIso8601String(), 'error' => null,
    ]);

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('updateAvailable.latest', '1.2.0'));
    $this->actingAs($staff)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('updateAvailable', null));
});

// ---- Backup ------------------------------------------------------------------

test('backup zip berisi database, upload, dan README', function () {
    Storage::disk('public')->put('logos/uji-backup.txt', 'logo');
    User::factory()->create(['email' => 'backup@contoh.test']);

    $path = (new BackupBuilder)->build();

    try {
        $zip = new ZipArchive;
        expect($zip->open($path))->toBeTrue();
        expect($zip->locateName('README.txt'))->not->toBeFalse()
            ->and($zip->locateName('database.sqlite'))->not->toBeFalse()
            ->and($zip->getFromName('uploads/logos/uji-backup.txt'))->toBe('logo')
            ->and($zip->getFromName('README.txt'))->toContain('1.1.0')->toContain('CARA RESTORE');

        // Salinan SQLite bisa dibuka dan berisi data.
        $copy = tempnam(sys_get_temp_dir(), 'etg').'.sqlite';
        file_put_contents($copy, $zip->getFromName('database.sqlite'));
        $zip->close();
        $pdo = new PDO('sqlite:'.$copy);
        expect($pdo->query("select count(*) from users where email = 'backup@contoh.test'")->fetchColumn())->toBe(1);
        unset($pdo);
        @unlink($copy);
    } finally {
        @unlink($path);
        Storage::disk('public')->delete('logos/uji-backup.txt');
    }
});

test('admin bisa mengunduh backup', function () {
    $this->actingAs(User::factory()->create());

    $response = $this->get(route('system.backup'))->assertOk();

    expect($response->headers->get('content-type'))->toBe('application/zip')
        ->and($response->headers->get('content-disposition'))->toContain('etagih-backup-');
});
