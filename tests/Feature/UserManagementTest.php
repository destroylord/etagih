<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

beforeEach(function () {
    // Halaman baru belum ada di manifest Vite hasil build.
    $this->withoutVite();
    $this->owner = User::factory()->state(['role' => 'owner'])->create(['name' => 'Pemilik']);
    $this->admin = User::factory()->create(['name' => 'Admin Satu']);
    $this->staff = User::factory()->state(['role' => 'staff'])->create(['name' => 'Staf Satu']);
});

// --- Daftar ------------------------------------------------------------------

it('lists users with permission flags for the current user', function () {
    $this->actingAs($this->admin)
        ->get(route('users.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/users')
            ->has('users', 3)
            ->where('users.0.role', 'owner')
            ->where('users.0.can.edit', false)
            ->where('users.0.can.delete', false)
            ->where('assignableRoles', ['staff'])
            ->where('temporaryPassword', null));
});

// --- Tambah ------------------------------------------------------------------

it('creates a user with a temporary password shown once', function () {
    $response = $this->actingAs($this->admin)->post(route('users.store'), [
        'name' => 'Staf Baru',
        'email' => 'baru@example.com',
        'role' => 'staff',
        'password_mode' => 'temporary',
    ]);

    $response->assertRedirect(route('users.index'))->assertSessionHas('success');

    $temp = session('temporary_password');
    $user = User::firstWhere('email', 'baru@example.com');

    expect($user->role)->toBe('staff')
        ->and($user->is_active)->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($temp['user_id'])->toBe($user->id)
        ->and(strlen($temp['password']))->toBe(12)
        ->and(Hash::check($temp['password'], $user->password))->toBeTrue();

    // Ditampilkan di halaman berikutnya, lalu hilang.
    $this->get(route('users.index'))
        ->assertInertia(fn ($page) => $page->where('temporaryPassword.password', $temp['password']));
    $this->get(route('users.index'))
        ->assertInertia(fn ($page) => $page->where('temporaryPassword', null));

    // Pengguna baru bisa login dengan password sementara.
    auth()->logout();
    $this->post(route('login.store'), ['email' => 'baru@example.com', 'password' => $temp['password']]);
    $this->assertAuthenticatedAs($user);
});

it('creates a user and emails a set-password link', function () {
    Notification::fake();

    $this->actingAs($this->owner)->post(route('users.store'), [
        'name' => 'Admin Baru',
        'email' => 'admin.baru@example.com',
        'role' => 'admin',
        'password_mode' => 'invite',
    ])->assertSessionHas('success')->assertSessionMissing('temporary_password');

    $user = User::firstWhere('email', 'admin.baru@example.com');
    expect($user->role)->toBe('admin');
    Notification::assertSentTo($user, ResetPassword::class);
});

it('shows a warning instead of crashing when the reset email fails', function () {
    Password::shouldReceive('broker->sendResetLink')->andThrow(new RuntimeException('SMTP mati'));

    $this->actingAs($this->admin)->post(route('users.store'), [
        'name' => 'Staf Gagal Email',
        'email' => 'gagal@example.com',
        'role' => 'staff',
        'password_mode' => 'invite',
    ])->assertRedirect(route('users.index'))->assertSessionHas('warning');

    expect(User::where('email', 'gagal@example.com')->exists())->toBeTrue();
});

it('only lets the owner create admins', function () {
    $this->actingAs($this->admin)->post(route('users.store'), [
        'name' => 'Calon Admin',
        'email' => 'calon@example.com',
        'role' => 'admin',
        'password_mode' => 'temporary',
    ])->assertSessionHasErrors('role');

    expect(User::where('email', 'calon@example.com')->exists())->toBeFalse();
});

it('validates unique email and required fields', function () {
    $this->actingAs($this->admin)->post(route('users.store'), [
        'name' => '',
        'email' => $this->staff->email,
        'role' => 'staff',
        'password_mode' => 'nope',
    ])->assertSessionHasErrors(['name', 'email', 'password_mode']);

    $this->actingAs($this->admin)->put(route('users.update', $this->staff), [
        'name' => 'Staf',
        'email' => $this->owner->email,
    ])->assertSessionHasErrors('email');
});

// --- Ubah --------------------------------------------------------------------

it('lets an admin edit and deactivate a staff member', function () {
    $this->actingAs($this->admin)->put(route('users.update', $this->staff), [
        'name' => 'Staf Diubah',
        'email' => 'staf.diubah@example.com',
        'role' => 'staff',
        'is_active' => false,
    ])->assertSessionHas('success');

    $this->staff->refresh();
    expect($this->staff->name)->toBe('Staf Diubah')
        ->and($this->staff->email)->toBe('staf.diubah@example.com')
        ->and($this->staff->is_active)->toBeFalse();
});

it('prevents an admin from promoting staff to admin, but the owner can', function () {
    $this->actingAs($this->admin)->put(route('users.update', $this->staff), [
        'name' => $this->staff->name, 'email' => $this->staff->email, 'role' => 'admin',
    ])->assertForbidden();
    expect($this->staff->fresh()->role)->toBe('staff');

    $this->actingAs($this->owner)->put(route('users.update', $this->staff), [
        'name' => $this->staff->name, 'email' => $this->staff->email, 'role' => 'admin',
    ])->assertSessionHas('success');
    expect($this->staff->fresh()->role)->toBe('admin');
});

