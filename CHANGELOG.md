# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/)
dan versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

Bagian **Perlu tindakan** berisi langkah yang wajib dilakukan saat update.

## [Unreleased]

## [1.1.0] — 2026-10-18

Nama baru: **eTagih** (sebelumnya MyInvoice). Fokus proyek: aplikasi self-host.

### Perlu tindakan

- Jalankan migrasi (`php artisan migrate`, otomatis di Docker bila `RUN_MIGRATIONS=true`).
- User pertama otomatis menjadi **Pemilik**; user lain menjadi **Admin**. Atur ulang role di Pengaturan → Pengguna bila perlu.
- Docker: kini disarankan memakai image siap pakai. Tambahkan `ETAGIH_IMAGE=ghcr.io/<owner>` di `.env`, lalu
  `docker compose pull && docker compose up -d`. Build sendiri tetap bisa dengan `--build`.
- Nama database/folder contoh di dokumentasi berubah dari `myinvoice` ke `etagih`; instalasi lama tidak perlu mengganti apa pun.

### Fitur baru

- **Penawaran harga (quotation):** nomor `PNW-…`, kuantitas per item, PPN/PPh, masa berlaku, kirim via WhatsApp & email
  (PDF terlampir), halaman publik untuk klien **menerima / menolak** online, notifikasi ke admin, ubah jadi invoice
  sekali klik, kedaluwarsa otomatis.
- **Kuitansi pembayaran:** nomor `KWT-…` untuk setiap pembayaran berhasil, PDF A5 (terbilang, tanda tangan),
  dikirim otomatis ke email klien, bisa diunduh admin dan klien dari halaman bayar.
- **Pengingat bea meterai:** kotak "Tempel e-Meterai Rp10.000" pada kuitansi di atas Rp5 juta (bisa dimatikan).
- **PPh 23:** potongan PPh oleh klien badan usaha; total yang dibayar = DPP + PPN − PPh, tampil di form, invoice, PDF, dan halaman bayar.
- **Pengguna & role:** Pemilik, Admin, Staf; undang lewat email atau password sementara; nonaktifkan akun;
  serah-terima kepemilikan. Staf tidak bisa membuka pengaturan, laporan, export, membatalkan invoice, atau menghapus klien/proyek.
- **Time Tracker per pengguna:** setiap pengguna punya satu sesi aktif sendiri; sesi hanya bisa dikendalikan pencatatnya atau admin.
- **Import klien** dari Excel/CSV dengan pratinjau, deteksi duplikat (email/HP/nama), dan opsi perbarui data lama.
- **Wizard setup** di browser saat pertama dibuka (akun pemilik + profil bisnis), opsional dilindungi `SETUP_TOKEN`.
- **Status sistem:** cek scheduler, queue, email, WhatsApp, QRIS, storage, keamanan; tombol uji kirim email & WhatsApp.
- **Notifikasi update** dari rilis GitHub (bisa dimatikan dengan `ETAGIH_UPDATE_CHECK=false`).
- **Unduh backup** (database + file upload) dari aplikasi; teruji backup → restore pada MySQL 8.
- **Image Docker siap pakai** di GitHub Container Registry untuk amd64 & arm64.

### Perbaikan

- Menghapus invoice draft kini mengembalikan sesi Time Tracker ke status "Belum ditagih".
- Logo & favicon bawaan Laravel diganti identitas eTagih.

### Dihapus

- Rencana versi cloud (roadmap & CLA). eTagih difokuskan untuk self-host.

## [1.0.0] — 2026-10-18

Rilis open source pertama.

### Fitur

- **Invoice:** mode harga tetap & per jam, bayar penuh atau cicilan 2–24 kali, diskon nominal/persen, PPN,
  invoice berulang (mingguan–tahunan, opsional kirim otomatis), duplikat, pembatalan (void), PDF & export Excel.
- **Klien → Proyek → Sub-proyek:** invoice, item, dan sesi time tracker bisa ditautkan ke proyek/sub-proyek;
  statistik dan laporan per proyek; PDF dikelompokkan per sub-proyek.
- **Pembayaran:** QRIS dinamis via QRISLY (upload QRIS dari aplikasi, beberapa QRIS dengan satu aktif),
  verifikasi ulang status ke gateway, pencatatan pembayaran manual, alokasi cicilan otomatis.
- **Tampilan kode QR** yang bisa diatur (warna, bentuk, bingkai, logo) dengan validasi kontras.
- **Notifikasi:** WhatsApp (Fonnte) dan email dengan PDF terlampir; pengingat sebelum & sesudah jatuh tempo dengan
  batas interval dan jumlah.
- **PDF profesional:** kop, watermark, terbilang, QR pembayaran, syarat & ketentuan, tanda tangan, nomor halaman,
  pratinjau langsung dari Pengaturan.
- **Time tracker** dengan jeda, pembulatan, antrean offline, dan tarif bertingkat (sub-proyek → proyek → klien → default).
- **Laporan:** pendapatan bulanan, umur piutang, klien teratas, per proyek.
- **Portal klien** dengan kunci akses (disimpan sebagai hash).
- **Instalasi Docker** ringan untuk VPS 1 GB (Caddy + PHP-FPM + MariaDB, HTTPS otomatis) dan skrip backup.
- Perintah `php artisan app:create-admin`.

### Keamanan

- Webhook QRISLY tidak dipercaya mentah-mentah: status lunas selalu dikonfirmasi ke API gateway.
- Halaman bayar menolak invoice draft/dibatalkan/lunas; invoice draft tidak bisa dibuka publik.
- Klien yang masih punya invoice tidak bisa dihapus (riwayat keuangan terlindungi).
