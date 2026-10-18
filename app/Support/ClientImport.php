<?php

namespace App\Support;

use App\Models\Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

/**
 * Logika import klien dari spreadsheet: pemetaan header, normalisasi nilai,
 * validasi per baris, deteksi duplikat (di dalam file & terhadap klien yang
 * sudah ada), serta penerapan hasilnya ke database.
 *
 * Aturan "klien yang sama" (berurutan):
 *   1. email sama (tanpa membedakan huruf besar/kecil), lalu
 *   2. nomor telepon sama (08… dan 62… dianggap sama), lalu
 *   3. nama persis sama (tanpa membedakan huruf besar/kecil),
 * dengan syarat untuk langkah 2–3: email keduanya tidak saling bertentangan.
 *
 * @phpstan-type ImportValues array{name: ?string, email: ?string, phone: ?string, address: ?string, notes: ?string, hourly_rate: ?string}
 * @phpstan-type ImportRow array{line: int, values: ImportValues, errors: array<int, string>}
 * @phpstan-type ClientMatch array{id: int, name: string, by: string}
 * @phpstan-type AnalyzedRow array{line: int, values: ImportValues, errors: array<int, string>, action: string, match: ClientMatch|null}
 */
class ClientImport
{
    public const FIELDS = ['name', 'email', 'phone', 'address', 'notes', 'hourly_rate'];

    /** Header template (urutan kolom). */
    public const TEMPLATE_HEADERS = ['nama', 'email', 'telepon', 'alamat', 'catatan', 'tarif_per_jam'];

    /** @var array<string, array<int, string>> alias header (sudah dinormalisasi) per field */
    private const ALIASES = [
        'name' => ['nama', 'name', 'nama klien', 'client', 'client name', 'nama lengkap', 'full name', 'klien', 'pelanggan', 'nama pelanggan', 'customer', 'customer name'],
        'email' => ['email', 'e mail', 'surel', 'email address', 'alamat email'],
        'phone' => ['telepon', 'phone', 'hp', 'no hp', 'nomor hp', 'whatsapp', 'wa', 'no wa', 'nomor wa', 'nomor whatsapp', 'no whatsapp', 'telp', 'tel', 'no telp', 'no telepon', 'nomor telepon', 'handphone', 'phone number', 'mobile', 'ponsel'],
        'address' => ['alamat', 'address'],
        'notes' => ['catatan', 'notes', 'note', 'keterangan', 'memo'],
        'hourly_rate' => ['tarif', 'tarif per jam', 'tarif jam', 'hourly rate', 'rate', 'harga per jam', 'rate per hour'],
    ];

    /** @var array<string, array<int, mixed>> sama dengan ClientController */
    private const RULES = [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['nullable', 'email', 'max:255'],
        'phone' => ['nullable', 'string', 'max:64'],
        'address' => ['nullable', 'string', 'max:500'],
        'notes' => ['nullable', 'string', 'max:1000'],
        'hourly_rate' => ['nullable', 'numeric', 'min:0'],
    ];

    private const LABELS = [
        'name' => 'nama',
        'email' => 'email',
        'phone' => 'telepon',
        'address' => 'alamat',
        'notes' => 'catatan',
        'hourly_rate' => 'tarif per jam',
    ];

    /**
     * Ubah baris mentah spreadsheet (baris pertama = header) menjadi baris import.
     *
     * @param  array<int, array<int, string|int|float|null>>  $raw
     * @return array{rows: array<int, ImportRow>, columns: array<string, string>, ignored: array<int, string>}
     */
    public function parse(array $raw): array
    {
        if ($raw === []) {
            throw new RuntimeException('File kosong. Isi minimal satu baris header dan satu baris data.');
        }

        $headerLine = array_key_first($raw);
        $header = $raw[$headerLine];
        unset($raw[$headerLine]);

        $map = [];      // index kolom → field
        $columns = [];  // field → label header asli
        $ignored = [];
        foreach ($header as $i => $label) {
            $label = trim((string) $label);
            if ($label === '') {
                continue;
            }
            $field = self::fieldForHeader($label);
            if ($field === null || isset($columns[$field])) {
                $ignored[] = $label;

                continue;
            }
            $map[$i] = $field;
            $columns[$field] = $label;
        }

        if (! isset($columns['name'])) {
            throw new RuntimeException('Kolom "nama" tidak ditemukan di baris pertama. Gunakan template agar header sesuai.');
        }

        if ($raw === []) {
            throw new RuntimeException('File tidak berisi baris data.');
        }

        $rows = [];
        foreach ($raw as $line => $cells) {
            $rows[] = $this->buildRow($line, $cells, $map);
        }

        $this->flagInFileDuplicates($rows);

        return ['rows' => $rows, 'columns' => $columns, 'ignored' => $ignored];
    }

