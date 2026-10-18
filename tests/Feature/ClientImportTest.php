<?php

use App\Models\Client;
use App\Models\User;
use App\Support\ClientImport;
use App\Support\SpreadsheetReader;
use App\Support\XlsxWriter;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->actingAs(User::factory()->create());
});

function csvUpload(string $content, string $name = 'klien.csv'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $content);
}

/**
 * @param  array<int, array<int, scalar|null>>  $rows
 */
function xlsxUpload(array $rows, string $name = 'klien.xlsx'): UploadedFile
{
    $writer = new XlsxWriter;
    $writer->addSheet('Klien', $rows);

    return UploadedFile::fake()->createWithContent($name, $writer->build());
}

function previewImport(UploadedFile $file): TestResponse
{
    return test()->postJson('/clients/import/preview', ['file' => $file]);
}

it('downloads the xlsx template with headers, examples, and a guide sheet', function () {
    $response = $this->get('/clients/import/template')->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('spreadsheetml');

    $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
    file_put_contents($path, $response->getContent());
    $rows = (new SpreadsheetReader)->read($path);

    $zip = new ZipArchive;
    $zip->open($path);
    $workbook = $zip->getFromName('xl/workbook.xml');
    $zip->close();
    unlink($path);

    expect(array_values($rows)[0])->toBe(ClientImport::TEMPLATE_HEADERS)
        ->and($rows)->toHaveCount(3)
        ->and($workbook)->toContain('name="Petunjuk"');
});

it('downloads the csv template and the template itself previews cleanly', function () {
    $csv = $this->get('/clients/import/template?format=csv')->assertOk()->getContent();

    expect($csv)->toStartWith("\xEF\xBB\xBFnama,email,telepon,alamat,catatan,tarif_per_jam");

    previewImport(csvUpload($csv))
        ->assertOk()
        ->assertJsonPath('summary', ['total' => 2, 'create' => 2, 'update' => 0, 'error' => 0])
        ->assertJsonPath('rows.0.values.hourly_rate', '150000.00');
});

it('previews a semicolon csv with aliases, normalization and per-row errors without persisting', function () {
    $csv = "\xEF\xBB\xBFName;E-Mail;No. HP;Address;Notes;Tarif (Rp);Kolom Lain\n"
        ."Budi;BUDI@Example.com;+62 812-3456-7890;Bandung;VIP;Rp 150.000;x\n"
        .";tanpa-nama@example.com;;;;;\n"
        ."Siti;bukan-email;;;;abc;\n"
        ."Andi;andi@example.com;;;;150.000,50;\n"
        ."budi ;;;;;;\n";

    $response = previewImport(csvUpload($csv))->assertOk();

    $response->assertJsonPath('columns', [
        'name' => 'Name', 'email' => 'E-Mail', 'phone' => 'No. HP',
        'address' => 'Address', 'notes' => 'Notes', 'hourly_rate' => 'Tarif (Rp)',
    ])
        ->assertJsonPath('ignored_columns', ['Kolom Lain'])
        ->assertJsonPath('summary', ['total' => 5, 'create' => 2, 'update' => 0, 'error' => 3])
        ->assertJsonPath('rows.0.line', 2)
        ->assertJsonPath('rows.0.action', 'create')
        ->assertJsonPath('rows.0.values', [
            'name' => 'Budi', 'email' => 'budi@example.com', 'phone' => '+6281234567890',
            'address' => 'Bandung', 'notes' => 'VIP', 'hourly_rate' => '150000.00',
        ])
        ->assertJsonPath('rows.1.action', 'error')
        ->assertJsonPath('rows.1.errors', ['Kolom nama wajib diisi.'])
        ->assertJsonPath('rows.2.action', 'error')
        ->assertJsonPath('rows.3.values.hourly_rate', '150000.50')
        ->assertJsonPath('rows.4.action', 'error');

    expect($response->json('rows.2.errors'))->toHaveCount(2)
        ->and($response->json('rows.4.errors.0'))->toBe('Duplikat dengan baris 2 (nama sama).')
        ->and(Client::count())->toBe(0);
});

