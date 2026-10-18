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
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            // product_id nullable: kalau dari catalog opsional, kalau manual description tetap boleh
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();

            $table->string('description');

            // hours_qty: hanya untuk mode hourly (nullable untuk fixed)
            $table->decimal('hours_qty', 8, 2)->nullable();

            // unit_price: untuk fixed = harga jasa flat, untuk hourly = rate per jam
            $table->decimal('unit_price', 15, 2);

            // line_total = hours_qty * unit_price (untuk hourly) atau unit_price (untuk fixed)
            $table->decimal('line_total', 15, 2);

            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
