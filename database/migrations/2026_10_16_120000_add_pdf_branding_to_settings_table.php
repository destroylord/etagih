<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            // Identitas tambahan untuk invoice resmi.
            $table->string('company_tax_id', 64)->nullable();

            // Syarat & ketentuan default yang dicetak di setiap invoice.
            $table->text('invoice_terms')->nullable();

            // Tanda tangan.
            $table->string('signature_path')->nullable();
            $table->string('signer_name')->nullable();
            $table->string('signer_title')->nullable();

            // Tampilan PDF.
            $table->string('pdf_accent_color', 7)->default('#1e3a8a');
            $table->enum('pdf_watermark', ['logo', 'text', 'none'])->default('logo');
            $table->string('pdf_watermark_text', 60)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn([
                'company_tax_id', 'invoice_terms', 'signature_path', 'signer_name', 'signer_title',
                'pdf_accent_color', 'pdf_watermark', 'pdf_watermark_text',
            ]);
        });
    }
};