it('previews an xlsx upload and keeps leading zeros of numeric phone cells', function () {
    $response = previewImport(xlsxUpload([
        ['nama', 'whatsapp', 'tarif_per_jam'],
        ['Budi', 81234567890, 125000],
        ['Siti', '0857 1111 2222', 99.5],
    ]))->assertOk();

    $response->assertJsonPath('rows.0.values.phone', '081234567890')
        ->assertJsonPath('rows.0.values.hourly_rate', '125000.00')
        ->assertJsonPath('rows.1.values.phone', '085711112222')
        ->assertJsonPath('rows.1.values.hourly_rate', '99.50');
});

it('detects duplicates against existing clients by email, then phone, then name', function () {
    $byEmail = Client::create(['name' => 'PT Lama', 'email' => 'tagihan@lama.id']);
    $byPhone = Client::create(['name' => 'Toko Sinar', 'phone' => '0812-1111-2222']);
    $byName = Client::create(['name' => 'Budi Santoso']);
    Client::create(['name' => 'Siti', 'email' => 'siti@lama.id']);

    $csv = "nama,email,telepon\n"
        ."PT Baru,TAGIHAN@lama.id,\n"
        ."Toko Sinar Jaya,,6281211112222\n"
        ."BUDI SANTOSO,,\n"
        ."Siti,siti@baru.id,\n";

    previewImport(csvUpload($csv))
        ->assertOk()
        ->assertJsonPath('rows.0.action', 'update')
        ->assertJsonPath('rows.0.match', ['id' => $byEmail->id, 'name' => 'PT Lama', 'by' => 'email'])
        ->assertJsonPath('rows.1.match', ['id' => $byPhone->id, 'name' => 'Toko Sinar', 'by' => 'phone'])
        ->assertJsonPath('rows.2.match', ['id' => $byName->id, 'name' => 'Budi Santoso', 'by' => 'name'])
        // Nama sama tetapi email berbeda → klien berbeda.
        ->assertJsonPath('rows.3.action', 'create')
        ->assertJsonPath('rows.3.match', null);
});

it('flags duplicate email and phone within the same file', function () {
    $csv = "nama,email,telepon\nA,a@x.id,0811111\nB,A@X.ID,\nC,,62811111\n";

    previewImport(csvUpload($csv))
        ->assertOk()
        ->assertJsonPath('rows.1.errors', ['Duplikat dengan baris 2 (email sama).'])
        ->assertJsonPath('rows.2.errors', ['Duplikat dengan baris 2 (telepon sama).']);
});

it('creates, updates and skips rows on store, generating access keys for new clients', function () {
    $existing = Client::create(['name' => 'PT Lama', 'email' => 'lama@x.id', 'address' => 'Alamat lama', 'notes' => 'Catatan lama']);
    $oldHash = $existing->access_key_hash;

    $csv = "nama,email,alamat,catatan\n"
        ."PT Lama Baru,lama@x.id,Alamat baru,\n"
        ."Klien Baru,baru@x.id,,\n"
        .",error@x.id,,\n";
    $token = previewImport(csvUpload($csv))->assertOk()->json('token');

    $this->post('/clients/import', ['token' => $token, 'update_existing' => true])
        ->assertRedirect('/clients')
        ->assertSessionHas('success', 'Import selesai: 1 klien dibuat, 1 diperbarui, 1 dilewati.');

    $existing->refresh();
    expect($existing->name)->toBe('PT Lama Baru')
        ->and($existing->address)->toBe('Alamat baru')
        ->and($existing->notes)->toBe('Catatan lama') // kolom kosong tidak menghapus data lama
        ->and($existing->access_key_hash)->toBe($oldHash)
        ->and(Client::count())->toBe(2);

    $new = Client::where('email', 'baru@x.id')->firstOrFail();
    expect($new->access_key_hash)->not->toBeNull()->toHaveLength(64);
});

it('skips existing clients when update toggle is off', function () {
    $existing = Client::create(['name' => 'PT Lama', 'email' => 'lama@x.id']);

    $token = previewImport(csvUpload("nama,email\nGanti Nama,lama@x.id\nBaru,baru@x.id\n"))->json('token');

    $this->post('/clients/import', ['token' => $token, 'update_existing' => false])
        ->assertSessionHas('success', 'Import selesai: 1 klien dibuat, 0 diperbarui, 1 dilewati.');

    expect($existing->fresh()->name)->toBe('PT Lama')
        ->and(Client::count())->toBe(2);
});

