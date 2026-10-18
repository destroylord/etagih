<?php

namespace App\Actions\Invoice;

use App\Models\WorkSession;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Aksi untuk work session (stopwatch time tracking).
 *
 * Model waktu:
 * - `duration_seconds` saat status running/paused = AKUMULASI segmen sebelumnya
 *   (hasil pause-pause). Saat completed = total final (sudah di-round).
 * - `started_at` = mulai segmen yang sedang berjalan (null berarti tidak ada
 *   segmen aktif — session paused atau selesai).
 *
 * Pause/resume:
 * - pause  : tutup segmen (accum += now-started_at), status=paused.
 * - resume : buka segmen baru (started_at=now), status=running.
 * - stop   : total = accum (+ segmen jalan bila running), lalu round-up.
 *
 * Lock per pengguna: tiap pengguna hanya boleh punya SATU session aktif
 * (running/paused). Pengguna berbeda boleh mencatat waktu bersamaan.
 * Guard atomic via cache lock per user.
 */
class WorkSessionAction
{
    public function start(int $userId, int $clientId, string $description, float $unitPrice, ?string $notes = null, ?int $projectId = null): WorkSession
    {
        // Atomic guard: request bersamaan dari user yang sama tetap serial. 5 detik cukup utk cek+insert.
        return Cache::lock("work-session-user-{$userId}", 5)->block(3, function () use ($userId, $clientId, $description, $unitPrice, $notes, $projectId) {
            $active = WorkSession::query()
                ->where('user_id', $userId)
                ->whereIn('status', ['running', 'paused'])
                ->with('client')
                ->first();

            if ($active) {
                throw new RuntimeException(
                    "Anda masih punya session aktif untuk {$active->client->name} — \"{$active->description}\" "
                    ."({$active->status} sejak {$active->started_at?->format('H:i')}). Stop dulu sebelum mulai baru."
                );
            }

            return WorkSession::create([
                'user_id' => $userId,
                'client_id' => $clientId,
                'project_id' => $projectId,
                'description' => $description,
                'unit_price' => $unitPrice,
                'started_at' => now(),
                'status' => 'running',
                'notes' => $notes,
            ]);
        });
    }

    public function pause(WorkSession $session): WorkSession
    {
        if (! $session->isRunning()) {
            throw new RuntimeException('Hanya session yang sedang running yang bisa di-pause.');
        }

        $segmentSeconds = max(1, (int) $session->started_at->diffInSeconds(now()));

        $session->update([
            'duration_seconds' => (int) ($session->duration_seconds ?? 0) + $segmentSeconds,
            'ended_at' => now(),
            'status' => 'paused',
        ]);

        return $session->fresh();
    }

    public function resume(WorkSession $session): WorkSession
    {
        if ($session->status !== 'paused') {
            throw new RuntimeException('Hanya session yang paused yang bisa di-resume.');
        }

        $session->update([
            'started_at' => now(),
            'ended_at' => null,
            'status' => 'running',
        ]);

        return $session->fresh();
    }

    public function stop(WorkSession $session): WorkSession
    {
        if (! in_array($session->status, ['running', 'paused'], true)) {
            throw new RuntimeException('Session ini sudah selesai / tidak aktif.');
        }

        $now = now();

        // Total = akumulasi + segmen yang masih berjalan (kalau stop dari running).
        $total = (int) ($session->duration_seconds ?? 0);
        if ($session->isRunning() && $session->started_at) {
            $total += max(1, (int) $session->started_at->diffInSeconds($now));
        }

        $rounding = ((int) config('app.session_rounding_minutes', 15)) * 60;
        $minBillable = ((int) config('app.session_min_billable_minutes', 15)) * 60;

        $rounded = max($minBillable, (int) ceil($total / $rounding) * $rounding);

        $session->update([
            'ended_at' => $now,
            'duration_seconds' => $rounded,
            'status' => 'completed',
        ]);

        return $session->fresh();
    }

    public function cancel(WorkSession $session): void
    {
        if (! $session->isActive()) {
            throw new RuntimeException('Hanya session aktif (running/paused) yang bisa di-cancel.');
        }

        $session->delete();
    }

    /**
     * Auto-flag session running yg kelamaan (>stale_hours) jadi cancelled.
     * Paused sengaja TIDAK di-clean (bisa legit multi-hari). Return jumlah yg di-flag.
     */
    public function cleanupStale(): int
    {
        $staleHours = (int) config('app.session_stale_hours', 24);

        return WorkSession::where('status', 'running')
            ->where('started_at', '<', now()->subHours($staleHours))
            ->update([
                'status' => 'cancelled',
                'ended_at' => now(),
                'duration_seconds' => 0,
            ]);
    }
}
