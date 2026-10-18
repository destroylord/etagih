---
title: "Instalasi dengan Docker (VPS / server produksi)"
description: "Menjalankan eTagih di VPS 1 GB dengan image Docker siap pakai, HTTPS otomatis, backup, dan update."
---

Stack: **Caddy** (HTTPS otomatis) → **PHP-FPM** + **queue worker** + **scheduler** → **MariaDB**.
Semua dalam satu `docker-compose.yml`, image berbasis Alpine.

```
Internet ──443──▶ web (Caddy) ──FastCGI──▶ app (PHP-FPM) ──▶ db (MariaDB)
                                           worker  (queue:work)    ─┘
                                           scheduler (schedule:work) ┘
```

Perkiraan RAM saat idle: ±400–550 MB total. Swap 2 GB tetap disarankan.

eTagih menyediakan **image siap pakai** di GitHub Container Registry (`ghcr.io`), jadi VPS tidak perlu
membangun (build) image sendiri — cukup `docker compose pull`. Build sendiri tetap bisa (lihat bagian 3).

---

## 0. Persiapan

- VPS **Ubuntu 22.04 / 24.04**, 1 GB RAM, akses SSH root/sudo.
- Domain: buat **A record** `invoice.domainkamu.com` → IP VPS
  (opsional juga `www.invoice.domainkamu.com`). Tunggu DNS aktif:
  `ping invoice.domainkamu.com` harus mengarah ke IP VPS **sebelum** menjalankan stack
  (Caddy butuh ini untuk mengambil sertifikat SSL).

---

## 1. Siapkan VPS (sekali saja)

```bash
# Update & paket dasar
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ufw

# Swap 2 GB — penting untuk RAM 1 GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf && sudo sysctl --system

# Firewall: SSH + HTTP + HTTPS saja
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# logout lalu login SSH lagi supaya grup docker aktif
```

:::note

Port database **tidak** dibuka ke internet — hanya bisa diakses antar-container.

:::

---

## 2. Ambil file konfigurasi & isi `.env`

Server hanya butuh `docker-compose.yml`, folder `docker/` (konfigurasi Caddy & MariaDB, skrip backup),
dan `.env`. Cara termudah: clone repo — kode aplikasinya sendiri sudah ada di dalam image.

```bash
sudo mkdir -p /opt/etagih && sudo chown $USER: /opt/etagih
git clone https://github.com/destroylord/etagih.git /opt/etagih
cd /opt/etagih

cp .env.production.example .env
nano .env
```

Wajib diisi (ditandai ⚠ di file):

| Variabel | Isi |
|---|---|
| `APP_DOMAIN` | `invoice.domainkamu.com` (tanpa `https://`) |
| `APP_URL` | `https://invoice.domainkamu.com` (harus sama dengan domain) |
| `ACME_EMAIL` | email kamu (notifikasi sertifikat SSL) |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | password acak: `openssl rand -base64 24` |
| `ETAGIH_IMAGE` | prefix image, mis. `ghcr.io/destroylord` (pemilik repo eTagih yang dipakai) |
| `ETAGIH_VERSION` | `latest` (rilis terbaru) atau kunci ke versi tertentu, mis. `1.2.0` |
| `QRISLY_API_KEY` | dari dashboard Collaborator → Developer → API Settings |
| `WA_API_KEY` | token Fonnte |
| `MAIL_*` | SMTP untuk kirim invoice via email |