it('rejects invalid, reused and expired tokens', function () {
    $this->post('/clients/import', ['token' => str_repeat('a', 40)])
        ->assertSessionHas('error');
    $this->post('/clients/import', ['token' => 'pendek'])
        ->assertSessionHasErrors('token');

    $token = previewImport(csvUpload("nama\nBudi\n"))->json('token');
    $this->post('/clients/import', ['token' => $token])->assertSessionHas('success');
    // Token sekali pakai.
    $this->post('/clients/import', ['token' => $token])->assertSessionHas('error');
    expect(Client::count())->toBe(1);

    $token = previewImport(csvUpload("nama\nSiti\n"))->json('token');
    $this->travel(31)->minutes();
    $this->post('/clients/import', ['token' => $token])->assertSessionHas('error');
    expect(Client::count())->toBe(1);
});

it('binds the token to the uploading user', function () {
    $token = previewImport(csvUpload("nama\nBudi\n"))->json('token');

    $this->actingAs(User::factory()->create())
        ->post('/clients/import', ['token' => $token])
        ->assertSessionHas('error');

    expect(Client::count())->toBe(0);
});

it('rejects files that are too large, of the wrong type, or malformed', function () {
    previewImport(UploadedFile::fake()->create('klien.csv', 2049))
        ->assertUnprocessable()->assertJsonValidationErrors(['file' => 'maksimal 2 MB']);

    previewImport(UploadedFile::fake()->create('klien.pdf', 10, 'application/pdf'))
        ->assertUnprocessable()->assertJsonValidationErrors(['file' => '.xlsx atau .csv']);

    previewImport(UploadedFile::fake()->createWithContent('klien.xlsx', 'bukan zip'))
        ->assertUnprocessable()->assertJsonValidationErrors('file');

    previewImport(csvUpload("email,telepon\na@x.id,0812\n"))
        ->assertUnprocessable()->assertJsonValidationErrors(['file' => 'Kolom "nama" tidak ditemukan']);

    previewImport(csvUpload("nama\n"))
        ->assertUnprocessable()->assertJsonValidationErrors(['file' => 'tidak berisi baris data']);

    $this->postJson('/clients/import/preview')->assertJsonValidationErrors('file');
});

it('rejects files with more than 5000 data rows', function () {
    $csv = "nama\n".implode("\n", array_map(fn ($i) => "Klien {$i}", range(1, 5001)));

    previewImport(csvUpload($csv))
        ->assertUnprocessable()->assertJsonValidationErrors(['file' => 'lebih dari 5.000 baris']);
});

it('accepts exactly 5000 data rows', function () {
    $csv = "nama\n".implode("\n", array_map(fn ($i) => "Klien {$i}", range(1, 5000)));

    previewImport(csvUpload($csv))->assertOk()->assertJsonPath('summary.create', 5000);
});

it('requires authentication', function () {
    auth()->logout();

    $this->get('/clients/import/template')->assertRedirect('/login');
    $this->post('/clients/import', ['token' => str_repeat('a', 40)])->assertRedirect('/login');
});

it('parses rate formats', function (mixed $input, ?string $expected) {
    expect(ClientImport::parseRate($input))->toBe($expected);
})->with([
    ['150000', '150000.00'],
    ['150.000', '150000.00'],
    ['Rp 150.000', '150000.00'],
    ['Rp150.000,-', '150000.00'],
    ['1.500.000', '1500000.00'],
    ['150.000,50', '150000.50'],
    ['1,250.5', '1250.50'],
    ['150,000', '150000.00'],
    ['99,5', '99.50'],
    ['99.5', '99.50'],
    [125000, '125000.00'],
    [99.5, '99.50'],
    ['abc', null],
    ['1.2.3,4,5', null],
]);

it('maps header aliases case-insensitively', function (string $header, ?string $field) {
    expect(ClientImport::fieldForHeader($header))->toBe($field);
})->with([
    ['NAMA', 'name'], ['Name', 'name'], ['e-mail', 'email'], ['No HP', 'phone'], ['WhatsApp', 'phone'],
    ['wa', 'phone'], ['Phone', 'phone'], ['Alamat', 'address'], ['notes', 'notes'],
    ['tarif_per_jam', 'hourly_rate'], ['Hourly Rate', 'hourly_rate'], ['RATE', 'hourly_rate'], ['umur', null],
]);
