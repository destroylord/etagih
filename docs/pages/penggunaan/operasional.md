---
title: "Operasional"
description: "Update, backup & restore, log, dan troubleshooting."
---

## Komponen yang harus berjalan

| Komponen | Docker | Manual | Fungsi |
|---|---|---|---|
| Web (PHP-FPM + web server) | `web`, `app` | Nginx + PHP-FPM | Aplikasi |
| Queue worker | `worker` | Supervisor `queue:work` | WA konfirmasi pembayaran |
| Scheduler | `scheduler` | cron `schedule:run` tiap menit | Status terlambat, pengingat, invoice berulang, bersih-bersih sesi |
| Database | `db` | MariaDB/MySQL | Data |

Cek jadwal tugas: `php artisan schedule:list`.

## Status sistem

**Pengaturan → Status sistem** (khusus pemilik & admin) memeriksa instalasi Anda dan menandai setiap
komponen **OK**, **Perlu dicek**, atau **Bermasalah** — lengkap dengan penjelasan, cara memperbaiki, dan
tautan ke panduan terkait.

| Pemeriksaan | Yang dicek |
|---|---|
| Versi eTagih | Versi yang berjalan & apakah ada rilis baru. |
| PHP | Versi 8.4+ dan ekstensi penting (`zip`, `gd`, `intl`, `bcmath`). |
| Mode aplikasi | `APP_ENV` / `APP_DEBUG` — debug yang aktif di produksi ditandai bermasalah. |
| APP_URL | Memakai HTTPS dan sama dengan domain yang dibuka. |
| Zona waktu | Peringatan bila masih `UTC`. |
| Database | Koneksi & versi server database. |
| Folder storage / file publik | Folder bisa ditulis; `storage:link` (manual) atau volume Docker untuk logo & QRIS. |
| Ruang disk | Peringatan di bawah 1 GB, bermasalah di bawah 200 MB. |
| Scheduler | Scheduler mencatat "detak" tiap menit; peringatan bila tidak ada detak > 3 menit. |
| Queue worker | Scheduler mengirim job kecil tiap menit; bila tidak diproses > 5 menit, worker dianggap mati. Juga menampilkan jumlah job gagal. |
| Email / WhatsApp / QRIS | Konfigurasi `.env` & QRIS aktif. |

Di halaman yang sama ada tombol **Kirim email uji** (ke email akun Anda; pesan error SMTP ditampilkan bila
gagal) dan **Kirim WA uji** (ke nomor yang Anda isi) untuk memastikan kredensial benar.

:::note

Pemeriksaan queue worker bergantung pada scheduler. Bila scheduler mati, worker juga akan terlihat
bermasalah — perbaiki scheduler lebih dulu.

:::

## Notifikasi update

