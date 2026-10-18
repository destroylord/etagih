<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Nomor kuitansi KWT-YYYYMMDD-0001, diisi saat pembayaran sukses.
            $table->string('receipt_number', 32)->nullable()->unique()->after('external_id');
        });

        // Backfill pembayaran sukses lama, urut paid_at (nomor harian per tanggal bayar).
        $counters = [];
        DB::table('payments')
            ->where('status', 'success')
            ->whereNull('receipt_number')
            ->orderByRaw('paid_at IS NULL')
            ->orderBy('paid_at')
            ->orderBy('id')
            ->get(['id', 'paid_at', 'created_at'])
            ->each(function (object $payment) use (&$counters): void {
                $date = Carbon::parse($payment->paid_at ?? $payment->created_at ?? now())->format('Ymd');
                $counters[$date] = ($counters[$date] ?? 0) + 1;

                DB::table('payments')->where('id', $payment->id)->update([
                    'receipt_number' => sprintf('KWT-%s-%04d', $date, $counters[$date]),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique(['receipt_number']);
            $table->dropColumn('receipt_number');
        });
    }
};
