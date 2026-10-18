<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Klien → Proyek → Sub-proyek (maks. 2 level; parent_id null = proyek utama).
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'completed', 'archived'])->default('active');
            // Tarif per jam khusus proyek (Time Tracker). Null = ikut sub→proyek→klien→default.
            $table->decimal('hourly_rate', 15, 2)->nullable();
            $table->timestamps();

            $table->unique(['client_id', 'parent_id', 'name']);
            $table->index(['client_id', 'status']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('client_id')->constrained()->nullOnDelete();
        });

        // Item bisa ditautkan ke sub-proyek → dikelompokkan di PDF & laporan.
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('product_id')->constrained()->nullOnDelete();
        });

        Schema::table('work_sessions', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('client_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        foreach (['work_sessions', 'invoice_items', 'invoices'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('project_id');
            });
        }

        Schema::dropIfExists('projects');
    }
};
