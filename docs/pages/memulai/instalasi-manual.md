---
title: "Instalasi manual"
description: "Menjalankan eTagih di laptop atau server tanpa Docker."
---

Panduan ini untuk:

- **Mencoba / mengembangkan di laptop** (Laragon, XAMPP, Herd, atau Linux/macOS), dan
- **Server tanpa Docker** (Nginx + PHP-FPM + Supervisor + cron).

## Prasyarat

| Komponen | Versi |
|---|---|
| PHP | **8.4+** dengan ekstensi `gd` (dukungan JPEG, PNG, WebP, FreeType), `intl`, `pdo_mysql` / `pdo_sqlite`, `bcmath`, `zip`, `exif`, `mbstring`, `pcntl` (khusus Linux, untuk queue worker) |
| Composer | 2.x |
| Node.js | 22+ (hanya untuk build frontend) |
| Database | MariaDB 10.6+ / MySQL 8+ (disarankan) atau SQLite (cukup untuk mencoba) |

Cek ekstensi PHP: `php -m`.

## 1. Ambil kode & dependensi

```bash
git clone https://github.com/destroylord/etagih.git
cd etagih

composer install
npm ci --include=dev

cp .env.example .env
php artisan key:generate
```

:::note

**Windows:** bila `npm ci` tidak memasang paket development, pastikan variabel `NODE_ENV` tidak bernilai `production` di terminal kamu (atau gunakan `--include=dev` seperti di atas).

:::

## 2. Database

**SQLite (paling cepat untuk mencoba):** `.env.example` sudah memakai `DB_CONNECTION=sqlite`.

```bash
touch database/database.sqlite      # Windows PowerShell: ni database/database.sqlite
```

**MariaDB / MySQL:** buat database kosong, lalu ubah `.env`:

```env
DB_CONNECTION=mariadb      # atau mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=etagih
DB_USERNAME=root
DB_PASSWORD=
```

Lalu jalankan migrasi:

```bash
php artisan migrate
php artisan storage:link
```

Akun pemilik dibuat lewat **wizard instalasi** saat aplikasi pertama kali dibuka (lihat langkah 3).
Alternatif lewat terminal: `php artisan app:create-admin`.

## 3. Jalankan

Mode pengembangan (server + queue + Vite hot reload sekaligus):

```bash
composer dev
```

Buka `http://localhost:8000`. Selama belum ada akun sama sekali, halaman depan & login otomatis
diarahkan ke **wizard instalasi** (`/setup`):

1. **Akun pemilik** — nama, email login, password (min. 8 karakter).
2. **Profil bisnis** — nama bisnis, email & telepon, prefix nomor invoice, PPN default.

Setelah selesai Anda langsung masuk ke dashboard. Wizard tidak bisa dibuka lagi begitu akun pertama ada.
Bila `SETUP_TOKEN` diisi di `.env`, wizard meminta token tersebut (buka `/setup?token=ISI_TOKEN`).

Atau tanpa hot reload:

```bash
npm run build
php artisan serve
php artisan queue:work      # terminal terpisah — untuk WA konfirmasi pembayaran
```

### Tugas terjadwal di lokal

Pengingat, status jatuh tempo, dan invoice berulang dijalankan scheduler. Di lokal cukup:

```bash
php artisan schedule:work
```

## 4. Mencoba pembayaran QRIS di lokal

Webhook QRISLY butuh URL publik HTTPS. Gunakan tunnel seperti `ngrok`:

```bash
php artisan serve --port=8000
ngrok http 8000
```

Set `APP_URL` ke URL ngrok, isi `TRUSTED_PROXIES=*` di `.env`, lalu daftarkan
`https://<subdomain>.ngrok-free.app/webhook/qrisly` di dashboard QRISLY. Detail di [Integrasi](/penggunaan/integrasi).

Selama `APP_ENV` bukan `production` dan `QRISLY_IS_PRODUCTION=false`, halaman bayar menampilkan tombol
**simulasi** untuk menguji alur lunas tanpa membayar sungguhan.

---

## Server produksi tanpa Docker

Ringkasan untuk Ubuntu 24.04 dengan Nginx + PHP-FPM. (Docker tetap lebih mudah dirawat — lihat [Instalasi dengan Docker](/memulai/instalasi-docker).)

```bash
sudo apt install -y nginx mariadb-server supervisor \
  php8.4-fpm php8.4-cli php8.4-mysql php8.4-gd php8.4-intl php8.4-bcmath php8.4-zip php8.4-mbstring php8.4-xml php8.4-curl
```

1. Clone ke `/var/www/etagih`, jalankan langkah 1–2 di atas dengan `composer install --no-dev --optimize-autoloader` dan `npm ci --include=dev && npm run build`.
2. Isi `.env` produksi berdasarkan [`.env.production.example`](https://github.com/destroylord/etagih/blob/main/.env.production.example) (ganti `DB_HOST=db` menjadi `127.0.0.1`).
3. Izin folder: `sudo chown -R www-data:www-data storage bootstrap/cache`.
4. Cache konfigurasi: `php artisan optimize`.
5. Buka `https://invoice.domainkamu.com/setup` untuk membuat akun pemilik (disarankan isi `SETUP_TOKEN`
   di `.env` lebih dulu supaya orang lain tidak mendahului Anda), lalu cek **Pengaturan → Status sistem**.

**Nginx** (`/etc/nginx/sites-available/etagih`):

```nginx
server {
    listen 80;
    server_name invoice.domainkamu.com;
    root /var/www/etagih/public;
    index index.php;
    client_max_body_size 12M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    }

    location ~ /\.(?!well-known) { deny all; }
}
```

Aktifkan HTTPS dengan `sudo certbot --nginx -d invoice.domainkamu.com`.

**Queue worker** (`/etc/supervisor/conf.d/etagih-worker.conf`):

```ini
[program:etagih-worker]
command=php /var/www/etagih/artisan queue:work --sleep=3 --tries=3 --max-time=3600
user=www-data
autostart=true
autorestart=true
stopwaitsecs=3600
stdout_logfile=/var/log/etagih-worker.log
```

**Scheduler** (`sudo crontab -u www-data -e`):

```cron
* * * * * cd /var/www/etagih && php artisan schedule:run >> /dev/null 2>&1
```

Setelah setiap update kode: `php artisan migrate --force && php artisan optimize && sudo supervisorctl restart etagih-worker`.
