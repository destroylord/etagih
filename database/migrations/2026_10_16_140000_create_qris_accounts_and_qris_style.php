<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // QRIS statis merchant yang sudah di-upload ke QRISLY (POST /upload-qris).
        Schema::create('qris_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('qris_id', 64)->unique(); // dari response QRISLY
            $table->string('name', 100);
            $table->string('provider', 64)->nullable();
            $table->string('merchant_name')->nullable();
            $table->string('image_path')->nullable(); // salinan lokal gambar QRIS asli
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        // Gaya tampilan QR di halaman bayar / PDF (warna, bentuk, logo, bingkai).
        Schema::table('settings', function (Blueprint $table) {
            $table->json('qris_style')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn('qris_style');
        });

        Schema::dropIfExists('qris_accounts');
    }
};
