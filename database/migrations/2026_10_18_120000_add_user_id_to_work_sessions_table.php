<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Time tracker per pengguna: tiap user boleh punya satu session aktif.
        Schema::table('work_sessions', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        // Session lama dicatat atas nama pemilik (atau user paling awal bila belum ada pemilik).
        $ownerId = DB::table('users')->where('role', 'owner')->orderBy('id')->value('id')
            ?? DB::table('users')->orderBy('id')->value('id');

        if ($ownerId) {
            DB::table('work_sessions')->whereNull('user_id')->update(['user_id' => $ownerId]);
        }
    }

    public function down(): void
    {
        Schema::table('work_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
