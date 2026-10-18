<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rename kolom gateway WhatsApp dari Kirimdev ke generic wa_* (provider Fonnte).
     */
    public function up(): void
    {
        // Fresh install sudah langsung memakai nama wa_* di create_settings_table,
        // jadi rename ini hanya perlu dijalankan untuk DB lama yang masih berisi kolom kirimdev_*.
        // (Tanpa guard, fresh install gagal karena kolom kirimdev_* tidak pernah ada.)
        if (Schema::hasTable('settings') && Schema::hasColumn('settings', 'kirimdev_api_key')) {
            Schema::table('settings', function (Blueprint $table) {
                $table->renameColumn('kirimdev_api_key', 'wa_api_key');
                $table->renameColumn('kirimdev_sender_number', 'wa_sender_number');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('settings') && Schema::hasColumn('settings', 'wa_api_key')) {
            Schema::table('settings', function (Blueprint $table) {
                $table->renameColumn('wa_api_key', 'kirimdev_api_key');
                $table->renameColumn('wa_sender_number', 'kirimdev_sender_number');
            });
        }
    }
};
