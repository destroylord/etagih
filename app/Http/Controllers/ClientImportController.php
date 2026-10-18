<?php

namespace App\Http\Controllers;

use App\Support\ClientImport;
use App\Support\SpreadsheetReader;
use App\Support\XlsxWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Import klien dari CSV / Excel dalam dua langkah:
 *  1. preview — file diurai & divalidasi, TIDAK ada yang disimpan ke database.
 *     Hasil urai disimpan di cache (token acak, 30 menit) supaya langkah
 *     konfirmasi tidak bergantung pada data yang dikirim ulang browser.
 *  2. store — terapkan data dari cache (buat / perbarui / lewati).
 */
class ClientImportController extends Controller
{
    public const MAX_FILE_KB = 2048;

    public const TOKEN_TTL_MINUTES = 30;

    public function __construct(private readonly ClientImport $import) {}

    public function template(Request $request): Response
    {
        $examples = [
            ['PT Contoh Sejahtera', 'keuangan@contoh.co.id', '081234567890', 'Jl. Merdeka No. 1, Jakarta', 'Tagihan dikirim tiap awal bulan', '150000'],
            ['Budi Santoso', 'budi@example.com', '6285712345678', 'Bandung', '', ''],
        ];

        if ($request->query('format') === 'csv') {
            $out = "\xEF\xBB\xBF".implode(',', ClientImport::TEMPLATE_HEADERS)."\r\n";
            foreach ($examples as $row) {
                $out .= implode(',', array_map(fn ($v) => '"'.str_replace('"', '""', $v).'"', $row))."\r\n";
            }

            return response($out, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="template-import-klien.csv"',
            ]);
        }

        $writer = new XlsxWriter;

        $rows = [array_map(fn ($h) => ['v' => $h, 's' => XlsxWriter::XF_HEADER], ClientImport::TEMPLATE_HEADERS)];
        foreach ($examples as $row) {
            // Telepon sebagai teks agar 0 di depan tidak hilang; tarif sebagai angka.
            $row[5] = $row[5] !== '' ? (int) $row[5] : null;
            $rows[] = $row;
        }
        $writer->addSheet('Klien', $rows, ['columns' => [0 => 28, 1 => 28, 2 => 18, 3 => 36, 4 => 32, 5 => 16], 'freeze' => 1]);

        $guide = [
            [['v' => 'PETUNJUK IMPORT KLIEN', 's' => XlsxWriter::XF_SECTION]],
            ['Isi data mulai baris ke-2 di sheet "Klien". Baris pertama adalah header dan jangan dihapus. Hapus baris contoh sebelum import.'],
            ['Maksimal 5.000 baris per file, ukuran file maks. 2 MB. Format .xlsx atau .csv (pemisah koma, titik koma, atau tab).'],
            [''],
            [['v' => 'Kolom', 's' => XlsxWriter::XF_HEADER], ['v' => 'Wajib', 's' => XlsxWriter::XF_HEADER], ['v' => 'Keterangan', 's' => XlsxWriter::XF_HEADER]],
            ['nama', 'Ya', 'Nama klien / perusahaan. Alias header: name.'],
            ['email', 'Tidak', 'Alamat email yang valid. Alias: e-mail.'],
            ['telepon', 'Tidak', 'Nomor telepon / WhatsApp, format 08… atau 62…. Simbol & spasi dibuang otomatis. Alias: phone, hp, no hp, whatsapp, wa.'],
            ['alamat', 'Tidak', 'Alamat penagihan. Alias: address.'],
            ['catatan', 'Tidak', 'Catatan internal. Alias: notes.'],
            ['tarif_per_jam', 'Tidak', 'Tarif per jam khusus klien, mis. 150000, 150.000, atau Rp 150.000. Kosongkan untuk memakai tarif default. Alias: tarif, hourly_rate, rate.'],
            [''],
            [['v' => 'Klien yang sudah ada', 's' => XlsxWriter::XF_BOLD]],
            ['Baris dianggap klien yang sama bila email-nya sama; atau nomor teleponnya sama; atau namanya persis sama (selama email tidak berbeda).'],
            ['Saat konfirmasi Anda bisa memilih memperbarui klien tersebut atau melewatinya. Kolom yang kosong di file tidak menghapus data lama.'],
            [''],
            [['v' => 'Kunci akses portal', 's' => XlsxWriter::XF_BOLD]],
            ['Klien baru otomatis mendapat kunci akses portal, tetapi kunci tidak ditampilkan saat import. Buat kunci baru per klien lewat tombol "Buat kunci akses baru".'],
        ];
        $writer->addSheet('Petunjuk', $guide, ['columns' => [0 => 22, 1 => 10, 2 => 110]]);

        return response($writer->build(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="template-import-klien.xlsx"',
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:'.self::MAX_FILE_KB, 'extensions:xlsx,csv,txt'],
        ], [
            'file.required' => 'Pilih file yang akan diimport.',
            'file.max' => 'Ukuran file maksimal 2 MB.',
            'file.extensions' => 'Format file harus .xlsx atau .csv.',
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');

        try {
            $raw = (new SpreadsheetReader)->read((string) $file->getRealPath(), $file->getClientOriginalExtension());
            $parsed = $this->import->parse($raw);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        $token = Str::random(40);
        Cache::put($this->cacheKey($request, $token), $parsed['rows'], now()->addMinutes(self::TOKEN_TTL_MINUTES));

        $rows = $this->import->analyze($parsed['rows']);
        $count = fn (string $action) => count(array_filter($rows, fn ($r) => $r['action'] === $action));

        return response()->json([
            'token' => $token,
            'file_name' => $file->getClientOriginalName(),
            'columns' => $parsed['columns'],
            'ignored_columns' => $parsed['ignored'],
            'summary' => [
                'total' => count($rows),
                'create' => $count('create'),
                'update' => $count('update'),
                'error' => $count('error'),
            ],
            'rows' => $rows,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'size:40'],
            'update_existing' => ['boolean'],
        ]);

        $key = $this->cacheKey($request, $data['token']);
        /** @var array<int, array{line: int, values: array{name: ?string, email: ?string, phone: ?string, address: ?string, notes: ?string, hourly_rate: ?string}, errors: array<int, string>}>|null $rows */
        // pull: token sekali pakai, mencegah import ganda bila tombol diklik dua kali.
        $rows = Cache::pull($key);

        if (! is_array($rows)) {
            return back()->with('error', 'Data pratinjau sudah kedaluwarsa atau tidak ditemukan. Silakan unggah ulang file.');
        }

        $result = $this->import->apply($rows, $request->boolean('update_existing'));

        return to_route('clients.index')->with('success', sprintf(
            'Import selesai: %d klien dibuat, %d diperbarui, %d dilewati.',
            $result['created'],
            $result['updated'],
            $result['skipped'],
        ));
    }

    /** Token terikat ke user yang mengunggah. */
    private function cacheKey(Request $request, string $token): string
    {
        return 'client-import:'.$request->user()?->getAuthIdentifier().':'.$token;
    }
}
