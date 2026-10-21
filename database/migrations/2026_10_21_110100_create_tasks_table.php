<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tugas (task) per proyek / sub-proyek, beserta checklist & komentar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            // Tugas selalu milik proyek atau sub-proyek.
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('todo'); // todo|in_progress|review|done
            $table->string('priority', 20)->default('normal'); // low|normal|high|urgent
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedInteger('estimate_minutes')->nullable();
            $table->boolean('billable')->default(true);
            $table->decimal('fixed_price', 15, 2)->nullable();
            // Urutan di dalam kolom status (papan kanban).
            $table->unsignedInteger('position')->default(0);
            $table->timestamp('completed_at')->nullable();
            // Tagihan: terisi saat tugas dimasukkan ke item invoice.
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('invoice_item_id')->nullable()->constrained()->nullOnDelete();
            // Pengingat terjadwal (tasks:remind) supaya hanya dikirim sekali.
            $table->timestamp('due_soon_notified_at')->nullable();
            $table->timestamp('overdue_notified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'status', 'position']);
            $table->index(['assignee_id', 'status']);
            $table->index('due_date');
            $table->index(['status', 'position']);
        });

        Schema::create('task_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->string('body', 255);
            $table->boolean('is_done')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_comments');
        Schema::dropIfExists('task_checklist_items');
        Schema::dropIfExists('tasks');
    }
};
