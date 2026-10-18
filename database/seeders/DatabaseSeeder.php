<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Sengaja tidak membuat akun bawaan (mis. admin/admin) — berbahaya bila
     * `migrate --seed` dijalankan di server publik.
     *
     * Buat akun pemilik lewat wizard di /setup, atau:
     *   php artisan app:create-admin
     */
    public function run(): void
    {
        $this->command?->info('Tidak ada data awal. Buka /setup atau jalankan `php artisan app:create-admin`.');
    }
}
