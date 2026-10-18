<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // PPh 23 (dipotong klien badan dari DPP). `total` = jumlah yang dibayar klien (sudah dikurangi PPh).
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('pph_rate', 5, 2)->default(0)->after('tax_amount');
            $table->decimal('pph_amount', 15, 2)->default(0)->after('pph_rate');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['pph_rate', 'pph_amount']);
        });
    }
};
