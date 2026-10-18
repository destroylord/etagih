<?php

namespace App\Support;

use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

/**
 * Pembaca spreadsheet sederhana tanpa library tambahan.
 *
 *  - `.csv` / `.txt`: deteksi otomatis pemisah `,` `;` atau tab, BOM UTF-8,
 *    field berkutip (termasuk baris baru di dalam kutip). File non-UTF-8
 *    (mis. CSV dari Excel Windows) dikonversi dari Windows-1252.
 *  - `.xlsx`: ZipArchive (atau pembaca ZIP murni-PHP bila ekstensi zip tidak
 *    tersedia) + SimpleXML. Hanya worksheet pertama; shared string, inline
 *    string, angka, boolean. Style diabaikan.
 *
 * Proteksi: ukuran hasil ekstrak dibatasi (anti zip bomb) dan jumlah baris
 * dibatasi. Pelanggaran dilempar sebagai {@see RuntimeException} dengan
 * pesan berbahasa Indonesia yang aman ditampilkan ke pengguna.
 *
 * Nilai sel: string (sudah di-trim), int / float untuk sel angka xlsx, atau null.
 */
class SpreadsheetReader
{
    private const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    private const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

    /** Paksa pembaca ZIP murni-PHP (dipakai test). */
    public static bool $forcePureZip = false;

    public function __construct(
        public readonly int $maxRows = 5000,
        public readonly int $maxUncompressedBytes = 20 * 1024 * 1024,
    ) {}

    /**
     * Baca file. Baris kosong dibuang; kunci array = nomor baris asli (1-based).
     *
     * @param  string|null  $extension  ekstensi asli (file upload tersimpan tanpa ekstensi)
     * @return array<int, array<int, string|int|float|null>>
     */
    public function read(string $path, ?string $extension = null): array
    {
        $extension = strtolower($extension ?? pathinfo($path, PATHINFO_EXTENSION));

        return match ($extension) {
            'xlsx' => $this->readXlsx($path),
            'csv', 'txt', 'tsv' => $this->readCsv($path),
            default => throw new RuntimeException('Format file tidak didukung. Gunakan .xlsx atau .csv.'),
        };
    }

    /**
     * @return array<int, array<int, string|int|float|null>>
     */
    public function readCsv(string $path): array
    {
        $content = @file_get_contents($path);
        if ($content === false) {
            throw new RuntimeException('File tidak bisa dibaca.');
        }

        return $this->parseCsv($content);
    }

    /**
     * @return array<int, array<int, string|int|float|null>>
     */
    public function parseCsv(string $content): array
    {
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }
        if (! mb_check_encoding($content, 'UTF-8')) {
            $content = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
        }

        $delimiter = $this->detectDelimiter($content);

        $stream = fopen('php://temp', 'r+');
        if ($stream === false) {
            throw new RuntimeException('Tidak bisa membuka stream sementara.');
        }
        fwrite($stream, $content);
        rewind($stream);

        $rows = [];
        $line = 0;
        while (($record = fgetcsv($stream, null, $delimiter, '"', '')) !== false) {
            $line++;
            $cells = array_map(fn ($v) => $this->cleanString($v), $record);
            if ($this->isEmptyRow($cells)) {
                continue;
            }
            $this->guardRowCount(count($rows));
            $rows[$line] = $cells;
        }
        fclose($stream);

