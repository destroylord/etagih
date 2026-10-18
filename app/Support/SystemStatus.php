<?php

namespace App\Support;

use App\Models\QrisAccount;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Kumpulan pemeriksaan kesehatan instalasi untuk halaman Pengaturan → Status sistem.
 *
 * Setiap pemeriksaan: status ok|warning|error|info, nilai singkat, penjelasan,
 * cara memperbaiki, dan tautan dokumentasi.
 *
 * @phpstan-type Check array{
 *     key: string,
 *     group: string,
 *     label: string,
 *     status: 'ok'|'warning'|'error'|'info',
 *     value: string,
 *     message: string,
 *     fix: string|null,
 *     docs: string|null
 * }
 */
class SystemStatus
{
    public const SCHEDULER_HEARTBEAT_KEY = 'etagih:heartbeat:scheduler';

    public const QUEUE_HEARTBEAT_KEY = 'etagih:heartbeat:queue';

    public const SCHEDULER_MAX_AGE_MINUTES = 3;

    public const QUEUE_MAX_AGE_MINUTES = 5;

    public function __construct(private readonly UpdateChecker $updates) {}

    /** Dipanggil scheduler tiap menit. */
    public static function touchScheduler(): void
    {
        Cache::put(self::SCHEDULER_HEARTBEAT_KEY, now()->toIso8601String(), now()->addDay());
    }

    public static function lastHeartbeat(string $key): ?CarbonImmutable
    {
        $value = Cache::get($key);

        try {
            return is_string($value) && $value !== '' ? CarbonImmutable::parse($value) : null;
        } catch (Throwable) {
            return null;
        }
    }

    /** Basis URL dokumentasi (GitHub Pages dari repo update). */
    public static function docsUrl(string $path = ''): string
    {
        [$owner, $repo] = array_pad(explode('/', trim((string) config('app.update_repo'), '/'), 2), 2, 'etagih');

        return 'https://'.strtolower($owner).'.github.io/'.$repo.($path !== '' ? '/'.ltrim($path, '/') : '');
    }

    /**
     * @return list<Check>
     */
    public function checks(): array
    {
        return [
            $this->version(),
            $this->php(),
            $this->environment(),
            $this->appUrl(),
            $this->timezone(),
            $this->database(),
            $this->storage(),
            $this->publicStorage(),
            $this->diskSpace(),
            $this->scheduler(),
            $this->queue(),
            $this->mail(),
            $this->whatsapp(),
            $this->qris(),
        ];
    }

    /**
     * @param  'ok'|'warning'|'error'|'info'  $status
     * @return Check
     */
    private function make(string $key, string $group, string $label, string $status, string $value, string $message, ?string $fix = null, ?string $docs = null): array
    {
        return compact('key', 'group', 'label', 'status', 'value', 'message', 'fix', 'docs');
    }

    /** @return Check */
    private function version(): array
    {
        $info = $this->updates->check();
        $docs = self::docsUrl('penggunaan/operasional#update-ke-versi-baru');

        return match ($info['status']) {
            'available' => $this->make('version', 'Aplikasi', 'Versi eTagih', 'warning', $info['current'],
                "Versi baru {$info['latest']} sudah tersedia.",
                'Backup dulu, baca catatan rilis, lalu update (Docker: docker compose pull && docker compose up -d).', $docs),
            'up_to_date' => $this->make('version', 'Aplikasi', 'Versi eTagih', 'ok', $info['current'],
                'Anda memakai versi terbaru.', null, $docs),
            'disabled' => $this->make('version', 'Aplikasi', 'Versi eTagih', 'info', $info['current'],
                $info['current'] === 'dev' ? 'Versi pengembangan (dev) — cek update dilewati.' : 'Cek update dimatikan (ETAGIH_UPDATE_CHECK=false).',
                null, $docs),
            default => $this->make('version', 'Aplikasi', 'Versi eTagih', 'info', $info['current'],
                'Belum bisa memeriksa versi terbaru. '.($info['error'] ?? ''),
                'Pastikan server bisa mengakses api.github.com dan ETAGIH_UPDATE_REPO benar.', $docs),
        };
    }

    /** @return Check */
    private function php(): array
    {
        $ok = version_compare(PHP_VERSION, '8.4.0', '>=');
        $missing = array_values(array_filter(['zip', 'gd', 'intl', 'bcmath', 'pdo'], fn (string $ext): bool => ! extension_loaded($ext)));

        if (! $ok) {
            return $this->make('php', 'Aplikasi', 'PHP', 'error', PHP_VERSION, 'eTagih membutuhkan PHP 8.4 atau lebih baru.',
                'Upgrade PHP ke 8.4+ (Docker sudah memakai versi yang benar).', self::docsUrl('memulai/instalasi-manual'));
        }

        if ($missing !== []) {
            return $this->make('php', 'Aplikasi', 'PHP', 'warning', PHP_VERSION, 'Ekstensi belum aktif: '.implode(', ', $missing).'.',
                'Pasang ekstensi PHP tersebut (mis. apt install php8.4-zip) lalu restart PHP-FPM.', self::docsUrl('memulai/instalasi-manual'));
        }

        return $this->make('php', 'Aplikasi', 'PHP', 'ok', PHP_VERSION, 'Versi & ekstensi PHP sesuai.');
    }

