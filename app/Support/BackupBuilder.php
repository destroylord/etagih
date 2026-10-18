<?php

namespace App\Support;

use FilesystemIterator;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use PDO;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;
use ZipArchive;

/**
 * Membuat arsip backup .zip: database + file upload + README cara restore.
 *
 * - MariaDB/MySQL: dump SQL murni PHP (SHOW CREATE TABLE + INSERT per potongan,
 *   escape lewat PDO::quote) — tidak butuh mysqldump di server.
 * - SQLite: salinan file database yang konsisten (VACUUM INTO).
 * - Data tabel cache/sesi/antrean tidak ikut (strukturnya tetap ikut).
 *
 * File sementara ditulis ke disk supaya tabel besar tidak dimuat ke memori.
 */
class BackupBuilder
{
    /** Tabel yang hanya diambil strukturnya (datanya sementara / bisa dibuat ulang). */
    public const SKIP_DATA_TABLES = ['cache', 'cache_locks', 'sessions', 'jobs', 'job_batches'];

    private const CHUNK = 500;

    private const ROWS_PER_INSERT = 100;

    /** @var list<string> */
    private array $tempFiles = [];

    /** @var list<string> */
    private array $notes = [];

    public function __construct(private readonly ?Connection $connection = null) {}

    public static function filename(): string
    {
        return 'etagih-backup-'.now()->format('Ymd-His').'.zip';
    }

    /**
     * Buat file zip dan kembalikan path-nya (pemanggil bertanggung jawab menghapus).
     */
    public function build(): string
    {
        $zipPath = $this->tempPath('zip');
        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Tidak bisa membuat file zip backup.');
        }

        try {
            $databaseEntry = $this->addDatabase($zip);
            $uploads = $this->addUploads($zip);
            $zip->addFromString('README.txt', $this->readme($databaseEntry, $uploads));
            $zip->close();
        } finally {
            foreach ($this->tempFiles as $file) {
                @unlink($file);
            }
            $this->tempFiles = [];
        }

