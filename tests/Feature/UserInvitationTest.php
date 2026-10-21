<?php

use App\Models\Setting;
use App\Models\User;
use App\Notifications\UserInvitation;
use App\Support\SystemStatus;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

beforeEach(function () {
    $this->withoutVite();
    Setting::query()->updateOrCreate(['id' => 1], ['company_name' => 'Studio Contoh']);
    $this->owner = User::factory()->state(['role' => 'owner'])->create(['name' => 'Pemilik']);
    $this->admin = User::factory()->create(['name' => 'Admin Satu']);
});

/** Undang pengguna lewat form admin dan kembalikan [user, token]. */
function inviteUser(User $actor, string $email = 'baru@example.com', string $role = 'staff'): array
{
    Notification::fake();

    test()->actingAs($actor)->post(route('users.store'), [
        'name' => 'Staf Baru',
        'email' => $email,
        'role' => $role,
        'password_mode' => 'invite',
    ])->assertSessionHas('success');

    $user = User::firstWhere('email', $email);
    $token = null;

    Notification::assertSentTo($user, UserInvitation::class, function (UserInvitation $n) use (&$token) {
        $token = $n->token;

        return true;
    });

    auth()->logout();

    return [$user, $token];
}

// --- Mengundang ----------------------------------------------------------------

it('sends an Indonesian invitation and marks the user as pending', function () {
    [$user, $token] = inviteUser($this->admin);

    expect($user->invited_at)->not->toBeNull()
        ->and($user->invitation_accepted_at)->toBeNull()
        ->and($user->isInvitationPending())->toBeTrue();

    Notification::assertSentTo($user, UserInvitation::class, function (UserInvitation $n) use ($user, $token) {
        $mail = $n->toMail($user);
        $text = implode("\n", $mail->introLines);

        return $mail->subject === 'Undangan bergabung ke Studio Contoh di eTagih'
            && $mail->actionText === 'Terima undangan & buat password'
            && str_contains((string) $mail->actionUrl, '/invitation/'.$token)
            && str_contains($text, 'Admin Satu')
            && str_contains($text, 'Staf')
            && str_contains(implode("\n", $mail->outroLines), '7 hari');
    });
    Notification::assertNotSentTo($user, ResetPassword::class);

    $this->actingAs($this->admin)->get(route('users.index'))
        ->assertInertia(fn ($page) => $page
            ->where('users.2.email', 'baru@example.com')
            ->where('users.2.status', 'pending')
            ->where('users.2.can.resend_invitation', true)
            ->where('users.0.status', 'active')
            ->where('users.0.can.resend_invitation', false));
});

it('sends no invitation in temporary password mode', function () {
    Notification::fake();

    $this->actingAs($this->admin)->post(route('users.store'), [
        'name' => 'Staf Sementara',
        'email' => 'sementara@example.com',
        'role' => 'staff',
        'password_mode' => 'temporary',
    ])->assertSessionHas('temporary_password');

    Notification::assertNothingSent();
    expect(User::firstWhere('email', 'sementara@example.com')->invited_at)->toBeNull();
});

it('falls back to the app name when no business name is set', function () {
    Setting::query()->whereKey(1)->update(['company_name' => null]);

    expect(UserInvitation::businessName())->toBe(config('app.name'));
});

// --- Halaman terima undangan ---------------------------------------------------

it('shows the accept page for a valid token', function () {
    [$user, $token] = inviteUser($this->admin);

    $this->get(route('invitation.accept', ['token' => $token, 'email' => $user->email]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/accept-invitation')
            ->where('email', $user->email)
            ->where('token', $token)
            ->where('name', 'Staf Baru')
            ->where('businessName', 'Studio Contoh')
            ->where('expired', false));
});

it('shows the expired state for an invalid token', function () {
    [$user] = inviteUser($this->admin);

    $this->get(route('invitation.accept', ['token' => 'salah', 'email' => $user->email]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/accept-invitation')
            ->where('expired', true)
            ->where('message', 'Undangan sudah kedaluwarsa. Minta admin mengirim ulang undangan.'));
});

it('accepts the invitation, sets the password, and logs the user in', function () {
    [$user, $token] = inviteUser($this->admin);

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'password-baru-123',
    ])->assertRedirect(route('security.edit').'?welcome=1')
        ->assertSessionHas('success');

    $user->refresh();
    $this->assertAuthenticatedAs($user);
    expect(Hash::check('password-baru-123', $user->password))->toBeTrue()
        ->and($user->invitation_accepted_at)->not->toBeNull()
        ->and($user->isInvitationPending())->toBeFalse();

    // Tidak diminta konfirmasi password lagi untuk membuka Keamanan / passkey.
    $this->get(route('security.edit', ['welcome' => 1]))->assertOk();

    // Token sekali pakai.
    auth()->logout();
    $this->get(route('invitation.accept', ['token' => $token, 'email' => $user->email]))
        ->assertInertia(fn ($page) => $page->where('expired', true));
});

it('keeps the invitation valid for 7 days, unlike a normal reset token', function () {
    [$user, $token] = inviteUser($this->admin);

    $this->travel(3)->days();

    // Broker reset password biasa (60 menit) sudah menganggapnya kedaluwarsa.
    expect(Password::broker()->tokenExists($user, $token))->toBeFalse();

    $this->get(route('invitation.accept', ['token' => $token, 'email' => $user->email]))
        ->assertInertia(fn ($page) => $page->where('expired', false));
});