it('prevents an admin from modifying another admin', function () {
    $other = User::factory()->create();
    $this->actingAs($this->admin);

    $this->put(route('users.update', $other), ['name' => 'X', 'email' => $other->email])->assertForbidden();
    $this->delete(route('users.destroy', $other))->assertForbidden();
    $this->post(route('users.password-reset', $other))->assertForbidden();

    // Pemilik boleh.
    $this->actingAs($this->owner)
        ->put(route('users.update', $other), ['name' => 'X', 'email' => $other->email, 'role' => 'staff', 'is_active' => false])
        ->assertSessionHas('success');
    expect($other->fresh())->role->toBe('staff')->is_active->toBeFalse();
});

it('protects the owner from changes by others', function () {
    $this->actingAs($this->admin);

    $this->put(route('users.update', $this->owner), ['name' => 'X', 'email' => $this->owner->email])->assertForbidden();
    $this->delete(route('users.destroy', $this->owner))->assertForbidden();

    // Bahkan pemilik sendiri tidak bisa mengubah role / menonaktifkan diri.
    $this->actingAs($this->owner);
    $this->put(route('users.update', $this->owner), [
        'name' => 'Pemilik', 'email' => $this->owner->email, 'role' => 'staff',
    ])->assertForbidden();
    $this->put(route('users.update', $this->owner), [
        'name' => 'Pemilik', 'email' => $this->owner->email, 'is_active' => false,
    ])->assertForbidden();
    $this->delete(route('users.destroy', $this->owner))->assertForbidden();

    expect($this->owner->fresh())->role->toBe('owner')->is_active->toBeTrue();
});

it('prevents users from deleting, deactivating, or changing their own role', function () {
    $this->actingAs($this->admin);

    $this->delete(route('users.destroy', $this->admin))->assertForbidden();
    $this->put(route('users.update', $this->admin), [
        'name' => 'Admin', 'email' => $this->admin->email, 'is_active' => false,
    ])->assertForbidden();
    $this->put(route('users.update', $this->admin), [
        'name' => 'Admin', 'email' => $this->admin->email, 'role' => 'staff',
    ])->assertForbidden();

    // Nama & email sendiri tetap boleh diubah.
    $this->put(route('users.update', $this->admin), [
        'name' => 'Admin Baru', 'email' => $this->admin->email, 'role' => 'admin', 'is_active' => true,
    ])->assertSessionHas('success');

    expect($this->admin->fresh())->name->toBe('Admin Baru')->role->toBe('admin')->is_active->toBeTrue();
});

// --- Hapus -------------------------------------------------------------------

it('deletes a staff member', function () {
    $this->actingAs($this->admin)
        ->delete(route('users.destroy', $this->staff))
        ->assertRedirect(route('users.index'))
        ->assertSessionHas('success');

    expect(User::find($this->staff->id))->toBeNull();
});

// --- Reset password ----------------------------------------------------------

it('sends a password reset link to a managed user', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('users.password-reset', $this->staff))
        ->assertSessionHas('success');

    Notification::assertSentTo($this->staff, ResetPassword::class);
});

// --- Alih kepemilikan --------------------------------------------------------

it('transfers ownership: target becomes owner, previous owner becomes admin', function () {
    $this->actingAs($this->owner)
        ->post(route('users.transfer-ownership', $this->staff))
        ->assertRedirect(route('users.index'))
        ->assertSessionHas('success');

    expect($this->staff->fresh()->role)->toBe('owner')
        ->and($this->owner->fresh()->role)->toBe('admin')
        ->and(User::where('role', 'owner')->count())->toBe(1);
});

it('only the current owner can transfer ownership, and not to inactive users', function () {
    $this->actingAs($this->admin)
        ->post(route('users.transfer-ownership', $this->staff))
        ->assertForbidden();

    $this->staff->forceFill(['is_active' => false])->save();
    $this->actingAs($this->owner)
        ->post(route('users.transfer-ownership', $this->staff))
        ->assertForbidden();

    expect($this->owner->fresh()->role)->toBe('owner');
});

// --- Akun nonaktif -----------------------------------------------------------

it('blocks inactive users from logging in', function () {
    $this->staff->forceFill(['is_active' => false])->save();

    $this->post(route('login.store'), ['email' => $this->staff->email, 'password' => 'password'])
        ->assertSessionHasErrors(['email' => 'Akun Anda telah dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.']);

    $this->assertGuest();
});

it('still rejects wrong passwords with the default message', function () {
    $this->post(route('login.store'), ['email' => $this->staff->email, 'password' => 'salah'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('logs out an already authenticated user once deactivated', function () {
    $this->actingAs($this->staff)->get(route('dashboard'))->assertOk();

    $this->staff->forceFill(['is_active' => false])->save();

    $this->actingAs($this->staff->fresh())
        ->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});
