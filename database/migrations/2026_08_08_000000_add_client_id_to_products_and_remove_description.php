<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Produk kini dimiliki oleh klien (ownership). client_id nullable supaya
        // data lama / produk yang belum ditetapkan tetap aman.
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        // Produk tidak lagi punya teks detail/"uraian" sendiri — uraian dipegang
        // oleh baris invoice (InvoiceItem.description).
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->text('description')->nullable()->after('name');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
        });
    }
};
