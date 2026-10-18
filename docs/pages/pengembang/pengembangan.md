---
title: "Panduan pengembangan"
description: "Arsitektur, struktur kode, test, dan konvensi untuk kontributor."
---

## Stack

| Lapisan | Teknologi |
|---|---|
| Backend | Laravel 13, PHP 8.4 |
| Frontend | Inertia.js v3 + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui |
| Routing frontend | Laravel Wayfinder (rute & action di-generate jadi fungsi TypeScript) |
| Auth | Laravel Fortify (login, 2FA, passkey) |
| PDF | DomPDF (`barryvdh/laravel-dompdf`), QR via `bacon/bacon-qr-code` |
| Gambar | Intervention Image (GD) |
| Test & kualitas | Pest, Larastan (PHPStan), Pint, ESLint, Prettier, `tsc` |

## Menjalankan

```bash
composer install && npm ci --include=dev
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
php artisan app:create-admin
composer dev            # server + queue + Vite
```

## Pemeriksaan kualitas

Jalankan sebelum membuat pull request (sama dengan CI di `.github/workflows/tests.yml`):

```bash
composer ci:check
```

Atau satu per satu:

```bash
php artisan test               # Pest (feature + unit; test browser Dusk terpisah)
vendor/bin/phpstan analyse     # static analysis
vendor/bin/pint                # format PHP
npm run types:check            # TypeScript
npm run lint                   # ESLint (--fix)
npm run format                 # Prettier
```

Test memakai SQLite in-memory dan memalsukan HTTP (QRISLY/Fonnte), mail, dan queue, jadi tidak butuh kredensial apa pun.

## Arsitektur

```
HTTP request ─► Controller (validasi, otorisasi, render Inertia)
                    │
                    ▼
               Action (logika bisnis, transaksi DB)   ◄── Command terjadwal
                    │
          ┌─────────┼──────────────┐
          ▼         ▼              ▼
        Model    Support         Service (API luar)
                 (kalkulasi,     QRISLY, Fonnte
                  PDF, laporan)
```

Prinsip:

- **Controller tipis.** Logika bisnis ada di `app/Actions`, supaya bisa dipanggil dari controller, webhook, maupun command.
- **Satu pintu pencatatan pembayaran:** semua sumber (webhook, polling, simulasi, manual) lewat `RecordPayment`.
  Idempoten per `external_id`, mengunci baris invoice, mengalokasikan ke cicilan.
- **Semua uang `decimal(15,2)`**, dibulatkan per langkah. Rumus total ada di satu tempat (`InvoiceLineBuilder::applyTotals`).
- **Tanggal immutable** (`CarbonImmutable` di-set global): selalu pakai nilai kembalian, mis. `$d = $d->addDay()`.
- **Pengaturan bisnis** dibaca lewat `App\Support\Settings::current()` (satu baris tabel `settings`).

## Struktur kode

| Lokasi | Isi |
|---|---|
| `app/Actions/Invoice/` | `CreateInvoice`, `UpdateInvoice`, `InvoiceLineBuilder` (item, total, cicilan), `SendInvoice`, `RecordPayment`, `CancelInvoice`, `DuplicateInvoice`, `GenerateInvoiceNumber`, `WorkSessionAction` |
| `app/Support/` | `InvoicePdf` (render PDF), `QrisStyle` (QR bergaya), `ProjectStats` (statistik & roll-up proyek), `InvoiceReports` (laporan), `Terbilang`, `RateResolver`, `Recurrence`, `InvoiceNumberGenerator`, `XlsxWriter` (Excel tanpa ekstensi zip) |
| `app/Services/` | `QrislyService` (upload, generate, status), `WhatsAppService` (Fonnte + template), `PaymentStatus` (pemetaan status) |
| `app/Console/Commands/` | `invoices:mark-overdue`, `app:invoice-reminders`, `invoices:generate-recurring`, `sessions:cleanup-stale`, `app:create-admin` |
| `app/Http/Controllers/` | Satu controller per area; `Invoice/PaymentController` (halaman bayar publik) & `Invoice/WebhookController` |
| `routes/web.php` · `routes/console.php` | Rute HTTP · jadwal tugas |
| `resources/js/pages/` | Halaman Inertia (nama file = nama komponen di `Inertia::render`) |
| `resources/js/components/` | Komponen bersama (`page-header`, `stat-card`, `confirm-dialog`, `invoice-status-badge`, …) dan folder per fitur (`invoice-form/`, `invoice-detail/`, `projects/`, `pay/`, `time-tracker/`, `settings/`, `reports/`) |
| `resources/js/lib/format.ts` | Format Rupiah, tanggal, durasi (locale `id-ID`) |
| `resources/js/types/models.ts` | Tipe data yang dikirim backend |
| `resources/views/pdf/invoice.blade.php` | Template PDF (CSS 2.1, layout tabel, khusus DomPDF) |
| `docker/`, `Dockerfile`, `docker-compose.yml` | Stack produksi |
| `docs/` | Situs dokumentasi ini ([Zudoku](https://zudoku.dev)); `cd docs && npm ci && npm run dev` |

## Model data

```
User (admin)

Client ─┬─< Project ─< Project (sub-proyek, parent_id)
        ├─< Product
        ├─< WorkSession >── Project
        └─< Invoice >── Project
               ├─< InvoiceItem >── Product, Project (sub-proyek)
               │        └─< WorkSession
               ├─< PaymentSchedule (cicilan)
               └─< Payment >── PaymentSchedule

Setting (1 baris) · QrisAccount
```

Status invoice: `draft → sent → partial / overdue → paid`, atau `cancelled`.

## Konvensi

- **Bahasa:** antarmuka & komentar kode dalam Bahasa Indonesia; nama kelas/fungsi/variabel dalam Bahasa Inggris.
- **Komentar** menjelaskan *mengapa*, bukan *apa*.
- **Frontend:** gunakan komponen bersama dan token warna semantik (`bg-background`, `text-muted-foreground`) agar mode gelap konsisten; uang selalu `tabular-nums`; layout harus nyaman di layar 375px.
- **Migrasi:** jangan mengubah migrasi yang sudah dirilis, tapi buat migrasi baru. Sertakan `down()`.
- **Setiap perubahan perilaku disertai test.** Perbaikan bug sebaiknya diawali test yang gagal.

## Menambah gateway pembayaran

1. Buat service di `app/Services/` (generate pembayaran, cek status).
2. Tambahkan endpoint webhook yang **memverifikasi** notifikasi (signature atau cek ulang ke API gateway).
3. Catat pembayaran dengan `app(RecordPayment::class)->execute(invoice: …, amount: …, externalId: …, method: …)`.
4. Tambahkan nilai `method` baru ke enum `payments.method` lewat migrasi.
