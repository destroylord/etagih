# Dokumentasi eTagih

Folder ini adalah **situs dokumentasi** eTagih, dibangun dengan [Zudoku](https://zudoku.dev).
Situs yang sudah terbit: **https://destroylord.github.io/etagih/**

## Baca langsung di GitHub

| Bagian | Halaman |
|---|---|
| Pengenalan | [pengenalan.mdx](pages/pengenalan.mdx) |
| Memulai | [Instalasi Docker](pages/memulai/instalasi-docker.md) · [Instalasi manual](pages/memulai/instalasi-manual.md) · [Konfigurasi](pages/memulai/konfigurasi.md) |
| Panduan pengguna | [Ringkasan](pages/panduan/ringkasan.md) · [Klien](pages/panduan/klien.md) · [Proyek](pages/panduan/proyek.md) · [Produk](pages/panduan/produk.md) · [Invoice](pages/panduan/invoice.md) · [Pembayaran](pages/panduan/pembayaran.md) · [Time Tracker](pages/panduan/time-tracker.md) · [Laporan](pages/panduan/laporan.md) · [Portal klien](pages/panduan/portal-klien.md) · [Otomatisasi](pages/panduan/otomatisasi.md) |
| Penggunaan | [Integrasi](pages/penggunaan/integrasi.md) · [Operasional](pages/penggunaan/operasional.md) |
| Pengembang | [Panduan pengembangan](pages/pengembang/pengembangan.md) |

> Tautan antar-halaman di dalam dokumen memakai rute situs (mis. `/memulai/konfigurasi`), jadi paling nyaman dibaca
> lewat situs dokumentasinya.

## Menjalankan situs dokumentasi di lokal

Butuh Node.js 22.12+.

```bash
cd docs
npm ci
npm run dev          # http://localhost:3000 (hot reload)
```

Build statis: `npm run build` → hasil di `docs/dist/`, siap di-host di mana saja (GitHub Pages, Netlify, Cloudflare Pages, Nginx).
Pratinjau hasil build: `npm run preview`.

| Variabel saat build | Keterangan |
|---|---|
| `DOCS_BASE_PATH` | Sub-path hosting, mis. `/etagih` untuk `https://user.github.io/etagih/`. Kosongkan untuk domain sendiri. |
| `DOCS_SITE_URL` | URL publik (sitemap & canonical), mis. `https://docs.etagih.id`. |

Publikasi otomatis ke GitHub Pages diatur di [`.github/workflows/docs.yml`](../.github/workflows/docs.yml)
(aktifkan sekali lewat **Settings → Pages → Source: GitHub Actions**).

## Menulis & menyunting

- Halaman ada di `pages/` (`.md` / `.mdx`) dengan frontmatter `title` dan `description`.
- Urutan sidebar & menu atas diatur di [`zudoku.config.tsx`](zudoku.config.tsx). Halaman baru **wajib** didaftarkan di `navigation`.
- Tautan antar-halaman pakai rute situs tanpa ekstensi: `[Konfigurasi](/memulai/konfigurasi#email)`.
- Kotak catatan: `:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger` (beri baris kosong sebelum & sesudahnya).
- Panduan lengkap sintaks: [zudoku.dev/docs](https://zudoku.dev/docs/markdown/overview).

Setiap halaman punya tautan **Sunting halaman ini** yang langsung membuka file-nya di GitHub.
