# Kebijakan keamanan

## Versi yang didukung

Perbaikan keamanan diberikan untuk rilis terbaru (`main` dan tag versi terakhir). Selalu perbarui ke versi terbaru.

## Melaporkan celah keamanan

**Jangan buka issue publik untuk celah keamanan.**

Laporkan secara privat lewat salah satu cara berikut:

- GitHub: tab **Security → Report a vulnerability** (private vulnerability reporting), atau
- Email: **security@etagih.id** <!-- TODO: ganti dengan email keamanan kamu -->

Sertakan:

- Deskripsi celah dan dampaknya (mis. akses data klien lain, pembayaran palsu, XSS).
- Langkah mereproduksi atau proof of concept.
- Versi / commit yang terdampak.

Kami akan mengonfirmasi laporan dalam **3 hari kerja**, memberi perkiraan perbaikan, dan mencantumkan namamu di catatan
rilis (bila berkenan) setelah perbaikan dirilis. Mohon beri waktu wajar untuk perbaikan sebelum mempublikasikan detailnya.

## Ruang lingkup yang menjadi perhatian utama

- Pencatatan pembayaran (webhook, halaman bayar publik `/pay/{token}`).
- Isolasi data: portal klien, kunci akses, link publik.
- Autentikasi admin (login, 2FA, passkey).
- Upload file (logo, tanda tangan, gambar QRIS).

## Untuk yang menjalankan self-host

- Selalu `APP_DEBUG=false` dan HTTPS di produksi.
- Jangan pernah membagikan isi `.env` (`APP_KEY`, API key QRISLY/Fonnte, password database).
- Perbarui eTagih dan dependensinya secara berkala; Dependabot memantau dependensi Composer, npm, dan GitHub Actions di repo resmi.
- Batasi akses SSH dan buka hanya port 80/443 (lihat [Instalasi dengan Docker](docs/pages/memulai/instalasi-docker.md)).
