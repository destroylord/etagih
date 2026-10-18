---
title: "Konfigurasi"
description: "Referensi semua variabel .env dan menu Pengaturan di aplikasi."
---

Konfigurasi eTagih terbagi dua:

1. **File `.env`**: kredensial & setelan server (database, gateway pembayaran, email). Hanya bisa diubah oleh admin server.
2. **Menu Pengaturan di aplikasi**: profil bisnis, tampilan invoice, QRIS, pengingat, dan template pesan. Disimpan di database.

:::note

Setelah mengubah `.env` di produksi, jalankan `php artisan optimize` (manual) atau
`docker compose up -d --force-recreate app worker scheduler` (Docker) karena konfigurasi di-cache.

:::

## Variabel `.env`

### Aplikasi

| Variabel | Contoh | Keterangan |
|---|---|---|
| `APP_NAME` | `eTagih` | Nama aplikasi (judul tab, email). |
| `APP_ENV` | `production` | `local` untuk pengembangan. Di luar `production`, halaman bayar menampilkan tombol simulasi. |
| `APP_DEBUG` | `false` | **Wajib `false` di produksi.** |
| `APP_KEY` | `base64:…` | Kunci enkripsi. Buat dengan `php artisan key:generate`. Jangan pernah diganti setelah dipakai. |
| `APP_URL` | `https://invoice.domainkamu.com` | URL publik lengkap. Dipakai untuk link bayar di WA/email/PDF. |
| `APP_TIMEZONE` | `Asia/Jakarta` | Zona waktu tanggal invoice, nomor invoice harian, dan jadwal pengingat. Tentukan sejak awal; mengganti belakangan membuat waktu lama tampil bergeser. |
| `APP_LOCALE` | `id` | Bahasa nama bulan pada pesan WA & laporan. |
| `TRUSTED_PROXIES` | `127.0.0.1` | IP proxy tepercaya (koma), atau `*` bila di belakang ngrok/load balancer. |
| `LOG_CHANNEL` / `LOG_LEVEL` | `daily` / `warning` | Log aplikasi di `storage/logs`. |

### Database, sesi, antrean

| Variabel | Contoh | Keterangan |
|---|---|---|
| `DB_CONNECTION` | `mariadb` | `mariadb`, `mysql`, atau `sqlite`. |
| `DB_HOST` `DB_PORT` `DB_DATABASE` `DB_USERNAME` `DB_PASSWORD` | | Koneksi database. Di Docker, `DB_HOST=db`. |
| `DB_ROOT_PASSWORD` | | **Khusus Docker**: password root MariaDB. |
| `SESSION_DRIVER` / `CACHE_STORE` / `QUEUE_CONNECTION` | `database` | Semua memakai database secara default, jadi tidak butuh Redis. |
| `SESSION_SECURE_COOKIE` | `true` | Aktifkan di produksi (HTTPS). |

### Email

| Variabel | Keterangan |
|---|---|
| `MAIL_MAILER` | `smtp` untuk produksi; `log` menulis email ke log (pengembangan). |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USERNAME` `MAIL_PASSWORD` `MAIL_SCHEME` | Kredensial SMTP (Gmail App Password, Brevo, Mailgun, SES, dll). |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | Pengirim email invoice. |

### Pembayaran QRIS (QRISLY)

| Variabel | Keterangan |
|---|---|
| `QRISLY_IS_PRODUCTION` | `false` = sandbox. Ubah ke `true` setelah uji coba berhasil. |
| `QRISLY_BASE_URL` / `QRISLY_PRODUCTION_BASE_URL` | Endpoint sandbox / produksi (biarkan default). |
| `QRISLY_API_KEY` | Dari dashboard Collaborator → Developer → API Settings. |
| `QRISLY_MERCHANT_ID` | **Opsional**, cadangan bila belum ada QRIS yang di-upload lewat Pengaturan → QRIS. |

### WhatsApp (Fonnte)

| Variabel | Keterangan |
|---|---|
| `FONNTE_BASE_URL` | Biarkan default (`https://api.fonnte.com`). |
| `WA_API_KEY` | Token device di dashboard Fonnte. Pesan dikirim dari nomor WhatsApp yang terhubung ke token ini. |

### Time Tracker

| Variabel | Default | Keterangan |
|---|---|---|
| `SESSION_ROUNDING_MINUTES` | `15` | Durasi sesi dibulatkan ke atas ke kelipatan ini saat dihentikan. |
| `SESSION_MIN_BILLABLE_MINUTES` | `15` | Durasi minimum yang ditagih per sesi. |
| `SESSION_STALE_HOURS` | `24` | Sesi berjalan lebih lama dari ini otomatis dibatalkan (lupa di-stop). |

### Khusus Docker

| Variabel | Keterangan |
|---|---|
| `APP_DOMAIN` | Domain tanpa `https://`; Caddy mengambil sertifikat SSL untuk domain ini. |
| `ACME_EMAIL` | Email notifikasi Let's Encrypt. |
| `RUN_MIGRATIONS` | `true` = migrasi otomatis setiap container `app` start. |
| `ETAGIH_IMAGE` | Prefix image siap pakai, mis. `ghcr.io/destroylord`. Dipakai `docker compose pull`. |
| `ETAGIH_VERSION` | Tag image: `latest` (rilis terbaru, default), versi tertentu (mis. `1.2.0`), atau `edge` (cabang utama, belum dirilis). |

