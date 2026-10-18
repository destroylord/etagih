<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();

            // Company profile (untuk invoice PDF)
            $table->string('company_name')->nullable();
            $table->text('company_address')->nullable();
            $table->string('company_email')->nullable();
            $table->string('company_phone', 32)->nullable();
            $table->string('company_logo_path')->nullable();
            $table->text('bank_account_info')->nullable();
            $table->text('invoice_footer_text')->nullable();

            // Invoice numbering & hourly rate
            $table->string('app_invoice_prefix')->default('INV');
            $table->decimal('default_hourly_rate', 15, 2)->default(50000);

            // QRISLY credentials
            $table->text('qrisly_api_key')->nullable();
            $table->string('qrisly_merchant_id')->nullable();
            $table->text('qrisly_qris_string')->nullable(); // static QRIS fallback

            // WhatsApp gateway credentials (Fonnte)
            $table->text('wa_api_key')->nullable();
            $table->string('wa_sender_number')->nullable();

            // Default WA templates (multi-line)
            $table->text('wa_template_invoice')->nullable();
            $table->text('wa_template_payment_received')->nullable();

            $table->timestamps();
        });

        // Seed singleton row id=1
        DB::table('settings')->insert([
            'id' => 1,
            'company_name' => config('app.name'),
            'app_invoice_prefix' => 'INV',
            'default_hourly_rate' => 50000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