    public static function fieldForHeader(string $label): ?string
    {
        $norm = mb_strtolower($label);
        $norm = (string) preg_replace('/\(.*?\)|\[.*?\]/u', ' ', $norm); // "tarif (Rp)" → "tarif"
        $norm = (string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $norm);
        $norm = trim($norm);

        foreach (self::ALIASES as $field => $aliases) {
            if (in_array($norm, $aliases, true)) {
                return $field;
            }
        }

        return null;
    }

    /**
     * @param  array<int, string|int|float|null>  $cells
     * @param  array<int, string>  $map
     * @return ImportRow
     */
    private function buildRow(int $line, array $cells, array $map): array
    {
        $values = array_fill_keys(self::FIELDS, null);
        $errors = [];

        foreach ($map as $i => $field) {
            $cell = $cells[$i] ?? null;
            if ($cell === null || $cell === '') {
                continue;
            }

            switch ($field) {
                case 'phone':
                    $values['phone'] = self::normalizePhone($cell);
                    break;
                case 'hourly_rate':
                    $rate = self::parseRate($cell);
                    if ($rate === null) {
                        $errors[] = 'Tarif per jam "'.self::text($cell).'" bukan angka yang valid.';
                    } else {
                        $values['hourly_rate'] = $rate;
                    }
                    break;
                case 'email':
                    $values['email'] = mb_strtolower(self::text($cell));
                    break;
                default:
                    $values[$field] = self::text($cell);
            }
        }

        $validator = Validator::make($values, self::RULES, [
            'required' => 'Kolom :attribute wajib diisi.',
            'email' => 'Format :attribute tidak valid.',
            'max' => 'Kolom :attribute maksimal :max karakter.',
            'min' => 'Kolom :attribute tidak boleh negatif.',
            'numeric' => 'Kolom :attribute harus berupa angka.',
        ], self::LABELS);

        foreach ($validator->errors()->all() as $message) {
            $errors[] = $message;
        }

        return [
            'line' => $line,
            'values' => [
                'name' => $values['name'],
                'email' => $values['email'],
                'phone' => $values['phone'],
                'address' => $values['address'],
                'notes' => $values['notes'],
                'hourly_rate' => $values['hourly_rate'],
            ],
            'errors' => array_values(array_unique($errors)),
        ];
    }

    /**
     * Baris yang identitasnya sama dengan baris sebelumnya ditandai error.
     *
     * @param  array<int, ImportRow>  $rows
     */
    private function flagInFileDuplicates(array &$rows): void
    {
        $index = new ClientImportIndex;
        foreach ($rows as $k => $row) {
            if ($row['errors'] !== []) {
                continue;
            }
            $hit = $index->find($row['values']);
            if ($hit !== null) {
                $rows[$k]['errors'][] = 'Duplikat dengan baris '.$hit['id'].' ('.self::matchLabel($hit['by']).' sama).';

                continue;
            }
            $index->add($row['line'], $row['values']);
        }
    }

    /**
     * Tentukan aksi tiap baris terhadap data klien saat ini.
     *
     * @param  array<int, ImportRow>  $rows
     * @return array<int, AnalyzedRow>
     */
    public function analyze(array $rows): array
    {
        $index = ClientImportIndex::fromDatabase();

        return array_map(function (array $row) use ($index) {
            if ($row['errors'] !== []) {
                return $row + ['action' => 'error', 'match' => null];
            }
            $hit = $index->find($row['values']);

            return $row + [
                'action' => $hit ? 'update' : 'create',
                'match' => $hit,
            ];
        }, $rows);
    }

