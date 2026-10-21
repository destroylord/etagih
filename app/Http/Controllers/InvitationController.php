<?php

namespace App\Http\Controllers;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use App\Notifications\UserInvitation;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;

/**
 * Halaman publik untuk menerima undangan tim: pengguna membuat password
 * sendiri lalu langsung masuk. Token divalidasi lewat broker `invites`
 * (berlaku 7 hari, lihat config/auth.php).
 */
class InvitationController extends Controller
{
    use PasswordValidationRules;

    public const EXPIRED_MESSAGE = 'Undangan sudah kedaluwarsa. Minta admin mengirim ulang undangan.';

    public function show(Request $request, string $token): Response
    {
        $email = (string) $request->query('email', '');
        $user = $this->validUser($email, $token);

        return Inertia::render('auth/accept-invitation', [
            'email' => $email,
            'token' => $token,
            'name' => $user?->name,
            'businessName' => UserInvitation::businessName(),
            'expired' => $user === null,
            'message' => $user === null ? self::EXPIRED_MESSAGE : null,
            'passwordRules' => PasswordRule::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email'],
            'password' => $this->passwordRules(),
        ]);

        $user = $this->validUser($data['email'], $data['token']);

        if ($user === null) {
            throw ValidationException::withMessages(['email' => self::EXPIRED_MESSAGE]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'invitation_accepted_at' => $user->invitation_accepted_at ?? now(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->broker()->deleteToken($user);

        Auth::login($user);
        $request->session()->regenerate();
        // Password baru saja dibuat → tidak perlu konfirmasi ulang untuk
        // membuka Keamanan & mendaftarkan passkey.
        $request->session()->put('auth.password_confirmed_at', time());

        return redirect()->to(route('security.edit').'?welcome=1')
            ->with('success', "Selamat bergabung, {$user->name}! Akun Anda siap dipakai. Tambahkan passkey agar bisa masuk lebih cepat.");
    }

    /** Pengguna aktif dengan token undangan yang masih berlaku, atau null. */
    private function validUser(string $email, string $token): ?User
    {
        if ($email === '' || $token === '') {
            return null;
        }

        $user = User::query()->where('email', $email)->first();

        // Hanya undangan yang masih menunggu: tabel token dipakai bersama broker
        // reset password, jadi tanpa cek ini token reset biasa (60 menit) bisa
        // dipakai di sini selama 7 hari dan langsung login tanpa 2FA.
        if ($user === null || $user->is_active === false || ! $user->isInvitationPending()) {
            return null;
        }

        return $this->broker()->tokenExists($user, $token) ? $user : null;
    }

    private function broker(): PasswordBroker
    {
        $broker = Password::broker('invites');

        if (! $broker instanceof PasswordBroker) {
            throw new LogicException('Broker password "invites" tidak dikonfigurasi.');
        }

        return $broker;
    }
}
