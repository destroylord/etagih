<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Cek versi terbaru eTagih dari GitHub Releases.
 *
 * - Hasil di-cache 12 jam; `cached()` tidak pernah memanggil GitHub (aman dipakai tiap request).
 * - `refresh()` dipanggil scheduler (harian) dan saat membuka halaman Status sistem.
 * - Tidak pernah melempar exception: kegagalan = status "unknown".
 * - Nonaktif bila ETAGIH_UPDATE_CHECK=false atau versi aplikasi "dev".
 *
 * @phpstan-type UpdateInfo array{
 *     status: 'disabled'|'unknown'|'up_to_date'|'available',
 *     current: string,
 *     latest: string|null,
 *     url: string|null,
 *     published_at: string|null,
 *     checked_at: string|null,
 *     error: string|null
 * }
 */
class UpdateChecker
{
    public const CACHE_KEY = 'etagih:update-check';

    public const TTL_HOURS = 12;

    public function enabled(): bool
    {
        return (bool) config('app.update_check')
            && $this->currentVersion() !== 'dev'
            && $this->repo() !== '';
    }

    public function currentVersion(): string
    {
        return trim((string) config('app.version')) ?: 'dev';
    }

    public function repo(): string
    {
        return trim((string) config('app.update_repo'), " /\t\n");
    }

    /**
     * Hasil terakhir dari cache (tanpa HTTP). Null bila belum pernah dicek.
     *
     * @return UpdateInfo|null
     */
    public function cached(): ?array
    {
        if (! $this->enabled()) {
            return $this->result('disabled');
        }

        $cached = Cache::get(self::CACHE_KEY);
        if (! is_array($cached) || ($cached['current'] ?? null) !== $this->currentVersion()) {
            return null;
        }

        /** @var UpdateInfo $cached */
        return $cached;
    }

    /**
     * Ambil dari cache; bila kosong / kedaluwarsa, cek ke GitHub.
     *
     * @return UpdateInfo
     */
    public function check(): array
    {
        return $this->cached() ?? $this->refresh();
    }

    /**
     * Paksa cek ke GitHub dan simpan hasilnya.
     *
     * @return UpdateInfo
     */
    public function refresh(): array
    {
        if (! $this->enabled()) {
            return $this->result('disabled');
        }

        try {
            $response = Http::acceptJson()
                ->withHeaders(['User-Agent' => 'eTagih/'.$this->currentVersion()])
                ->connectTimeout(3)
                ->timeout(5)
                ->get("https://api.github.com/repos/{$this->repo()}/releases/latest");

            if (! $response->successful()) {
                return $this->remember($this->result('unknown', error: 'GitHub merespons HTTP '.$response->status().'.'));
            }

            $tag = $response->json('tag_name');
            if (! is_string($tag) || self::normalize($tag) === null) {
                return $this->remember($this->result('unknown', error: 'Format versi rilis tidak dikenali.'));
            }

            $latest = ltrim($tag, 'vV');
            $status = self::isNewer($latest, $this->currentVersion()) ? 'available' : 'up_to_date';

            return $this->remember($this->result(
                $status,
                latest: $latest,
                url: is_string($response->json('html_url')) ? $response->json('html_url') : null,
                publishedAt: is_string($response->json('published_at')) ? $response->json('published_at') : null,
            ));
        } catch (Throwable $e) {
            Log::info('Update check failed', ['error' => $e->getMessage()]);

            return $this->remember($this->result('unknown', error: 'Tidak bisa menghubungi GitHub.'));
        }
    }

    /**
     * Info ringkas untuk banner dashboard (hanya dari cache). Null bila tidak ada update.
     *
     * @return array{current: string, latest: string, url: string|null}|null
     */
    public function availableFromCache(): ?array
    {
        $info = $this->cached();
        if ($info === null || $info['status'] !== 'available' || $info['latest'] === null) {
            return null;
        }

        return ['current' => $info['current'], 'latest' => $info['latest'], 'url' => $info['url']];
    }

    /** true bila $candidate (semver) lebih baru dari $current. Versi tak valid → false. */
    public static function isNewer(string $candidate, string $current): bool
    {
        $a = self::normalize($candidate);
        $b = self::normalize($current);
        if ($a === null || $b === null) {
            return false;
        }

        $cmp = version_compare($a['core'], $b['core']);
        if ($cmp !== 0) {
            return $cmp > 0;
        }

        // Inti sama: rilis final lebih baru daripada pre-release (1.2.0 > 1.2.0-beta.1).
        if ($a['pre'] === '' || $b['pre'] === '') {
            return $a['pre'] === '' && $b['pre'] !== '';
        }

        // alpha < beta < rc, beta.1 < beta.2 (aturan version_compare PHP).
        return version_compare($a['pre'], $b['pre']) > 0;
    }

    /**
     * @return array{core: string, pre: string}|null
     */
    private static function normalize(string $version): ?array
    {
        $version = ltrim(trim($version), 'vV');
        if (! preg_match('/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/', $version, $m)) {
            return null;
        }

        return [
            'core' => ((int) $m[1]).'.'.((int) ($m[2] ?? 0)).'.'.((int) ($m[3] ?? 0)),
            'pre' => $m[4] ?? '',
        ];
    }

    /**
     * @param  UpdateInfo  $info
     * @return UpdateInfo
     */
    private function remember(array $info): array
    {
        // Kegagalan di-cache lebih singkat supaya cepat dicoba lagi.
        $ttl = $info['status'] === 'unknown' ? now()->addHour() : now()->addHours(self::TTL_HOURS);
        Cache::put(self::CACHE_KEY, $info, $ttl);

        return $info;
    }

    /**
     * @param  'disabled'|'unknown'|'up_to_date'|'available'  $status
     * @return UpdateInfo
     */
    private function result(string $status, ?string $latest = null, ?string $url = null, ?string $publishedAt = null, ?string $error = null): array
    {
        return [
            'status' => $status,
            'current' => $this->currentVersion(),
            'latest' => $latest,
            'url' => $url ?? ($this->repo() !== '' ? "https://github.com/{$this->repo()}/releases" : null),
            'published_at' => $publishedAt,
            'checked_at' => $status === 'disabled' ? null : now()->toIso8601String(),
            'error' => $error,
        ];
    }
}