        return $rows;
    }

    /**
     * Pilih pemisah dengan jumlah kemunculan terbanyak di baris pertama
     * (di luar tanda kutip). Default koma.
     */
    private function detectDelimiter(string $content): string
    {
        $firstLine = '';
        $inQuotes = false;
        $len = min(strlen($content), 65536);
        for ($i = 0; $i < $len; $i++) {
            $ch = $content[$i];
            if ($ch === '"') {
                $inQuotes = ! $inQuotes;
            } elseif (! $inQuotes && ($ch === "\n" || $ch === "\r")) {
                break;
            }
            if (! $inQuotes) {
                $firstLine .= $ch;
            }
        }

        $best = ',';
        $bestCount = 0;
        foreach ([',', ';', "\t"] as $candidate) {
            $count = substr_count($firstLine, $candidate);
            if ($count > $bestCount) {
                $best = $candidate;
                $bestCount = $count;
            }
        }

        return $best;
    }

    /**
     * @return array<int, array<int, string|int|float|null>>
     */
    public function readXlsx(string $path): array
    {
        $files = $this->openZip($path);

        $sheetPath = $this->firstSheetPath($files);
        $sheetXml = $files($sheetPath);
        if ($sheetXml === null) {
            throw new RuntimeException('Worksheet tidak ditemukan di file Excel.');
        }

        $sharedXml = $files('xl/sharedStrings.xml');
        $shared = $sharedXml !== null ? $this->sharedStrings($sharedXml) : [];

        return $this->parseSheet($sheetXml, $shared);
    }

    /**
     * Kembalikan fungsi pembaca entri ZIP: nama entri → isi (atau null bila tidak ada).
     * Total isi yang diekstrak dibatasi $maxUncompressedBytes.
     *
     * @return callable(string): ?string
     */
    private function openZip(string $path): callable
    {
        $budget = $this->maxUncompressedBytes;

        if (! self::$forcePureZip && class_exists(ZipArchive::class)) {
            $zip = new ZipArchive;
            if ($zip->open($path, ZipArchive::RDONLY) !== true) {
                throw new RuntimeException('File Excel rusak atau bukan .xlsx yang valid.');
            }

            return function (string $name) use ($zip, &$budget): ?string {
                $stat = $zip->statName($name);
                if ($stat === false) {
                    return null;
                }
                if ($stat['size'] > $budget) {
                    throw $this->tooLarge();
                }
                $stream = $zip->getStream($name);
                if ($stream === false) {
                    throw new RuntimeException('File Excel rusak atau bukan .xlsx yang valid.');
                }
                // Jangan percaya ukuran di header ZIP: baca bertahap sampai batas.
                $data = '';
                while (! feof($stream)) {
                    $chunk = fread($stream, 65536);
                    if ($chunk === false) {
                        break;
                    }
                    $data .= $chunk;
                    if (strlen($data) > $budget) {
                        fclose($stream);
                        throw $this->tooLarge();
                    }
                }
                fclose($stream);
                $budget -= strlen($data);

                return $data;
            };
        }

        $entries = $this->pureZipEntries($path);

        return function (string $name) use ($entries, &$budget): ?string {
            $entry = $entries[$name] ?? null;
            if ($entry === null) {
                return null;
            }
            if ($entry['size'] > $budget) {
                throw $this->tooLarge();
            }
            $data = match ($entry['method']) {
                0 => $entry['data'],
                8 => @gzinflate($entry['data'], max(1, $budget)),
                default => false,
            };
            if ($data === false || strlen($data) > $budget) {
                throw new RuntimeException('File Excel rusak, terlalu besar, atau memakai kompresi yang tidak didukung.');
            }
            $budget -= strlen($data);

            return $data;
        };
    }

    /**
     * Pembaca ZIP minimal (central directory) untuk server tanpa ekstensi zip.
     *
     * @return array<string, array{method: int, size: int, data: string}>
     */
    private function pureZipEntries(string $path): array
    {
        $bin = @file_get_contents($path);
        if ($bin === false) {
            throw new RuntimeException('File tidak bisa dibaca.');
        }

        $invalid = new RuntimeException('File Excel rusak atau bukan .xlsx yang valid.');
        $eocd = strrpos($bin, "PK\x05\x06");
        if ($eocd === false || strlen($bin) < $eocd + 22) {
            throw $invalid;
        }
        /** @var array{count: int, cdSize: int, cdOffset: int} $end */
        $end = unpack('vcount/VcdSize/VcdOffset', $bin, $eocd + 10);
        $pos = $end['cdOffset'];

        $entries = [];
        for ($i = 0; $i < $end['count']; $i++) {
            if (substr($bin, $pos, 4) !== "PK\x01\x02") {
                throw $invalid;
            }
            /** @var array{method: int, csize: int, usize: int, nameLen: int, extraLen: int, commentLen: int, offset: int} $cd */
            $cd = unpack('vmethod/x4/Vcrc/Vcsize/Vusize/vnameLen/vextraLen/vcommentLen/x8/Voffset', $bin, $pos + 10);
            $name = substr($bin, $pos + 46, $cd['nameLen']);
            $pos += 46 + $cd['nameLen'] + $cd['extraLen'] + $cd['commentLen'];

            if (substr($bin, $cd['offset'], 4) !== "PK\x03\x04") {
                throw $invalid;
            }
            /** @var array{nameLen: int, extraLen: int} $lh */
            $lh = unpack('vnameLen/vextraLen', $bin, $cd['offset'] + 26);
            $start = $cd['offset'] + 30 + $lh['nameLen'] + $lh['extraLen'];

            $entries[$name] = [
                'method' => $cd['method'],
                'size' => $cd['usize'],
                'data' => substr($bin, $start, $cd['csize']),
            ];
        }

        return $entries;
    }

    /**
     * Cari path worksheet pertama lewat workbook.xml + relasinya.
     *
     * @param  callable(string): ?string  $files
     */
    private function firstSheetPath(callable $files): string
    {
        $fallback = 'xl/worksheets/sheet1.xml';

        $workbook = $files('xl/workbook.xml');
        $rels = $files('xl/_rels/workbook.xml.rels');
        if ($workbook === null || $rels === null) {
            return $fallback;
        }

        $wb = $this->xml($workbook);
        $sheets = $wb->children(self::NS_MAIN)->sheets;
        $first = $sheets->count() ? $sheets->children(self::NS_MAIN)->sheet[0] : null;
        if ($first === null) {
            return $fallback;
        }
        $rid = (string) $first->attributes(self::NS_REL)['id'];

        foreach ($this->xml($rels)->children(self::NS_PKG_REL)->Relationship as $rel) {
            if (self::attr($rel, 'Id') !== $rid) {
                continue;
            }
            $target = self::attr($rel, 'Target');

            return str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.ltrim($target, './');
        }

        return $fallback;
    }

    /**
     * @return array<int, string>
     */
    private function sharedStrings(string $xml): array
    {
        $out = [];
        foreach ($this->xml($xml)->children(self::NS_MAIN)->si as $si) {
            $out[] = $this->richText($si);
        }

        return $out;
    }

    /** Teks dari <si>/<is>: <t> langsung atau gabungan <r><t> (abaikan fonetik <rPh>). */
    private function richText(SimpleXMLElement $node): string
    {
        $children = $node->children(self::NS_MAIN);
        $text = '';
        if (isset($children->t)) {
            $text .= (string) $children->t;
        }
        foreach ($children->r as $run) {
            $text .= (string) $run->children(self::NS_MAIN)->t;
        }

        return $text;
    }

    /**
     * @param  array<int, string>  $shared
     * @return array<int, array<int, string|int|float|null>>
     */
    private function parseSheet(string $xml, array $shared): array
    {
        $sheet = $this->xml($xml);
        $sheetData = $sheet->children(self::NS_MAIN)->sheetData;
        if (! $sheetData->count()) {
            return [];
        }

        $rows = [];
        $rowNumber = 0;
        foreach ($sheetData->children(self::NS_MAIN)->row as $row) {
            $rAttr = (int) self::attr($row, 'r');
            $rowNumber = $rAttr > 0 ? $rAttr : $rowNumber + 1;

            $cells = [];
            $col = -1;
            foreach ($row->children(self::NS_MAIN)->c as $c) {
                $ref = self::attr($c, 'r');
                $col = $ref !== '' ? $this->columnIndex($ref) : $col + 1;
                if ($col > 255) {
                    continue; // kolom sejauh ini tidak relevan untuk import
                }
                $cells[$col] = $this->cellValue($c, $shared);
            }

            if ($cells === []) {
                continue;
            }
            $filled = array_fill(0, max(array_keys($cells)) + 1, null);
            foreach ($cells as $i => $v) {
                $filled[$i] = $v;
            }
            if ($this->isEmptyRow($filled)) {
                continue;
            }

            $this->guardRowCount(count($rows));
            $rows[$rowNumber] = $filled;
        }

        return $rows;
    }

    /**
     * @param  array<int, string>  $shared
     */
    private function cellValue(SimpleXMLElement $c, array $shared): string|int|float|null
    {
        $type = self::attr($c, 't');
        $children = $c->children(self::NS_MAIN);
        $v = isset($children->v) ? (string) $children->v : null;

        return match ($type) {
            's' => $v !== null ? $this->cleanString($shared[(int) $v] ?? '') : null,
            'inlineStr' => isset($children->is) ? $this->cleanString($this->richText($children->is)) : null,
            'str' => $v !== null ? $this->cleanString($v) : null,
            'b' => $v !== null ? ($v === '1' ? 'TRUE' : 'FALSE') : null,
            'e' => null,
            default => $v !== null && is_numeric($v) ? $this->number($v) : ($v !== null ? $this->cleanString($v) : null),
        };
    }

    private function number(string $v): int|float
    {
        $f = (float) $v;
        if (floor($f) === $f && abs($f) < PHP_INT_MAX) {
            return (int) $f;
        }

        return $f;
    }

    /** "AB12" → 27 (0-based). */
    private function columnIndex(string $ref): int
    {
        $letters = strtoupper((string) preg_replace('/[^A-Za-z]/', '', $ref));
        $n = 0;
        for ($i = 0, $len = strlen($letters); $i < $len; $i++) {
            $n = $n * 26 + (ord($letters[$i]) - 64);
        }

        return max(0, $n - 1);
    }

    /**
     * Atribut tanpa namespace. `$el['x']` tidak bisa dipakai karena elemen hasil
     * children($ns) mencari atribut di namespace tersebut.
     */
    private static function attr(SimpleXMLElement $el, string $name): string
    {
        return (string) $el->attributes()?->{$name};
    }

    private function xml(string $xml): SimpleXMLElement
    {
        // xlsx asli tidak pernah memakai DTD; tolak untuk mencegah XXE / entity expansion.
        if (stripos($xml, '<!DOCTYPE') !== false) {
            throw new RuntimeException('File Excel rusak atau bukan .xlsx yang valid.');
        }

        $prev = libxml_use_internal_errors(true);
        $doc = simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NONET | LIBXML_COMPACT);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        if ($doc === false) {
            throw new RuntimeException('File Excel rusak atau bukan .xlsx yang valid.');
        }

        return $doc;
    }

    private function cleanString(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        // Buang spasi termasuk non-breaking space di ujung.
        $v = (string) preg_replace('/^[\s\x{00A0}\x{FEFF}]+|[\s\x{00A0}\x{FEFF}]+$/u', '', $v);

        return $v === '' ? null : $v;
    }

    /**
     * @param  array<int, string|int|float|null>  $cells
     */
    private function isEmptyRow(array $cells): bool
    {
        foreach ($cells as $cell) {
            if ($cell !== null && $cell !== '') {
                return false;
            }
        }

        return true;
    }

    private function guardRowCount(int $current): void
    {
        // +1 untuk baris header.
        if ($current >= $this->maxRows + 1) {
            throw new RuntimeException('File berisi lebih dari '.number_format($this->maxRows, 0, ',', '.').' baris data. Pecah menjadi beberapa file.');
        }
    }

    private function tooLarge(): RuntimeException
    {
        return new RuntimeException('Isi file Excel terlalu besar setelah diekstrak (maks. '.intdiv($this->maxUncompressedBytes, 1024 * 1024).' MB).');
    }
}
