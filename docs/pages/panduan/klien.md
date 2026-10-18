---
title: "Klien"
description: "Data klien, kunci akses portal, import, dan export Excel."
---

Menu **Klien** menyimpan data penagihan: nama, email, telepon/WhatsApp, alamat, catatan, dan **tarif per jam** khusus klien.

- **Nomor WhatsApp** dipakai untuk notifikasi; format `08…` atau `62…` sama-sama diterima.
- **Kunci akses portal**: setiap klien punya kunci untuk masuk [portal klien](/panduan/portal-klien). Kunci hanya ditampilkan
  **sekali** saat dibuat. Bila hilang, klik **Buat kunci akses baru**; kunci lama langsung tidak berlaku.
- **Hapus klien** hanya bisa bila klien belum punya invoice, supaya riwayat keuangan tidak hilang.
- **Export Excel** di halaman detail klien berisi ringkasan, rincian item per invoice, riwayat pembayaran, dan daftar produk.

## Import klien

Punya daftar klien di Excel atau aplikasi lain? Klik **Import** di halaman **Klien**.

1. **Unggah file** `.xlsx` atau `.csv` (maks. 2 MB / 5.000 baris) dengan cara tarik & lepas atau pilih file. Unduh
   **Template Excel** / **Template CSV** dari dialog yang sama; sheet **Petunjuk** di template menjelaskan setiap kolom.
2. **Periksa pratinjau.** Setiap baris diberi status **Baru**, **Perbarui** / **Lewati** (klien sudah ada), atau **Error**
   beserta alasannya. Pada tahap ini belum ada data yang disimpan.
3. **Konfirmasi** dengan tombol **Import**. Ringkasan jumlah klien yang dibuat, diperbarui, dan dilewati muncul sebagai notifikasi.

| Kolom | Wajib | Alias header yang dikenali |
| --- | --- | --- |
| `nama` | Ya | `name` |
| `email` | Tidak | `e-mail` |
| `telepon` | Tidak | `phone`, `hp`, `no hp`, `whatsapp`, `wa` |
| `alamat` | Tidak | `address` |
| `catatan` | Tidak | `notes` |
| `tarif_per_jam` | Tidak | `tarif`, `hourly_rate`, `rate` |

- Header tidak membedakan huruf besar/kecil; kolom lain diabaikan. CSV boleh memakai pemisah koma, titik koma, atau tab.
- Telepon dirapikan otomatis (hanya angka dan `+`). Tarif boleh ditulis `150000`, `150.000`, atau `Rp 150.000`.
- **Klien yang sudah ada** dikenali dari email yang sama, lalu nomor telepon yang sama (`08…` = `62…`), lalu nama yang
  persis sama — selama emailnya tidak berbeda. Centang **Perbarui klien yang sudah ada** untuk menimpa datanya; kolom
  yang kosong di file tidak menghapus data lama. Tanpa centang, baris tersebut dilewati.
- Baris dengan nama kosong, email tidak valid, tarif tidak valid, atau duplikat di dalam file yang sama akan dilewati.
- Klien hasil import otomatis mendapat kunci akses portal, tetapi kuncinya **tidak ditampilkan**. Klik
  **Buat kunci akses baru** pada klien tersebut saat ingin membagikan akses portal.
- Pratinjau berlaku 30 menit; setelah itu unggah ulang file.