it('rejects an invitation older than 7 days', function () {
    [$user, $token] = inviteUser($this->admin);

    $this->travel(8)->days();

    $this->get(route('invitation.accept', ['token' => $token, 'email' => $user->email]))
        ->assertInertia(fn ($page) => $page->where('expired', true));

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'password-baru-123',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
    expect($user->fresh()->invitation_accepted_at)->toBeNull();
});

it('does not let a deactivated user accept the invitation', function () {
    [$user, $token] = inviteUser($this->admin);
    $user->forceFill(['is_active' => false])->save();

    $this->get(route('invitation.accept', ['token' => $token, 'email' => $user->email]))
        ->assertInertia(fn ($page) => $page->where('expired', true));

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'password-baru-123',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('validates the password confirmation', function () {
    [$user, $token] = inviteUser($this->admin);

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'beda',
    ])->assertSessionHasErrors('password');

    $this->assertGuest();
});

// --- Kirim ulang undangan ------------------------------------------------------

it('resends the invitation to a pending user', function () {
    [$user, $oldToken] = inviteUser($this->admin);
    $this->travel(2)->minutes();

    Notification::fake();
    $this->actingAs($this->admin)
        ->post(route('users.resend-invitation', $user))
        ->assertSessionHas('success');

    $newToken = null;
    Notification::assertSentTo($user, UserInvitation::class, function (UserInvitation $n) use (&$newToken) {
        $newToken = $n->token;

        return true;
    });

    expect($user->fresh()->invited_at->gt($user->invited_at))->toBeTrue()
        ->and(Password::broker('invites')->tokenExists($user, $oldToken))->toBeFalse()
        ->and(Password::broker('invites')->tokenExists($user, $newToken))->toBeTrue();
});

it('throttles resending an invitation', function () {
    [$user] = inviteUser($this->admin);

    Notification::fake();
    $this->actingAs($this->admin)
        ->post(route('users.resend-invitation', $user))
        ->assertSessionHas('warning');

    Notification::assertNothingSent();
});

it('only resends invitations to pending users the actor may manage', function () {
    [$invitedAdmin] = inviteUser($this->owner, 'admin.baru@example.com', 'admin');
    $staff = User::factory()->state(['role' => 'staff'])->create();

    // Admin tidak boleh mengelola admin lain.
    $this->actingAs($this->admin)
        ->post(route('users.resend-invitation', $invitedAdmin))
        ->assertForbidden();

    // Pengguna aktif (bukan undangan) tidak bisa dikirimi undangan.
    $this->actingAs($this->admin)
        ->post(route('users.resend-invitation', $staff))
        ->assertForbidden();

    // Staf tidak punya akses ke manajemen pengguna.
    $this->actingAs($staff)
        ->post(route('users.resend-invitation', $invitedAdmin))
        ->assertForbidden();
});

// --- Reset password biasa ------------------------------------------------------

it('sends the password reset email in Indonesian', function () {
    Notification::fake();

    Password::broker()->sendResetLink(['email' => $this->admin->email]);

    Notification::assertSentTo($this->admin, ResetPassword::class, function (ResetPassword $n) {
        $mail = $n->toMail($this->admin);

        return $mail->subject === 'Atur ulang password eTagih'
            && str_contains((string) $mail->actionUrl, '/reset-password/')
            && str_contains(implode("\n", $mail->outroLines), '60 menit');
    });
});

it('does not accept a normal password reset token on the invitation page', function () {
    // Tabel token sama: tanpa cek "undangan menunggu", token reset (60 menit)
    // akan berlaku 7 hari di sini dan langsung login tanpa tantangan 2FA.
    $this->admin->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_confirmed_at' => now()])->save();
    $token = Password::broker()->createToken($this->admin);
    $hash = $this->admin->fresh()->password;

    $this->get(route('invitation.accept', ['token' => $token, 'email' => $this->admin->email]))
        ->assertInertia(fn ($page) => $page->where('expired', true));

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $this->admin->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'password-baru-123',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
    expect($this->admin->fresh()->password)->toBe($hash);
});

it('does not accept an invitation twice once it was accepted via password reset', function () {
    [$user, $token] = inviteUser($this->admin);
    $user->forceFill(['invitation_accepted_at' => now()])->save();

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'password-baru-123',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('marks the invitation accepted when the user resets the password instead', function () {
    [$user] = inviteUser($this->admin);
    $token = Password::broker()->createToken($user);

    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password-baru-123',
        'password_confirmation' => 'password-baru-123',
    ])->assertSessionHasNoErrors();

    expect($user->fresh()->invitation_accepted_at)->not->toBeNull();
});

// --- Status sistem -------------------------------------------------------------

it('reports whether HTTPS is available for passkeys', function () {
    config(['app.update_check' => false]);
    $find = fn () => collect(app(SystemStatus::class)->checks())->firstWhere('key', 'https');

    config(['app.url' => 'https://tagih.example.com']);
    expect($find()['status'])->toBe('ok');

    config(['app.url' => 'http://tagih.example.com']);
    expect($find()['status'])->toBe(app()->environment('local') ? 'info' : 'warning');
});
