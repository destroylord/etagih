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
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->date('issue_date');
            $table->date('due_date')->nullable();

            // Mode kerja: fixed (uraian jasa) atau hourly (per jam)
            $table->enum('invoice_mode', ['fixed', 'hourly'])->default('fixed');

            // Tipe pembayaran: full atau installment (cicilan)
            $table->enum('type', ['full', 'installment'])->default('full');

            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);

            // Status invoice
            $table->enum('status', ['draft', 'sent', 'partial', 'paid', 'cancelled', 'overdue'])
                ->default('draft');

            // Token publik untuk akses bayar tanpa login
            $table->string('public_token', 64)->unique();

            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('type');
            $table->index('issue_date');
            $table->index('due_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
