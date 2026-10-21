<?php

namespace App\Support;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tunggal aturan visibilitas data per pengguna.
 *
 * - Pemilik & admin: tidak dibatasi (semua metode mengembalikan `null` = semua).
 * - Staf: hanya proyek utama tempat ia menjadi anggota (`project_members`)
 *   beserta sub-proyeknya, dan klien dari proyek-proyek tersebut. Invoice &
 *   penawaran terlihat bila kliennya terlihat. Staf tanpa keanggotaan sama
 *   sekali tidak melihat klien/proyek/invoice/penawaran/tugas apa pun.
 *
 * Catatan upgrade: migrasi `create_project_members_table` menjadikan semua staf
 * yang sudah ada sebagai anggota semua proyek utama yang ada, supaya tim lama
 * tidak kehilangan akses. Admin bisa merapikan keanggotaan setelahnya.
 *
 * Hasil tidak di-cache (query ringan) supaya perubahan keanggotaan langsung berlaku.
 */
class Access
{
    /** Akses staf dibatasi keanggotaan proyek. */
    public static function isRestricted(?User $user): bool
    {
        return $user !== null && ! $user->isAdmin();
    }

    /**
     * ID proyek utama tempat pengguna menjadi anggota.
     *
     * @return list<int>
     */
    public static function memberRootIds(User $user): array
    {
        return array_values(DB::table('project_members')
            ->where('user_id', $user->id)
            ->pluck('project_id')
            ->map(fn ($id) => (int) $id)
            ->all());
    }

    /**
     * ID proyek (utama + sub-proyek) yang terlihat. `null` = semua (admin).
     *
     * @return list<int>|null
     */
    public static function projectIds(User $user): ?array
    {
        if (! self::isRestricted($user)) {
            return null;
        }

        $roots = self::memberRootIds($user);
        if ($roots === []) {
            return [];
        }

        return array_values(Project::query()
            ->whereIn('id', $roots)
            ->orWhereIn('parent_id', $roots)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all());
    }

    /**
     * ID klien yang terlihat. `null` = semua (admin).
     *
     * @return list<int>|null
     */
    public static function clientIds(User $user): ?array
    {
        if (! self::isRestricted($user)) {
            return null;
        }

        $roots = self::memberRootIds($user);
        if ($roots === []) {
            return [];
        }

        return array_values(Project::query()
            ->whereIn('id', $roots)
            ->distinct()
            ->pluck('client_id')
            ->map(fn ($id) => (int) $id)
            ->all());
    }

    public static function canSeeClient(User $user, ?int $clientId): bool
    {
        $ids = self::clientIds($user);

        return $ids === null || ($clientId !== null && in_array($clientId, $ids, true));
    }

    public static function canSeeProject(User $user, Project|int|null $project): bool
    {
        if (! self::isRestricted($user)) {
            return true;
        }
        if ($project === null) {
            return false;
        }

        $project = $project instanceof Project ? $project : Project::query()->find($project);
        if (! $project instanceof Project) {
            return false;
        }

        $rootId = $project->parent_id ?? $project->id;

        return DB::table('project_members')
            ->where('user_id', $user->id)
            ->where('project_id', $rootId)
            ->exists();
    }

    /**
     * Pengguna boleh mengerjakan / ditugaskan di proyek: admin aktif, atau
     * anggota proyek utamanya.
     */
    public static function userCanWorkOn(User $user, Project $project): bool
    {
        if (! $user->is_active) {
            return false;
        }

        return self::canSeeProject($user, $project);
    }

    /**
     * Pengguna aktif yang bisa ditugaskan di proyek tertentu (admin + anggota proyek utama).
     *
     * @return list<int>
     */
    public static function assignableUserIds(Project $project): array
    {
        $rootId = $project->parent_id ?? $project->id;

        return array_values(User::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereIn('role', ['owner', 'admin'])
                ->orWhereIn('id', DB::table('project_members')->where('project_id', $rootId)->select('user_id')))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all());
    }
}
