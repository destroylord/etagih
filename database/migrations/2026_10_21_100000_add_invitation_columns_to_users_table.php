<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Undangan tim: invited_at terisi saat admin mengundang lewat email,
        // invitation_accepted_at saat pengguna membuat password. Pengguna lama
        // dibiarkan null (dianggap aktif).
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('invited_at')->nullable()->after('is_active');
            $table->timestamp('invitation_accepted_at')->nullable()->after('invited_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['invited_at', 'invitation_accepted_at']);
        });
    }
};
