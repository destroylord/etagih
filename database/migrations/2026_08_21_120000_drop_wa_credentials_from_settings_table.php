<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WA credentials pindah ke .env (config/services.php). Kolom DB dihapus
 * biar gak ada dead state. Template (`wa_template_*`) tetep di settings
 * karena per-bisnis customizable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn(['wa_api_key', 'wa_sender_number']);
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->text('wa_api_key')->nullable()->after('default_hourly_rate');
            $table->string('wa_sender_number', 32)->nullable()->after('wa_api_key');
        });
    }
};
