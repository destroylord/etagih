<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/**
 * Buat / perbarui akun admin (registrasi publik dimatikan).
 *
 *   php artisan app:create-admin
 *   php artisan app:create-admin --email=saya@domain.com --name="Nama Saya"
 */
class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin
        {--name= : Nama admin}
        {--email= : Email login}
        {--password= : Password (kosongkan untuk diketik secara tersembunyi)}';

    protected $description = 'Create or update an admin login account.';

    public function handle(): int
    {
        $name = $this->stringOption('name') ?? text('Nama', default: 'Admin', required: true);
        $email = $this->stringOption('email') ?? text('Email login', required: true, validate: fn ($v) => filter_var($v, FILTER_VALIDATE_EMAIL) ? null : 'Email tidak valid.');
        $password = $this->stringOption('password') ?? password('Password (min. 8 karakter)', required: true);

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password],
            ['name' => ['required', 'string', 'max:255'], 'email' => ['required', 'email', 'max:255'], 'password' => ['required', 'string', 'min:8']],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::query()->firstOrNew(['email' => strtolower($email)]);
        // email_verified_at tidak fillable → isi eksplisit (rute admin butuh `verified`).
        // User pertama otomatis jadi pemilik; selanjutnya admin. User lama mempertahankan role-nya.
        $role = $user->exists
            ? $user->role
            : (User::query()->where('role', 'owner')->exists() ? 'admin' : 'owner');

        $user->forceFill([
            'name' => $name,
            'password' => Hash::make($password),
            'email_verified_at' => $user->email_verified_at ?? now(),
            'role' => $role,
            'is_active' => true,
        ])->save();

        $this->info(($user->wasRecentlyCreated ? 'Admin dibuat: ' : 'Admin diperbarui: ').$user->email);

        return self::SUCCESS;
    }

    private function stringOption(string $key): ?string
    {
        $value = $this->option($key);

        return is_string($value) && trim($value) !== '' ? $value : null;
    }
}
