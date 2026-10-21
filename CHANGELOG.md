# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/)
dan versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

Bagian **Perlu tindakan** berisi langkah yang wajib dilakukan saat update.

## [Unreleased]

## [1.2.0] — 2026-10-21

Fokus rilis: **kerja tim** dan **nyaman dipakai di HP**.

### Perlu tindakan

- Jalankan migrasi (`php artisan migrate`, otomatis di Docker bila `RUN_MIGRATIONS=true`).
- **Akses staf kini per proyek.** Staf hanya melihat klien, proyek, invoice, penawaran, dan task
  dari proyek tempat ia menjadi anggota. Saat migrasi, semua staf yang ada otomatis dijadikan
  anggota semua proyek yang ada — rapikan di halaman detail proyek → **Anggota**.
- Staf tidak lagi bisa menambah/mengubah/mengimpor klien atau proyek utama (sub-proyek & task tetap bisa).
- Pastikan **scheduler** berjalan untuk pengingat tenggat task (setiap hari 07.00).
- Bahasa bawaan server kini Indonesia (`APP_LOCALE=id`). Tambahkan ke `.env` bila Anda
  menyetel `APP_LOCALE=en` secara eksplisit.
- PWA & passkey membutuhkan HTTPS dan `APP_URL` yang sama persis dengan alamat aplikasi.

### Fitur baru

- **Task:** task per proyek/sub-proyek dengan penanggung jawab, prioritas, tanggal mulai, tenggat,
  estimasi, checklist, dan komentar. Tiga tampilan: **Task saya**, **Board** (drag & drop), **List**.
- **Anggota proyek:** admin menentukan siapa saja yang terlibat di setiap proyek.
- **Task → Time Tracker → invoice:** mulai timer langsung dari task, lalu tagih task selesai lewat
  **Ambil dari task** di form invoice (harga tetap atau jam × tarif, tanpa tagihan ganda).
- **Notifikasi** di aplikasi (ikon lonceng) dan email: ditugaskan, komentar, tenggat besok, terlambat.
  Notifikasi email bisa dimatikan per pengguna.
- **Undangan tim** lewat email berbahasa Indonesia, berlaku 7 hari, dengan status *Menunggu* dan
  tombol kirim ulang. Setelah bergabung, pengguna diajak menambahkan **passkey**.
- **Tampilan mobile:** navigasi bawah (Task · Klien · + · Proyek · Akun), aksi cepat, daftar
  berbentuk kartu, dialog berupa panel dari bawah, filter ringkas.
- **PWA:** pasang eTagih di layar utama HP/desktop, pintasan cepat, halaman offline, dan pemberitahuan
  versi baru. Data tetap selalu diambil dari server.
- Status sistem memeriksa HTTPS (untuk passkey & PWA).

### Perbaikan

- Seluruh tampilan login, keamanan, 2FA, passkey, dan profil kini berbahasa Indonesia, termasuk
  pesan validasi, email verifikasi/reset password, dan tanggal relatif.
- Email reset password berbahasa Indonesia.
- Antrean offline Time Tracker kini ikut mengirim proyek yang dipilih.
- Header dan panel ringkasan form yang *sticky* kini benar-benar menempel saat digulir.

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
