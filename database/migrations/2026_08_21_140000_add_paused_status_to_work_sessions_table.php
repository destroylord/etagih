<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tambah status 'paused' untuk fitur pause/resume stopwatch.
 * duration_seconds saat running/paused = akumulasi segmen sebelumnya;
 * saat completed = total final (sudah di-round).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_sessions', function (Blueprint $table) {
            $table->enum('status', ['running', 'paused', 'completed', 'billed', 'cancelled'])
                ->default('running')
                ->change();
        });
    }

    public function down(): void
    {
        // Kembalikan session paused → cancelled dulu biar valid terhadap enum lama.
        DB::table('work_sessions')->where('status', 'paused')->update(['status' => 'cancelled']);

        Schema::table('work_sessions', function (Blueprint $table) {
            $table->enum('status', ['running', 'completed', 'billed', 'cancelled'])
                ->default('running')
                ->change();
        });
    }
};
