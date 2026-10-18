<?php

use App\Models\Client;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('access_key', 64)->nullable()->unique()->after('notes');
        });

        // Backfill key akses untuk client yang sudah ada (biar portal tetap bisa dibuka
        // tanpa admin harus generate manual satu per satu). Tabrakan nilai acak praktis
        // mustahil, tapi tetap di-loop untuk menjaga constraint unique.
        Client::query()
            ->whereNull('access_key')
            ->lazyById()
            ->each(function (Client $client) {
                do {
                    $key = Str::random(24);
                } while (Client::query()->where('access_key', $key)->exists());

                DB::table('clients')->where('id', $client->id)->update(['access_key' => $key]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropUnique(['access_key']);
            $table->dropColumn('access_key');
        });
    }
};
