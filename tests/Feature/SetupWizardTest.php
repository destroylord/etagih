<?php

use App\Models\User;
use App\Support\Settings;
use Inertia\Testing\AssertableInertia as Assert;

function setupPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Pemilik Toko',
        'email' => 'Pemilik@Contoh.test',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
        'company_name' => 'CV Contoh',
        'company_email' => 'billing@contoh.test',
        'company_phone' => '08123456789',
        'app_invoice_prefix' => 'ctx',
        'default_tax_rate' => 11,
    ], $overrides);
}

beforeEach(function () {
    $this->withoutVite();
    config(['app.setup_redirect' => true, 'app.setup_token' => null]);
});

test('halaman depan & login dialihkan ke setup selama belum ada user', function () {
    $this->get('/')->assertRedirect(route('setup.show'));
    $this->get(route('login'))->assertRedirect(route('setup.show'));
    // Rute ber-auth diarahkan ke login dulu, lalu login → setup.
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('tidak ada pengalihan setelah user dibuat', function () {
    User::factory()->create();

    $this->get('/')->assertOk();
    $this->get(route('login'))->assertOk();
});

test('halaman setup tampil saat belum ada user', function () {
    $this->get(route('setup.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('setup')
            ->where('requiresToken', false)
            ->has('defaults'));
});

test('setup membuat pemilik, menyimpan pengaturan, dan login', function () {
    $this->post(route('setup.store'), setupPayload())
        ->assertRedirect(route('dashboard'))
        ->assertSessionHas('success');

    $user = User::query()->sole();
    expect($user->email)->toBe('pemilik@contoh.test')
        ->and($user->role)->toBe('owner')
        ->and($user->is_active)->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull();
    $this->assertAuthenticatedAs($user);

    $setting = Settings::current()->fresh();
    expect($setting->company_name)->toBe('CV Contoh')
        ->and($setting->app_invoice_prefix)->toBe('CTX')
        ->and((float) $setting->default_tax_rate)->toBe(11.0);

    $this->get(route('dashboard'))->assertOk();
});

test('validasi setup: password minimal 8 & konfirmasi', function () {
    $this->post(route('setup.store'), setupPayload(['password' => 'pendek', 'password_confirmation' => 'beda']))
        ->assertSessionHasErrors('password');

    expect(User::query()->count())->toBe(0);
});

test('setup diblokir setelah ada user', function () {
    User::factory()->create();

    $this->get(route('setup.show'))->assertRedirect(route('login'));
    $this->post(route('setup.store'), setupPayload())->assertNotFound();

    expect(User::query()->count())->toBe(1);
});

test('token setup wajib bila SETUP_TOKEN diisi', function () {
    config(['app.setup_token' => 'token-rahasia']);

    $this->get(route('setup.show', ['token' => 'token-rahasia']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('requiresToken', true)
            ->where('token', 'token-rahasia'));

    $this->post(route('setup.store'), setupPayload(['token' => 'salah']))
        ->assertSessionHasErrors('token');
    expect(User::query()->count())->toBe(0);

    $this->post(route('setup.store'), setupPayload(['token' => 'token-rahasia']))
        ->assertRedirect(route('dashboard'));
    expect(User::query()->count())->toBe(1);
});

test('pengalihan meneruskan token dari query', function () {
    $this->get('/login?token=abc')->assertRedirect(route('setup.show', ['token' => 'abc']));
});