eTagih memeriksa [rilis terbaru di GitHub](https://github.com/destroylord/etagih/releases) sekali sehari
(lewat scheduler) dan setiap kali halaman **Status sistem** dibuka (hasil disimpan 12 jam). Bila ada versi
baru, pemilik & admin melihat banner kecil di dashboard (bisa ditutup) dan detailnya di Status sistem,
termasuk tautan catatan rilis. Tombol **Cek sekarang** memaksa pemeriksaan ulang.

Tidak ada data yang dikirim selain permintaan biasa ke `api.github.com`. Matikan dengan
`ETAGIH_UPDATE_CHECK=false`; ganti sumbernya (mis. fork) dengan `ETAGIH_UPDATE_REPO`.

## Update ke versi baru

1. Baca [CHANGELOG](https://github.com/destroylord/etagih/blob/main/CHANGELOG.md), terutama bagian **Perlu tindakan**.
2. **Backup dulu** (lihat di bawah) — paling mudah lewat **Status sistem → Unduh backup**.
3. Update:

   ```bash
   # Docker (image siap pakai)
   git pull                              # docker-compose.yml & konfigurasi terbaru
   docker compose pull                   # image sesuai ETAGIH_VERSION
   docker compose up -d                  # migrasi otomatis bila RUN_MIGRATIONS=true
   docker image prune -f

   # Docker (build sendiri)
   git pull
   docker compose up -d --build

   # Manual
   git pull
   composer install --no-dev --optimize-autoloader
   npm ci --include=dev && npm run build
   php artisan migrate --force
   php artisan optimize
   sudo supervisorctl restart etagih-worker
   ```

## Backup & restore

Yang perlu di-backup: **database** dan **file upload** (`storage/app/public`: logo, tanda tangan, gambar QRIS).
File `.env` simpan terpisah di tempat aman (berisi `APP_KEY`; tanpa itu data terenkripsi seperti 2FA tidak bisa dibuka).

### Unduh backup dari aplikasi

**Pengaturan → Status sistem → Unduh backup** (khusus pemilik & admin) menghasilkan
`etagih-backup-YYYYMMDD-HHMMSS.zip` berisi:

| File | Isi |
|---|---|
| `database.sql` | Dump lengkap MariaDB/MySQL (struktur + data). Untuk instalasi SQLite: `database.sqlite`. |
| `uploads/` | Isi `storage/app/public`: logo, tanda tangan, gambar QRIS. |
| `README.txt` | Versi aplikasi, tanggal backup, dan langkah restore. |

Data tabel sementara (`cache`, `sessions`, `jobs`) tidak ikut — hanya strukturnya. File `.env` **tidak** ikut.
Dump dibuat oleh aplikasi sendiri (tanpa `mysqldump`), jadi untuk database yang sangat besar tetap
gunakan backup dari server di bawah.

### Restore dari zip aplikasi

1. Pasang eTagih **versi yang sama atau lebih baru** dengan `.env` lama (`APP_KEY` harus sama).
   Jangan menjalankan wizard `/setup` / membuat akun dulu.
2. Ekstrak zip, lalu pulihkan database (isi database tujuan akan ditimpa):

   ```bash
   # Docker
   docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < database.sql

   # Manual (MariaDB/MySQL)
   mysql -u USER -p etagih < database.sql

   # SQLite: hentikan aplikasi, salin database.sqlite ke lokasi DB_DATABASE
   ```

3. Pulihkan file upload:

   ```bash
   # Docker
   docker compose cp uploads/. app:/var/www/html/storage/app/public/
   docker compose exec app chown -R www-data:www-data storage/app/public

   # Manual
   cp -r uploads/. /var/www/etagih/storage/app/public/
   php artisan storage:link
   ```

4. Jalankan migrasi (bila versi lebih baru) dan bersihkan cache:

   ```bash
   php artisan migrate --force          # Docker: docker compose exec app php artisan migrate --force
   php artisan optimize:clear && php artisan optimize
   ```

5. Login dengan akun lama, lalu cek **Pengaturan → Status sistem**.

### Backup dari server

**Docker:** `./docker/backup.sh` menyimpan `backups/db-*.sql.gz` dan `backups/storage-*.tar.gz` (14 hari terakhir).
Jadwalkan lewat cron dan salin ke luar server (rclone / object storage). Cara restore ada di
[Instalasi dengan Docker](/memulai/instalasi-docker#6-backup).

**Manual:**

```bash
mysqldump --single-transaction etagih | gzip > db-$(date +%F).sql.gz
tar -czf storage-$(date +%F).tar.gz -C storage/app public
```

Uji restore secara berkala di server lain. Backup yang belum pernah diuji belum tentu bisa dipakai.

## Log

| Lokasi | Isi |
|---|---|
| `storage/logs/laravel-*.log` | Error aplikasi, kegagalan WA/email/QRISLY |
| `docker compose logs -f app worker scheduler web` | Log container |
| `php artisan queue:failed` | Job queue yang gagal (`queue:retry all` untuk mengulang) |

Kata kunci yang berguna saat mencari: `QRISLY`, `WhatsApp (Fonnte)`, `Invoice email failed`.

## Troubleshooting

| Gejala | Kemungkinan penyebab & solusi |
|---|---|
| Notifikasi sukses/gagal tidak muncul setelah aksi | Muat ulang dengan Ctrl+F5 setelah update (aset lama di cache browser). |
| Invoice tidak pernah berubah **Terlambat** / pengingat tidak terkirim | Scheduler tidak berjalan. Cek `schedule:list` dan container `scheduler` / cron. |
| WA konfirmasi pembayaran tidak terkirim | Queue worker mati, atau `WA_API_KEY` salah / device Fonnte terputus. Cek `queue:failed`. |
| Klien sudah bayar QRIS tapi status belum lunas | Webhook belum didaftarkan / URL salah / server tidak bisa diakses publik. Halaman bayar tetap mengecek berkala selama dibuka. |
| "Belum ada QRIS aktif" saat klien klik Bayar | Upload QRIS di Pengaturan → QRIS (atau isi `QRISLY_MERCHANT_ID`). |
| Upload QRIS ditolak | Pesan dari QRISLY ditampilkan di form. Pastikan gambar QRIS jelas, tidak terpotong, ≤ 5 MB, dan `QRISLY_API_KEY` benar. |
| Logo / tanda tangan tidak tampil | Jalankan `php artisan storage:link` (manual) atau pastikan volume `storage` terpasang (Docker). |
| Nomor invoice memakai tanggal kemarin | `APP_TIMEZONE` belum diatur ke `Asia/Jakarta`. |
| Lupa password admin | `php artisan app:create-admin --email=emailmu@domain.com` |
| `502 Bad Gateway` (Docker) | Container `app` gagal start, biasanya `APP_KEY` kosong atau password DB salah. `docker compose logs app`. |
| Sertifikat SSL gagal (Docker) | DNS domain belum mengarah ke server atau port 80/443 tertutup. `docker compose logs web`. |
| Build frontend gagal: paket tidak ditemukan | `NODE_ENV=production` aktif di terminal, jadi gunakan `npm ci --include=dev`. |