### Instalasi & update

| Variabel | Default | Keterangan |
|---|---|---|
| `SETUP_TOKEN` | (kosong) | Opsional. Bila diisi, wizard instalasi pertama (`/setup`) hanya bisa dipakai dengan token ini: buka `/setup?token=ISI_TOKEN`. Disarankan untuk server publik. Tidak berpengaruh setelah akun pertama dibuat. |
| `ETAGIH_UPDATE_REPO` | `destroylord/etagih` | Repo GitHub (`owner/nama`) yang dicek untuk rilis terbaru. Ganti bila memakai fork. |
| `ETAGIH_UPDATE_CHECK` | `true` | `false` mematikan cek update (mis. server tanpa akses internet). Pengecekan hanya ke `api.github.com`, sekali sehari, tanpa mengirim data apa pun. |
| `APP_VERSION` | dari image / file `VERSION` | Versi yang berjalan. Biasanya **tidak perlu diisi** — image Docker sudah membawanya. `dev` = cek update dilewati. |

Template lengkap: [`.env.production.example`](https://github.com/destroylord/etagih/blob/main/.env.production.example).

---

## Menu Pengaturan (di aplikasi)

Buka **Pengaturan Invoice** di sidebar. Semua perubahan berlaku setelah klik **Simpan**.

| Bagian | Isi |
|---|---|
| **Profil perusahaan** | Logo (JPG/PNG, otomatis diperkecil), nama, email, telepon, alamat, NPWP. Tampil di PDF, email, dan halaman bayar. |
| **Penomoran & tarif** | Prefix nomor invoice (format `PREFIX-YYYYMMDD-0001`, counter reset harian) dan tarif per jam default. |
| **Pajak** | PPN default untuk invoice baru (bisa diubah per invoice). |
| **Pembayaran** | Info rekening bank (alternatif transfer manual) dan pesan penutup invoice. |
| **QRIS** | Upload QRIS statis toko ke QRISLY, pilih QRIS aktif, dan atur tampilan kode QR. Lihat [Integrasi](/penggunaan/integrasi#qris-qrisly). |
| **Tampilan PDF & tanda tangan** | Warna aksen, watermark (logo / teks / tanpa), syarat & ketentuan, gambar tanda tangan + nama & jabatan penanda tangan (juga dipakai di kuitansi), dan **Bea meterai kuitansi** — pengingat kotak "Tempel e-Meterai Rp10.000" untuk kuitansi > Rp5 juta (default aktif, lihat [Pembayaran](/panduan/pembayaran#bea-meterai)). Tombol **Pratinjau PDF** memakai isian yang belum disimpan. |
| **Pengingat otomatis** | Hari pengingat sebelum jatuh tempo (mis. `3,1` = H-3 & H-1), interval & jumlah maksimal pengingat setelah jatuh tempo (`0` = mati). |
| **Template WhatsApp** | Pesan invoice baru, konfirmasi pembayaran, pengingat sebelum & sesudah jatuh tempo. Kosongkan untuk memakai template bawaan. |

### Placeholder template WhatsApp

| Placeholder | Isi | Tersedia di |
|---|---|---|
| `{{client_name}}` | Nama klien | semua |
| `{{company_name}}` | Nama perusahaan | semua |
| `{{invoice_number}}` | Nomor invoice | semua |
| `{{project}}` | Nama proyek (mis. `Toko Online › Aplikasi Mobile`), kosong bila tanpa proyek | semua |
| `{{total}}` | Total invoice | invoice baru |
| `{{public_link}}` | Link halaman bayar | invoice baru, pengingat |
| `{{amount}}` | Nominal (pembayaran / cicilan / sisa) | konfirmasi bayar, pengingat |
| `{{remaining}}` | Sisa tagihan | konfirmasi bayar |
| `{{status}}` | `Lunas` / `Sebagian terbayar` | konfirmasi bayar |
| `{{due_date}}` | Tanggal jatuh tempo | pengingat |
| `{{installment}}` | `Cicilan ke-N` (kosong untuk invoice penuh) | pengingat |

### Akun admin

Registrasi publik dimatikan. Akun pemilik pertama dibuat lewat **wizard instalasi** (`/setup`) yang
otomatis muncul selama belum ada akun sama sekali. Alternatifnya, buat atau reset akun lewat terminal:

```bash
php artisan app:create-admin                       # interaktif
php artisan app:create-admin --email=saya@domain.com --name="Nama Saya"
```

Menjalankan perintah ini dengan email yang sudah ada akan **mengganti password-nya** (berguna bila lupa password).
Fitur 2FA dan passkey tersedia di **Pengaturan → Keamanan**.

Akun untuk anggota tim (admin atau staf) cukup ditambahkan dari aplikasi lewat
**Pengaturan → Pengguna** — tanpa terminal. Lihat [Pengguna & role](/panduan/pengguna).
