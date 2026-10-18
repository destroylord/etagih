<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Payment tahu cicilan mana yang dibayar, jadi webhook bisa menandai
        // schedule yang tepat (sebelumnya regex -C<id> pada external_id tidak pernah cocok).
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('schedule_id')->nullable()->after('invoice_id')
                ->constrained('payment_schedules')->nullOnDelete();
        });

        // Jam manual untuk item hourly yang tidak berasal dari Time Tracker.
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->decimal('manual_hours', 10, 4)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('schedule_id');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn('manual_hours');
        });
    }
};