        return $zipPath;
    }

    private function db(): Connection
    {
        return $this->connection ?? DB::connection();
    }

    /** @return string|null nama entri database di dalam zip */
    private function addDatabase(ZipArchive $zip): ?string
    {
        $driver = $this->db()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $zip->addFile($this->dumpMysql(), 'database.sql');

            return 'database.sql';
        }

        if ($driver === 'sqlite') {
            $zip->addFile($this->copySqlite(), 'database.sqlite');

            return 'database.sqlite';
        }

        $this->notes[] = "Database {$driver} tidak didukung oleh backup dari aplikasi; gunakan alat bawaan database (mis. pg_dump).";

        return null;
    }

    private function dumpMysql(): string
    {
        $path = $this->tempPath('sql');
        $out = fopen($path, 'wb');
        if ($out === false) {
            throw new RuntimeException('Tidak bisa menulis file dump sementara.');
        }

        $db = $this->db();
        $pdo = $db->getPdo();
        $prefix = $db->getTablePrefix();

        fwrite($out, '-- Backup eTagih '.config('app.version').' — '.now()->toDateTimeString()."\n");
        fwrite($out, '-- Database: '.$db->getDatabaseName()."\n\n");
        fwrite($out, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n");

        $tables = array_map(
            fn (object $row): string => (string) array_values((array) $row)[0],
            $db->select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"),
        );

        foreach ($tables as $table) {
            $quoted = $this->quoteIdent($table);
            $create = (array) $db->selectOne("SHOW CREATE TABLE {$quoted}");
            $createSql = (string) ($create['Create Table'] ?? array_values($create)[1] ?? '');

            fwrite($out, "-- Tabel {$table}\nDROP TABLE IF EXISTS {$quoted};\n{$createSql};\n\n");

            $baseName = $prefix !== '' && str_starts_with($table, $prefix) ? substr($table, strlen($prefix)) : $table;
            if (in_array($baseName, self::SKIP_DATA_TABLES, true)) {
                continue;
            }

            $this->dumpRows($out, $pdo, $table, $baseName);
        }

        fwrite($out, "SET FOREIGN_KEY_CHECKS=1;\n");
        fclose($out);

        return $path;
    }

    /**
     * @param  resource  $out
     */
    private function dumpRows($out, PDO $pdo, string $table, string $baseName): void
    {
        $db = $this->db();
        $columns = array_map(
            fn (object $row): string => (string) ((array) $row)['Field'],
            $db->select('SHOW COLUMNS FROM '.$this->quoteIdent($table)),
        );
        if ($columns === []) {
            return;
        }

        $query = $db->table($baseName);
        $rows = in_array('id', $columns, true)
            ? $query->lazyById(self::CHUNK)
            : $query->orderBy($columns[0])->lazy(self::CHUNK);

        $header = 'INSERT INTO '.$this->quoteIdent($table).' ('.implode(', ', array_map($this->quoteIdent(...), $columns)).') VALUES';
        $buffer = [];

        foreach ($rows as $row) {
            $values = [];
            foreach ((array) $row as $value) {
                $values[] = match (true) {
                    $value === null => 'NULL',
                    is_bool($value) => $value ? '1' : '0',
                    is_int($value) || is_float($value) => (string) $value,
                    default => $pdo->quote((string) $value),
                };
            }
            $buffer[] = '('.implode(', ', $values).')';

            if (count($buffer) >= self::ROWS_PER_INSERT) {
                fwrite($out, $header."\n".implode(",\n", $buffer).";\n");
                $buffer = [];
            }
        }

        if ($buffer !== []) {
            fwrite($out, $header."\n".implode(",\n", $buffer).";\n");
        }
        fwrite($out, "\n");
    }

    private function copySqlite(): string
    {
        $path = $this->tempPath('sqlite');
        @unlink($path);

        $pdo = $this->db()->getPdo();

        if ($pdo->inTransaction()) {
            // VACUUM tidak boleh di dalam transaksi (mis. saat testing) → salin per tabel.
            $this->cloneSqlite($pdo, $path);

            return $path;
        }

        // VACUUM INTO menghasilkan salinan konsisten (juga untuk database :memory:).
        $pdo->exec('VACUUM INTO '.$pdo->quote($path));

        $copy = new PDO('sqlite:'.$path);
        $prefix = $this->db()->getTablePrefix();
        foreach (self::SKIP_DATA_TABLES as $table) {
            $name = $prefix.$table;
            $exists = $copy->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ".$copy->quote($name));
            if ($exists !== false && $exists->fetchColumn() !== false) {
                $copy->exec('DELETE FROM "'.str_replace('"', '""', $name).'"');
            }
        }
        $copy->exec('VACUUM');
        unset($copy);

        return $path;
    }

    /** Salin skema + data SQLite ke file baru, tabel demi tabel (per potongan). */
    private function cloneSqlite(PDO $source, string $path): void
    {
        $copy = new PDO('sqlite:'.$path);
        $copy->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $copy->beginTransaction();

        $prefix = $this->db()->getTablePrefix();
        $tables = $source->query("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL");

        foreach ($tables !== false ? $tables->fetchAll(PDO::FETCH_ASSOC) : [] as $table) {
            $name = (string) $table['name'];
            $copy->exec((string) $table['sql']);

            $baseName = $prefix !== '' && str_starts_with($name, $prefix) ? substr($name, strlen($prefix)) : $name;
            if (in_array($baseName, self::SKIP_DATA_TABLES, true)) {
                continue;
            }

            $quoted = '"'.str_replace('"', '""', $name).'"';
            $offset = 0;
            do {
                $rows = $source->query("SELECT * FROM {$quoted} LIMIT ".self::CHUNK.' OFFSET '.$offset);
                $rows = $rows !== false ? $rows->fetchAll(PDO::FETCH_ASSOC) : [];
                foreach ($rows as $row) {
                    $columns = implode(', ', array_map(fn (int|string $c): string => '"'.str_replace('"', '""', (string) $c).'"', array_keys($row)));
                    $insert = $copy->prepare("INSERT INTO {$quoted} ({$columns}) VALUES (".implode(', ', array_fill(0, count($row), '?')).')');
                    $insert->execute(array_values($row));
                }
                $offset += self::CHUNK;
            } while (count($rows) === self::CHUNK);
        }

        $indexes = $source->query("SELECT sql FROM sqlite_master WHERE type IN ('index', 'trigger', 'view') AND sql IS NOT NULL");
        foreach ($indexes !== false ? $indexes->fetchAll(PDO::FETCH_COLUMN) : [] as $sql) {
            $copy->exec((string) $sql);
        }

        $copy->commit();
    }

    private function addUploads(ZipArchive $zip): int
    {
        $root = storage_path('app/public');
        if (! is_dir($root)) {
            return 0;
        }

        $count = 0;
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        );

        /** @var SplFileInfo $file */
        foreach ($files as $file) {
            if (! $file->isFile() || $file->getFilename() === '.gitignore') {
                continue;
            }
            $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
            $zip->addFile($file->getPathname(), 'uploads/'.$relative);
            $count++;
        }

        return $count;
    }

    private function readme(?string $databaseEntry, int $uploads): string
    {
        $version = (string) config('app.version');
        $date = now()->format('d M Y H:i').' ('.config('app.timezone').')';
        $notes = $this->notes === [] ? '' : "\nCATATAN\n- ".implode("\n- ", $this->notes)."\n";

        $dbRestore = match ($databaseEntry) {
            'database.sql' => <<<'TXT'
   Docker:
     docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < database.sql
   Manual:
     mysql -u USER -p NAMA_DATABASE < database.sql
TXT,
            'database.sqlite' => <<<'TXT'
   Hentikan aplikasi, lalu salin database.sqlite ke lokasi DB_DATABASE
   (default: database/database.sqlite).
TXT,
            default => '   (database tidak termasuk dalam arsip ini)',
        };

        return <<<TXT
BACKUP eTagih
=============
Versi aplikasi : {$version}
Dibuat         : {$date}
Isi            : {$databaseEntry} · uploads/ ({$uploads} file) · README.txt

Data tabel cache, sessions, dan jobs tidak disertakan (hanya strukturnya).
File .env TIDAK termasuk — simpan terpisah. Tanpa APP_KEY yang sama, data
terenkripsi (mis. 2FA) tidak bisa dibuka.
{$notes}
CARA RESTORE
------------
1. Pasang eTagih versi yang sama ({$version}) atau lebih baru, dengan .env lama
   (APP_KEY sama). Jangan login/membuat user dulu.

2. Pulihkan database (menimpa isi database tujuan):
{$dbRestore}

3. Pulihkan file upload (logo, tanda tangan, gambar QRIS):
   Docker:
     docker compose cp uploads/. app:/var/www/html/storage/app/public/
     docker compose exec app chown -R www-data:www-data storage/app/public
   Manual:
     cp -r uploads/. /path/etagih/storage/app/public/
     php artisan storage:link

4. Jalankan migrasi (bila versi baru) lalu bersihkan cache:
     php artisan migrate --force
     php artisan optimize:clear && php artisan optimize

5. Login dan cek Pengaturan → Status sistem.

Panduan lengkap: lihat dokumentasi eTagih → Operasional → Backup & restore.
TXT;
    }

    private function quoteIdent(string $name): string
    {
        return '`'.str_replace('`', '``', $name).'`';
    }

    private function tempPath(string $extension): string
    {
        $base = tempnam(sys_get_temp_dir(), 'etagih');
        if ($base === false) {
            throw new RuntimeException('Tidak bisa membuat file sementara.');
        }
        @unlink($base);
        $path = $base.'.'.$extension;

        if ($extension !== 'zip') {
            $this->tempFiles[] = $path;
        }

        return $path;
    }
}
