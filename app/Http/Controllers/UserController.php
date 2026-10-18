<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Manajemen pengguna (Pengaturan → Pengguna). Rute dibungkus `role:admin`.
 *
 * Aturan:
 * - Pemilik tidak bisa diubah role-nya, dinonaktifkan, atau dihapus — hanya lewat
 *   "Jadikan pemilik" (alih kepemilikan) oleh pemilik itu sendiri.
 * - Pengguna tidak bisa menghapus / menonaktifkan / mengubah role dirinya sendiri.
 * - Admin hanya bisa mengelola staf; mengelola admin lain hanya oleh pemilik.
 * - Membuat / mempromosikan admin hanya oleh pemilik.
 */
class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $actor = $this->actor($request);

        $users = User::query()
            ->orderByRaw("CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END")
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_active' => $user->is_active !== false,
                'two_factor_enabled' => $user->two_factor_confirmed_at !== null,
                'created_at' => $user->created_at?->toIso8601String(),
                'is_self' => $user->is($actor),
                'can' => [
                    'edit' => $this->canManage($actor, $user),
                    'change_role' => $this->canRestrict($actor, $user),
                    'deactivate' => $this->canRestrict($actor, $user),
                    'delete' => $this->canRestrict($actor, $user),
                    'reset_password' => $this->canManage($actor, $user),
                    'transfer_ownership' => $this->canTransferTo($actor, $user),
                ],
            ])
            ->values();

        return Inertia::render('settings/users', [
            'users' => $users,
            'assignableRoles' => $this->assignableRoles($actor),
            'roleLabels' => User::ROLE_LABELS,
            // Password sementara hanya ada di request setelah pengguna dibuat.
            'temporaryPassword' => $request->session()->get('temporary_password'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $this->actor($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)],
            'role' => ['required', Rule::in($this->assignableRoles($actor))],
            'password_mode' => ['required', Rule::in(['invite', 'temporary'])],
        ], [
            'role.in' => 'Hanya pemilik yang bisa menambah admin.',
        ]);

        $temporary = $data['password_mode'] === 'temporary' ? Str::password(12, symbols: false) : null;

        $user = new User;
        $user->forceFill([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'is_active' => true,
            // Dibuat oleh admin → email dianggap terverifikasi.
            'email_verified_at' => now(),
            // Mode undangan: password acak yang tidak pernah diketahui siapa pun.
            'password' => $temporary ?? Str::password(40),
        ])->save();

        $redirect = redirect()->route('users.index');

        if ($temporary !== null) {
            return $redirect
                ->with('success', "Pengguna {$user->name} ditambahkan.")
                ->with('temporary_password', [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'password' => $temporary,
                ]);
        }

        [$type, $message] = $this->sendResetLink($user, invite: true);

        return $redirect->with($type, $message);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $actor = $this->actor($request);

        abort_unless($this->canManage($actor, $user), 403, 'Anda tidak boleh mengubah pengguna ini.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)->ignore($user->id)],
            'role' => ['sometimes', 'required', Rule::in(User::ROLES)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $role = $data['role'] ?? $user->role;
        $active = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : ($user->is_active !== false);

        if ($role !== $user->role) {
            abort_unless($this->canRestrict($actor, $user), 403, 'Role pengguna ini tidak bisa diubah.');
            abort_unless(in_array($role, $this->assignableRoles($actor), true), 403, 'Hanya pemilik yang bisa menjadikan pengguna admin.');
        }

        if ($active !== ($user->is_active !== false)) {
            abort_unless($this->canRestrict($actor, $user), 403, 'Status pengguna ini tidak bisa diubah.');
        }

        $user->forceFill([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $role,
            'is_active' => $active,
        ])->save();

        return back()->with('success', "Data {$user->name} diperbarui.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $actor = $this->actor($request);

        abort_unless($this->canRestrict($actor, $user), 403, 'Pengguna ini tidak bisa dihapus.');

        $name = $user->name;
        $user->delete();

        return redirect()->route('users.index')->with('success', "Pengguna {$name} dihapus.");
    }

    public function sendPasswordReset(Request $request, User $user): RedirectResponse
    {
        abort_unless($this->canManage($this->actor($request), $user), 403, 'Anda tidak boleh mengelola pengguna ini.');

        [$type, $message] = $this->sendResetLink($user, invite: false);

        return back()->with($type, $message);
    }

    /** Alihkan kepemilikan: target menjadi pemilik, pemilik lama menjadi admin. */
    public function transferOwnership(Request $request, User $user): RedirectResponse
    {
        $actor = $this->actor($request);

        abort_unless($actor->isOwner(), 403, 'Hanya pemilik yang bisa mengalihkan kepemilikan.');
        abort_unless($this->canTransferTo($actor, $user), 403, 'Kepemilikan tidak bisa dialihkan ke pengguna ini.');

        DB::transaction(function () use ($actor, $user) {
            $actor->forceFill(['role' => 'admin'])->save();
            $user->forceFill(['role' => 'owner'])->save();
        });

        return redirect()->route('users.index')->with('success', "{$user->name} sekarang menjadi pemilik. Role Anda menjadi admin.");
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }

    /** Boleh mengubah data dasar (nama, email) & mengirim reset password. */
    private function canManage(User $actor, User $target): bool
    {
        if ($actor->is($target)) {
            return true;
        }

        return match ($target->role) {
            'owner' => false,
            'admin' => $actor->isOwner(),
            default => $actor->isAdmin(),
        };
    }

    /** Boleh mengubah role, menonaktifkan, atau menghapus. */
    private function canRestrict(User $actor, User $target): bool
    {
        return ! $actor->is($target)
            && ! $target->isOwner()
            && $this->canManage($actor, $target);
    }

    private function canTransferTo(User $actor, User $target): bool
    {
        return $actor->isOwner()
            && ! $actor->is($target)
            && $target->is_active !== false;
    }

    /** @return list<string> */
    private function assignableRoles(User $actor): array
    {
        return $actor->isOwner() ? ['admin', 'staff'] : ['staff'];
    }

    /**
     * Kirim tautan atur/reset password lewat Password broker. Kegagalan mail
     * tidak boleh membuat request gagal — cukup peringatan.
     *
     * @return array{0: 'success'|'warning', 1: string}
     */
    private function sendResetLink(User $user, bool $invite): array
    {
        $prefix = $invite ? "Pengguna {$user->name} ditambahkan. " : '';

        try {
            $status = Password::broker()->sendResetLink(['email' => $user->email]);
        } catch (Throwable $e) {
            Log::warning('Gagal mengirim email atur password.', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return ['warning', $prefix.'Email untuk mengatur password gagal dikirim — periksa konfigurasi email atau buat password sementara.'];
        }

        return match ($status) {
            Password::RESET_LINK_SENT => ['success', $prefix."Email untuk mengatur password dikirim ke {$user->email}."],
            Password::RESET_THROTTLED => ['warning', $prefix.'Email atur password baru saja dikirim. Tunggu sebentar sebelum mengirim ulang.'],
            default => ['warning', $prefix.'Email untuk mengatur password tidak bisa dikirim.'],
        };
    }
}
