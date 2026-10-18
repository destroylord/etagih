<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // owner = pemilik (1 orang), admin = akses penuh, staff = operasional tanpa pengaturan/laporan.
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['owner', 'admin', 'staff'])->default('staff')->after('email');
            $table->boolean('is_active')->default(true)->after('role');
        });

        // Instalasi lama: user paling awal jadi owner, sisanya admin (perilaku sebelumnya = akses penuh).
        $first = DB::table('users')->orderBy('id')->value('id');
        if ($first) {
            DB::table('users')->update(['role' => 'admin']);
            DB::table('users')->where('id', $first)->update(['role' => 'owner']);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_active']);
        });
    }
};