    /** @return Check */
    private function environment(): array
    {
        $env = (string) config('app.env');
        $debug = (bool) config('app.debug');
        $value = "APP_ENV={$env}, APP_DEBUG=".($debug ? 'true' : 'false');
        $docs = self::docsUrl('memulai/konfigurasi#aplikasi');

        if ($env === 'production' && $debug) {
            return $this->make('env', 'Aplikasi', 'Mode aplikasi', 'error', $value,
                'Mode debug aktif di produksi: detail error (termasuk konfigurasi) bisa terlihat oleh pengunjung.',
                'Ubah APP_DEBUG=false di .env lalu muat ulang konfigurasi.', $docs);
        }

        if ($env !== 'production') {
            return $this->make('env', 'Aplikasi', 'Mode aplikasi', 'warning', $value,
                'Bukan mode produksi: halaman bayar menampilkan tombol simulasi pembayaran.',
                'Untuk server sungguhan, set APP_ENV=production dan APP_DEBUG=false.', $docs);
        }

        return $this->make('env', 'Aplikasi', 'Mode aplikasi', 'ok', $value, 'Mode produksi, debug nonaktif.');
    }

    /** @return Check */
    private function appUrl(): array
    {
        $url = (string) config('app.url');
        $docs = self::docsUrl('memulai/konfigurasi#aplikasi');
        $host = (string) parse_url($url, PHP_URL_HOST);
        $local = in_array($host, ['localhost', '127.0.0.1'], true) || str_ends_with($host, '.test');

        if (! str_starts_with($url, 'https://')) {
            return $this->make('app_url', 'Aplikasi', 'APP_URL', $local ? 'info' : 'warning', $url ?: '(kosong)',
                'Link bayar di WhatsApp/email/PDF memakai APP_URL. Tanpa HTTPS, browser klien bisa menampilkan peringatan.',
                'Isi APP_URL dengan https://domain-anda (sama persis dengan domain yang dibuka klien).', $docs);
        }

        $requestHost = request()->getHost();
        if ($requestHost !== '' && $host !== '' && strcasecmp($requestHost, $host) !== 0) {
            return $this->make('app_url', 'Aplikasi', 'APP_URL', 'warning', $url,
                "Domain yang sedang dibuka ({$requestHost}) berbeda dengan APP_URL.",
                'Samakan APP_URL dengan domain publik agar link di pesan & PDF benar.', $docs);
        }

        return $this->make('app_url', 'Aplikasi', 'APP_URL', 'ok', $url, 'Memakai HTTPS.');
    }

    /** @return Check */
    private function timezone(): array
    {
        $tz = (string) config('app.timezone');
        $value = $tz.' ('.now()->format('d M Y H:i').')';

        if (strtoupper($tz) === 'UTC') {
            return $this->make('timezone', 'Aplikasi', 'Zona waktu', 'warning', $value,
                'Zona waktu UTC: tanggal & nomor invoice bisa bergeser 7 jam dari waktu Indonesia.',
                'Set APP_TIMEZONE=Asia/Jakarta (atau Asia/Makassar / Asia/Jayapura) sejak awal pemakaian.', self::docsUrl('memulai/konfigurasi#aplikasi'));
        }

        return $this->make('timezone', 'Aplikasi', 'Zona waktu', 'ok', $value, 'Zona waktu sudah diatur.');
    }

    /** @return Check */
    private function database(): array
    {
        try {
            $connection = DB::connection();
            $connection->select('select 1');
            $driver = $connection->getDriverName();
            $version = $connection->getPdo()->getAttribute(\PDO::ATTR_SERVER_VERSION);

            return $this->make('database', 'Server', 'Database', 'ok', $driver.' '.(is_string($version) ? $version : ''), 'Koneksi database berhasil.');
        } catch (Throwable $e) {
            return $this->make('database', 'Server', 'Database', 'error', 'Gagal terhubung', $e->getMessage(),
                'Periksa DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD di .env.', self::docsUrl('memulai/konfigurasi#database-sesi-antrean'));
        }
    }

