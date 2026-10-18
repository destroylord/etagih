<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Helper ringkas baca Settings singleton.
 *
 * Kalau tabel settings kosong (fresh install), tetap kembalikan Setting baru
 * supaya `?? null` di service layer tidak error saat boot.
 * Memakai `firstOrCreate([])` dengan id=1 untuk single-row config table.
 */
class Settings
{
    public static function current(): Setting
    {
        return once(fn () => Setting::firstOrCreate(['id' => 1]));
    }
}
