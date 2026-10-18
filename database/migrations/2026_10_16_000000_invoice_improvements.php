<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pajak, diskon persen, pengingat, invoice berulang, pembatalan.
        Schema::table('invoices', function (Blueprint $table) {
            $table->enum('discount_type', ['amount', 'percent'])->default('amount')->after('discount');
            $table->decimal('discount_value', 15, 2)->default(0)->after('discount_type');
            $table->decimal('tax_rate', 5, 2)->default(0)->after('discount_value');
            $table->decimal('tax_amount', 15, 2)->default(0)->after('tax_rate');

            $table->unsignedSmallInteger('reminder_count')->default(0);
            $table->timestamp('last_reminded_at')->nullable();

            $table->enum('recurrence', ['none', 'weekly', 'monthly', 'quarterly', 'yearly'])->default('none');
            $table->date('recurrence_next_date')->nullable();
            $table->boolean('recurrence_auto_send')->default(false);
            $table->foreignId('recurring_parent_id')->nullable()->constrained('invoices')->nullOnDelete();

            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 500)->nullable();
        });

        // Riwayat lama: diskon tersimpan sebagai nominal.
        DB::table('invoices')->update(['discount_value' => DB::raw('discount')]);

        Schema::table('payment_schedules', function (Blueprint $table) {
            $table->unsignedSmallInteger('reminder_count')->default(0);
            $table->timestamp('last_reminded_at')->nullable();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('notes', 500)->nullable();
        });

        Schema::table('settings', function (Blueprint $table) {
            $table->decimal('default_tax_rate', 5, 2)->default(0);
            $table->string('reminder_days_before', 32)->nullable()->default('3,1');
            $table->unsignedSmallInteger('reminder_interval_days')->default(3);
            $table->unsignedSmallInteger('reminder_max_count')->default(5);
            $table->text('wa_template_reminder_upcoming')->nullable();
        });

        // Kunci portal disimpan sebagai hash (sha256) — plaintext hanya tampil sekali.
        Schema::table('clients', function (Blueprint $table) {
            $table->string('access_key_hash', 64)->nullable()->unique();
        });
        foreach (DB::table('clients')->whereNotNull('access_key')->get(['id', 'access_key']) as $row) {
            DB::table('clients')->where('id', $row->id)->update(['access_key_hash' => hash('sha256', $row->access_key)]);
        }
        Schema::table('clients', function (Blueprint $table) {
            $table->dropUnique(['access_key']);
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('access_key');
        });

        // Hapus klien tidak boleh ikut menghapus riwayat keuangan.
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->foreign('client_id')->references('id')->on('clients')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->foreign('client_id')->references('id')->on('clients')->cascadeOnDelete();
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->string('access_key', 64)->nullable()->unique();
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropUnique(['access_key_hash']);
            $table->dropColumn('access_key_hash');
        });

        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn(['default_tax_rate', 'reminder_days_before', 'reminder_interval_days', 'reminder_max_count', 'wa_template_reminder_upcoming']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('notes');
        });

        Schema::table('payment_schedules', function (Blueprint $table) {
            $table->dropColumn(['reminder_count', 'last_reminded_at']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recurring_parent_id');
            $table->dropColumn([
                'discount_type', 'discount_value', 'tax_rate', 'tax_amount',
                'reminder_count', 'last_reminded_at',
                'recurrence', 'recurrence_next_date', 'recurrence_auto_send',
                'cancelled_at', 'cancel_reason',
            ]);
        });
    }
};