    /** @return Check */
    private function storage(): array
    {
        $paths = [
            storage_path('app/public'),
            storage_path('framework/cache'),
            storage_path('framework/views'),
            storage_path('logs'),
        ];
        $notWritable = array_values(array_filter($paths, fn (string $p): bool => ! is_dir($p) || ! is_writable($p)));

        if ($notWritable !== []) {
            return $this->make('storage', 'Server', 'Folder storage', 'error', 'Tidak bisa ditulis',
                'Folder berikut tidak bisa ditulis: '.implode(', ', array_map(fn (string $p): string => str_replace(base_path().DIRECTORY_SEPARATOR, '', $p), $notWritable)).'.',
                'Beri izin tulis ke user web server: sudo chown -R www-data:www-data storage bootstrap/cache.', self::docsUrl('memulai/instalasi-manual'));
        }

        return $this->make('storage', 'Server', 'Folder storage', 'ok', 'Bisa ditulis', 'Upload, cache, dan log bisa disimpan.');
    }

    /** @return Check */
    private function publicStorage(): array
    {
        $docker = getenv('CONTAINER_ROLE') !== false;
        $link = public_path('storage');

        if ($docker) {
            return $this->make('public_storage', 'Server', 'File publik (logo, QRIS)', 'ok', 'Docker',
                'Di Docker, Caddy menyajikan /storage langsung dari volume storage.');
        }

        if (is_dir($link) || is_link($link)) {
            return $this->make('public_storage', 'Server', 'File publik (logo, QRIS)', 'ok', 'public/storage terpasang',
                'Logo, tanda tangan, dan gambar QRIS bisa diakses browser.');
        }

        return $this->make('public_storage', 'Server', 'File publik (logo, QRIS)', 'warning', 'public/storage belum ada',
            'Logo, tanda tangan, dan gambar QRIS yang di-upload tidak akan tampil.',
            'Jalankan: php artisan storage:link', self::docsUrl('penggunaan/operasional#troubleshooting'));
    }

    /** @return Check */
    private function diskSpace(): array
    {
        $free = @disk_free_space(storage_path());
        if ($free === false) {
            return $this->make('disk', 'Server', 'Ruang disk', 'info', 'Tidak diketahui', 'Sisa ruang disk tidak bisa dibaca.');
        }

        $value = number_format($free / 1024 / 1024 / 1024, 1, ',', '.').' GB tersisa';
        $fix = 'Hapus image Docker lama (docker image prune -f), log lama, atau backup lama; atau tambah disk.';

        return match (true) {
            $free < 200 * 1024 * 1024 => $this->make('disk', 'Server', 'Ruang disk', 'error', $value, 'Ruang disk hampir habis; database & upload bisa gagal.', $fix),
            $free < 1024 * 1024 * 1024 => $this->make('disk', 'Server', 'Ruang disk', 'warning', $value, 'Ruang disk tinggal sedikit.', $fix),
            default => $this->make('disk', 'Server', 'Ruang disk', 'ok', $value, 'Ruang disk cukup.'),
        };
    }

    /** @return Check */
    private function scheduler(): array
    {
        $last = self::lastHeartbeat(self::SCHEDULER_HEARTBEAT_KEY);
        $docs = self::docsUrl('penggunaan/operasional#komponen-yang-harus-berjalan');
        $fix = 'Docker: pastikan container scheduler berjalan (docker compose ps). Manual: tambahkan cron "* * * * * php artisan schedule:run".';

        if ($last === null) {
            return $this->make('scheduler', 'Proses latar', 'Scheduler', 'error', 'Belum pernah berjalan',
                'Tanpa scheduler: status terlambat, pengingat, dan invoice berulang tidak jalan.', $fix, $docs);
        }

        if ($last->lt(now()->subMinutes(self::SCHEDULER_MAX_AGE_MINUTES))) {
            return $this->make('scheduler', 'Proses latar', 'Scheduler', 'warning', 'Terakhir '.$last->diffForHumans(),
                'Scheduler tidak berjalan dalam beberapa menit terakhir.', $fix, $docs);
        }

        return $this->make('scheduler', 'Proses latar', 'Scheduler', 'ok', 'Aktif ('.$last->diffForHumans().')', 'Tugas terjadwal berjalan normal.');
    }