Disarankan juga mengisi `SETUP_TOKEN` (string acak, mis. hasil `openssl rand -hex 16`) supaya wizard
instalasi hanya bisa dipakai oleh Anda. Lihat [Konfigurasi](/memulai/konfigurasi#instalasi--update).

Ambil image lalu buat `APP_KEY`:

```bash
docker compose pull
docker compose run --rm --no-deps --entrypoint php app artisan key:generate --show
# salin hasilnya (base64:....) ke APP_KEY= di .env
```

---

## 3. Jalankan

```bash
docker compose pull && docker compose up -d
docker compose ps          # semua harus "running" / "healthy"
docker compose logs -f web # lihat Caddy mengambil sertifikat SSL
```

Migrasi database berjalan otomatis saat container `app` start (`RUN_MIGRATIONS=true`).

:::tip{title="Build sendiri (tanpa image siap pakai)"}

Bila ingin memakai kode yang Anda ubah sendiri, build image langsung di server:

```bash
docker compose up -d --build
```

Build butuh RAM lebih — pastikan swap aktif. Alternatif: build di laptop (lihat bagian *Troubleshooting*).

:::

### Wizard instalasi pertama

Buka `https://invoice.domainkamu.com/setup` (atau cukup buka domainnya — selama belum ada akun,
Anda otomatis diarahkan ke sana). Bila `SETUP_TOKEN` diisi, buka
`https://invoice.domainkamu.com/setup?token=ISI_TOKEN`.

1. **Akun pemilik** — nama, email login, password (min. 8 karakter).
2. **Profil bisnis** — nama bisnis, email & telepon, prefix nomor invoice, PPN default.

Setelah selesai Anda langsung masuk ke dashboard. Wizard otomatis terkunci setelah akun pertama dibuat.
Lanjutkan di **Pengaturan → Invoice**: logo, rekening, **QRIS** (upload QRIS toko), tampilan PDF & tanda tangan.
Lalu buka **Pengaturan → Status sistem** untuk memastikan semua komponen hijau.

Alternatif lewat terminal (mis. bila wizard tidak bisa diakses):

```bash
docker compose exec app php artisan app:create-admin
# isi nama, email, password (min. 8 karakter)
```

---

## 4. Hubungkan layanan luar

- **QRISLY webhook**: dashboard RajaOngkir → Webhook → QRISLY → *Outbound Webhook* →
  `https://invoice.domainkamu.com/webhook/qrisly` → Simpan.
- **Mode produksi QRIS**: setelah uji coba sandbox berhasil, ubah `QRISLY_IS_PRODUCTION=true`
  di `.env` lalu muat ulang konfigurasi (lihat bagian *Mengubah .env*).
- **Fonnte**: pastikan device WhatsApp terhubung di dashboard Fonnte. Uji dengan tombol
  **Kirim WA uji** di **Pengaturan → Status sistem** (ada juga **Kirim email uji**).

Uji alur lengkap sekali: buat invoice → kirim → buka link bayar dari HP → bayar → status lunas.

---

## 5. Update aplikasi

eTagih memeriksa rilis baru sekali sehari. Bila ada, admin melihat banner di dashboard dan detailnya di
**Pengaturan → Status sistem**.

:::note

Sebelum update, baca [CHANGELOG](https://github.com/destroylord/etagih/blob/main/CHANGELOG.md) dan buat backup (lihat bagian 6).

:::

```bash
cd /opt/etagih
git pull                         # ambil docker-compose.yml & konfigurasi terbaru
docker compose pull              # ambil image versi baru (sesuai ETAGIH_VERSION)
docker compose up -d             # migrasi otomatis jalan saat app start
docker image prune -f            # buang image lama (hemat disk)
```

Bila `ETAGIH_VERSION` dikunci ke versi tertentu (mis. `1.1.0`), ubah dulu ke versi baru di `.env`.
Bila memakai build sendiri: `git pull && docker compose up -d --build`.

### Mengubah `.env`

Konfigurasi di-cache saat container start, jadi cukup:

```bash
docker compose up -d --force-recreate app worker scheduler
```

---

## 6. Backup

**Dari aplikasi:** **Pengaturan → Status sistem → Unduh backup** menghasilkan satu file `.zip`
(database + file upload + `README.txt` berisi cara restore). Cocok untuk backup manual sebelum update.

**Otomatis dari server:**

```bash
chmod +x docker/backup.sh
./docker/backup.sh               # hasil di ./backups (db + file upload)

# Otomatis tiap hari jam 02:00
crontab -e
0 2 * * * cd /opt/etagih && ./docker/backup.sh >> /var/log/etagih-backup.log 2>&1
```

Simpan salinan backup di luar VPS (Google Drive / S3 / laptop), misalnya dengan `rclone`.

**Restore dari `docker/backup.sh`:**

```bash
gunzip -c backups/db-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'
docker compose exec -T app tar -C /var/www/html/storage/app -xzf - < backups/storage-YYYYMMDD-HHMMSS.tar.gz
```

**Restore dari zip yang diunduh di aplikasi:** lihat [Operasional → Backup & restore](/penggunaan/operasional#backup--restore).

---

## 7. Operasional sehari-hari

Cara tercepat: **Pengaturan → Status sistem** menampilkan status scheduler, queue worker, email,
WhatsApp, QRIS, database, dan ruang disk. Lewat terminal:

```bash
docker compose ps                          # status container
docker stats --no-stream                   # pemakaian RAM/CPU
docker compose logs -f app worker          # log container
docker compose exec app sh -c 'tail -n 100 storage/logs/laravel-*.log'   # log aplikasi
docker compose exec app php artisan queue:failed     # job gagal (mis. WA)
docker compose exec app php artisan schedule:list    # jadwal tugas
docker compose restart worker              # restart worker
```

---

## 8. Troubleshooting

| Gejala | Penyebab umum & solusi |
|---|---|
| Situs tidak bisa dibuka / SSL error | DNS belum mengarah ke VPS, atau port 80/443 tertutup. Cek `docker compose logs web`. |
| `502 Bad Gateway` | Container `app` mati/restart. Cek `docker compose logs app` (sering: `APP_KEY` kosong, DB password salah). |
| `docker compose pull` gagal (*not found* / *denied*) | `ETAGIH_IMAGE` / `ETAGIH_VERSION` salah, atau image belum dipublikasikan. Cek nama image di halaman *Packages* repo GitHub. |
| Build gagal / VPS hang saat build | RAM habis — pakai image siap pakai (`docker compose pull`), atau pastikan swap aktif (`free -h`). |
| Wizard `/setup` meminta token | `SETUP_TOKEN` diisi di `.env` — buka `/setup?token=ISI_TOKEN`. |
| WA konfirmasi tidak terkirim | `docker compose logs worker`, `php artisan queue:failed`, cek `WA_API_KEY`. |
| Pengingat / overdue tidak jalan | `docker compose logs scheduler`, `php artisan schedule:list`. |
| Pembayaran QRIS tidak berubah lunas | Webhook belum didaftarkan / URL salah; polling halaman bayar tetap jadi cadangan. |
| Gambar logo/QRIS 404 | Pastikan volume `storage` terpasang di `web` & `app` (`docker compose config`). |

### Build di laptop (bila VPS kewalahan)

```bash
# di laptop (Docker Desktop), dengan ETAGIH_IMAGE & ETAGIH_VERSION yang sama seperti di VPS
docker compose build
docker save ghcr.io/destroylord/etagih-app:latest ghcr.io/destroylord/etagih-web:latest | gzip > etagih-images.tar.gz
scp etagih-images.tar.gz user@VPS:/opt/etagih/

# di VPS
gunzip -c etagih-images.tar.gz | docker load
docker compose up -d --no-build
```
