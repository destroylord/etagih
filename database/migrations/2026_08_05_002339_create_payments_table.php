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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->enum('method', ['qris', 'manual'])->default('qris');

            // External reference dari QRISLY
            $table->string('external_id', 128)->nullable()->unique();

            $table->enum('status', ['pending', 'success', 'failed', 'expired'])->default('pending');

            $table->timestamp('paid_at')->nullable();

            // Simpan raw response webhook untuk debugging
            $table->json('raw_response')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('method');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