    /** @return Check */
    private function queue(): array
    {
        $connection = (string) config('queue.default');
        $failed = $this->failedJobs();
        $failedNote = $failed > 0 ? " Ada {$failed} job gagal (php artisan queue:failed, lalu queue:retry all)." : '';
        $docs = self::docsUrl('penggunaan/operasional#komponen-yang-harus-berjalan');

        if ($connection === 'sync') {
            return $this->make('queue', 'Proses latar', 'Queue worker', $failed > 0 ? 'warning' : 'info', 'sync',
                'QUEUE_CONNECTION=sync: job dijalankan langsung tanpa worker (lebih lambat saat konfirmasi pembayaran).'.$failedNote,
                null, $docs);
        }

        $last = self::lastHeartbeat(self::QUEUE_HEARTBEAT_KEY);
        $fix = 'Docker: pastikan container worker berjalan (docker compose ps). Manual: jalankan php artisan queue:work lewat Supervisor/systemd.';

        if ($last === null || $last->lt(now()->subMinutes(self::QUEUE_MAX_AGE_MINUTES))) {
            return $this->make('queue', 'Proses latar', 'Queue worker', 'error',
                $last === null ? 'Belum pernah berjalan' : 'Terakhir '.$last->diffForHumans(),
                'Worker tidak memproses job: WA konfirmasi pembayaran tidak terkirim. (Pemeriksaan ini butuh scheduler aktif.)'.$failedNote,
                $fix, $docs);
        }

        if ($failed > 0) {
            return $this->make('queue', 'Proses latar', 'Queue worker', 'warning', 'Aktif ('.$last->diffForHumans().')',
                'Worker berjalan.'.$failedNote, 'Lihat penyebabnya di log, lalu jalankan php artisan queue:retry all.', $docs);
        }

        return $this->make('queue', 'Proses latar', 'Queue worker', 'ok', 'Aktif ('.$last->diffForHumans().')', 'Worker berjalan, tidak ada job gagal.');
    }

    private function failedJobs(): int
    {
        try {
            $table = (string) config('queue.failed.table', 'failed_jobs');

            return Schema::hasTable($table) ? DB::table($table)->count() : 0;
        } catch (Throwable) {
            return 0;
        }
    }

    /** @return Check */
    private function mail(): array
    {
        $mailer = (string) config('mail.default');
        $docs = self::docsUrl('memulai/konfigurasi#email');

        if (in_array($mailer, ['log', 'array'], true)) {
            return $this->make('mail', 'Integrasi', 'Email', 'warning', "MAIL_MAILER={$mailer}",
                'Email invoice tidak benar-benar dikirim (hanya ditulis ke log).',
                'Isi MAIL_MAILER=smtp beserta MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS.', $docs);
        }

        return $this->make('mail', 'Integrasi', 'Email', 'ok', "MAIL_MAILER={$mailer}",
            'Email dikonfigurasi. Gunakan "Kirim email uji" untuk memastikan kredensial benar.', null, $docs);
    }

    /** @return Check */
    private function whatsapp(): array
    {
        $docs = self::docsUrl('penggunaan/integrasi');

        if (blank(config('services.wa.api_key'))) {
            return $this->make('whatsapp', 'Integrasi', 'WhatsApp (Fonnte)', 'warning', 'WA_API_KEY kosong',
                'Notifikasi invoice, konfirmasi bayar, dan pengingat via WhatsApp tidak akan terkirim.',
                'Isi WA_API_KEY dengan token device dari dashboard Fonnte.', $docs);
        }

        return $this->make('whatsapp', 'Integrasi', 'WhatsApp (Fonnte)', 'ok', 'Terkonfigurasi',
            'Gunakan "Kirim WA uji" untuk memastikan device Fonnte terhubung.', null, $docs);
    }

    /** @return Check */
    private function qris(): array
    {
        $docs = self::docsUrl('penggunaan/integrasi');
        $mode = config('services.qrisly.is_production') ? 'produksi' : 'sandbox';

        if (blank(config('services.qrisly.api_key'))) {
            return $this->make('qris', 'Integrasi', 'Pembayaran QRIS (QRISLY)', 'warning', 'QRISLY_API_KEY kosong',
                'Klien belum bisa membayar lewat QRIS di halaman bayar.',
                'Isi QRISLY_API_KEY dari dashboard Collaborator → Developer → API Settings.', $docs);
        }

        $active = null;
        try {
            $active = QrisAccount::active();
        } catch (Throwable) {
            // Tabel belum ada — anggap belum ada QRIS aktif.
        }

        if ($active === null && blank(config('services.qrisly.merchant_id'))) {
            return $this->make('qris', 'Integrasi', 'Pembayaran QRIS (QRISLY)', 'warning', "API key ada ({$mode})",
                'Belum ada QRIS aktif, jadi tombol Bayar QRIS akan gagal.',
                'Upload QRIS toko di Pengaturan → Invoice → QRIS (atau isi QRISLY_MERCHANT_ID).', $docs);
        }

        if ($mode === 'sandbox') {
            return $this->make('qris', 'Integrasi', 'Pembayaran QRIS (QRISLY)', 'warning', 'Sandbox',
                'QRIS siap, tetapi masih mode sandbox: pembayaran bukan uang sungguhan.',
                'Setelah uji coba berhasil, set QRISLY_IS_PRODUCTION=true.', $docs);
        }

        return $this->make('qris', 'Integrasi', 'Pembayaran QRIS (QRISLY)', 'ok', 'Produksi', 'QRIS aktif dan siap menerima pembayaran.');
    }
}
