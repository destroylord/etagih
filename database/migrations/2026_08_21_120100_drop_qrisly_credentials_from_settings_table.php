<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * QRISLY credentials pindah ke .env (config/services.php). Kolom DB dihapus
 * biar gak ada dead state. Code di QrislyService udah 100% baca dari config().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn([
                'qrisly_api_key',
                'qrisly_merchant_id',
                'qrisly_qris_string',
                'qrisly_is_production',
                'qrisly_webhook_secret_sandbox',
                'qrisly_webhook_secret_production',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->text('qrisly_api_key')->nullable()->after('default_hourly_rate');
            $table->string('qrisly_merchant_id')->nullable()->after('qrisly_api_key');
            $table->text('qrisly_qris_string')->nullable()->after('qrisly_merchant_id');
            $table->boolean('qrisly_is_production')->default(false)->after('qrisly_qris_string');
            $table->text('qrisly_webhook_secret_sandbox')->nullable()->after('qrisly_is_production');
            $table->text('qrisly_webhook_secret_production')->nullable()->after('qrisly_webhook_secret_sandbox');
        });
    }
};
