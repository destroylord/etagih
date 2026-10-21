<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sesi Time Tracker bisa dikaitkan ke tugas; item invoice bisa berasal dari tugas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_sessions', function (Blueprint $table) {
            $table->foreignId('task_id')->nullable()->after('project_id')->constrained()->nullOnDelete();
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('task_id')->nullable()->after('project_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('task_id');
        });

        Schema::table('work_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('task_id');
        });
    }
};
