<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->text('qrisly_webhook_secret_sandbox')->nullable()->after('qrisly_is_production');
            $table->text('qrisly_webhook_secret_production')->nullable()->after('qrisly_webhook_secret_sandbox');
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn(['qrisly_webhook_secret_sandbox', 'qrisly_webhook_secret_production']);
        });
    }
};
