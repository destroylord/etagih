<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            // Pengingat bea meterai Rp10.000 pada kuitansi > Rp5 juta (UU 10/2020).
            $table->boolean('stamp_duty_enabled')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn('stamp_duty_enabled');
        });
    }
};
