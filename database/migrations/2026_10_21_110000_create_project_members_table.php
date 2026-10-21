<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Anggota proyek: staf hanya melihat klien/proyek/invoice/penawaran/tugas dari
 * proyek tempat ia menjadi anggota. Keanggotaan disimpan di PROYEK UTAMA
 * (parent_id null) dan otomatis berlaku untuk semua sub-proyeknya.
 * Pemilik & admin selalu melihat semuanya (tanpa perlu jadi anggota).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'user_id']);
            $table->index('user_id');
        });

        // Backfill untuk instalasi yang di-upgrade: sebelum fitur ini, staf
        // melihat semua data. Supaya tim yang sudah berjalan tidak tiba-tiba
        // kehilangan akses, setiap staf yang ada dijadikan anggota setiap
        // proyek utama yang ada. Admin bisa mengurangi keanggotaan setelahnya.
        $staffIds = DB::table('users')->where('role', 'staff')->pluck('id');
        $rootIds = DB::table('projects')->whereNull('parent_id')->pluck('id');
        $now = now();

        foreach ($rootIds as $projectId) {
            $rows = $staffIds->map(fn ($userId) => [
                'project_id' => $projectId,
                'user_id' => $userId,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            if ($rows !== []) {
                DB::table('project_members')->insert($rows);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_members');
    }
};