    /**
     * Terapkan import dalam satu transaksi.
     *
     * @param  array<int, ImportRow>  $rows
     * @return array{created: int, updated: int, skipped: int}
     */
    public function apply(array $rows, bool $updateExisting): array
    {
        return DB::transaction(function () use ($rows, $updateExisting) {
            $created = 0;
            $updated = 0;
            $skipped = 0;

            foreach ($this->analyze($rows) as $row) {
                if ($row['action'] === 'error') {
                    $skipped++;

                    continue;
                }

                if ($row['action'] === 'create') {
                    // Kunci akses portal dibuat otomatis oleh model.
                    Client::create($row['values']);
                    $created++;

                    continue;
                }

                $client = $row['match'] !== null ? Client::query()->whereKey($row['match']['id'])->first() : null;
                if (! $updateExisting || $client === null) {
                    $skipped++;

                    continue;
                }

                // Hanya isi kolom yang diisi di file; kolom kosong tidak menghapus data lama.
                $client->fill(array_filter($row['values'], fn ($v) => $v !== null));
                if ($client->isDirty()) {
                    $client->save();
                    $updated++;
                } else {
                    $skipped++;
                }
            }

            return ['created' => $created, 'updated' => $updated, 'skipped' => $skipped];
        });
    }

    public static function matchLabel(string $by): string
    {
        return match ($by) {
            'email' => 'email',
            'phone' => 'telepon',
            default => 'nama',
        };
    }

    /** Simpan hanya digit dan "+" di depan. */
    public static function normalizePhone(string|int|float $value): ?string
    {
        if (is_int($value) || is_float($value)) {
            // Sel angka Excel membuang 0 di depan: 81234… → 081234…
            $digits = sprintf('%.0f', $value);

            return str_starts_with($digits, '8') ? '0'.$digits : $digits;
        }

        $value = trim($value);
        $plus = str_starts_with($value, '+') ? '+' : '';
        $digits = (string) preg_replace('/\D+/', '', $value);

        return $digits === '' ? null : $plus.$digits;
    }

    /** Kunci pembanding telepon: hanya digit, awalan 62 disamakan dengan 0. */
    public static function phoneKey(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }
        $digits = (string) preg_replace('/\D+/', '', $phone);
        if (str_starts_with($digits, '62')) {
            $digits = '0'.substr($digits, 2);
        }

        return strlen($digits) >= 5 ? $digits : null;
    }

    /**
     * "150.000", "150000", "Rp 150.000", "150.000,50", "1,250.5", angka Excel → "150000.00".
     * Null bila tidak valid.
     */
    public static function parseRate(string|int|float $value): ?string
    {
        if (is_int($value) || is_float($value)) {
            return number_format((float) $value, 2, '.', '');
        }

        $s = mb_strtolower(trim($value));
        $s = (string) preg_replace('/^rp\.?|idr|\/\s*jam$|per\s*jam$/u', '', $s);
        $s = (string) preg_replace('/[\s\x{00A0}]+/u', '', $s);
        $s = (string) preg_replace('/,-$|\.-$/', '', $s); // "150.000,-"

        $negative = str_starts_with($s, '-');
        $s = ltrim($s, '-');

        if ($s === '' || ! preg_match('/^[\d.,]+$/', $s)) {
            return null;
        }

        $hasDot = str_contains($s, '.');
        $hasComma = str_contains($s, ',');

        if ($hasDot && $hasComma) {
            // Pemisah yang muncul terakhir = desimal.
            $decimal = strrpos($s, ',') > strrpos($s, '.') ? ',' : '.';
            $thousand = $decimal === ',' ? '.' : ',';
            $s = str_replace($thousand, '', $s);
            $s = str_replace($decimal, '.', $s);
        } elseif ($hasDot || $hasComma) {
            $sep = $hasDot ? '.' : ',';
            // "150.000" / "1.500.000" = ribuan; "150.5" / "150,50" = desimal.
            if (preg_match('/^\d{1,3}(\\'.$sep.'\d{3})+$/', $s)) {
                $s = str_replace($sep, '', $s);
            } elseif (substr_count($s, $sep) === 1) {
                $s = str_replace($sep, '.', $s);
            } else {
                return null;
            }
        }

        if (! is_numeric($s)) {
            return null;
        }

        return number_format(($negative ? -1 : 1) * (float) $s, 2, '.', '');
    }

    private static function text(string|int|float $value): string
    {
        if (is_float($value)) {
            return rtrim(rtrim(number_format($value, 10, '.', ''), '0'), '.');
        }

        return trim((string) $value);
    }
}
