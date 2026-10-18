---
title: "Penawaran harga"
description: "Membuat penawaran (quotation), dikirim ke klien, lalu diubah menjadi invoice."
---

Penawaran harga (quotation) dipakai sebelum pekerjaan dimulai: Anda mengirim harga, klien menyetujuinya
secara online, lalu penawaran diubah menjadi invoice dengan satu klik — tanpa mengetik ulang item.

## Alur singkat

1. **Penawaran → Buat Penawaran.** Isi klien, item, diskon & pajak, masa berlaku. Tersimpan sebagai **Draft**.
2. **Kirim ke klien.** Klien menerima WhatsApp + email (PDF terlampir) berisi link `/q/…`.
3. **Klien menjawab** dari link tersebut: **Terima penawaran** atau **Tolak**. Pemilik & admin mendapat email pemberitahuan.
4. **Ubah jadi invoice.** Invoice draft dibuat dari isi penawaran; periksa lalu kirim seperti invoice biasa.

## Membuat penawaran

| Isian | Keterangan |
|---|---|
| **Klien** | Pilih klien, atau isi calon klien baru langsung di form. |
| **Proyek** | Opsional. Bila proyek punya sub-proyek, tiap baris item bisa diarahkan ke sub-proyek, dan PDF mengelompokkan item per sub-proyek dengan subtotal. |
| **Tanggal & berlaku sampai** | Default berlaku **14 hari** sejak tanggal penawaran (pilihan cepat 7 / 14 / 30 hari). |
| **Item** | Uraian, **qty**, dan harga satuan. Jumlah = qty × harga. Produk bisa dipilih dari katalog. |
| **Diskon** | Nominal (Rp) atau persen. |
| **PPN** | Persen dari DPP (subtotal setelah diskon). Default dari Pengaturan. |
| **PPh 23** | Persen dari DPP yang dipotong klien (umumnya 2% untuk jasa). |
| **Catatan** | Ruang lingkup, estimasi waktu, dll. |
| **Syarat & ketentuan** | Satu syarat per baris — dicetak sebagai daftar bernomor. |

Rumus total sama dengan invoice: `total = (subtotal − diskon) + PPN − PPh 23`.

Nomor penawaran otomatis dengan format `PNW-YYYYMMDD-0001` (urutan direset setiap hari).

## Status penawaran

| Status | Arti |
|---|---|
| **Draft** | Belum dikirim. Bisa diedit & dihapus. Link klien belum aktif. |
| **Menunggu jawaban** | Sudah dikirim; klien bisa menerima atau menolak lewat link. |
| **Diterima** | Klien menyetujui (online, atau ditandai manual). Siap diubah jadi invoice. |
| **Ditolak** | Klien menolak, beserta alasannya bila diisi. |
| **Kedaluwarsa** | Lewat tanggal *berlaku sampai* tanpa jawaban. Ditandai otomatis tiap malam (`quotes:expire`). |
| **Jadi invoice** | Sudah diubah menjadi invoice; tautan ke invoice tampil di halaman penawaran. |

## Aksi pada penawaran

| Aksi | Kapan tersedia | Efek |
|---|---|---|
| **Edit / Hapus** | Draft | Nomor & link penawaran tetap sama saat diedit. |
| **Kirim ke klien** | Draft | Status → Menunggu jawaban; WhatsApp + email (PDF terlampir) berisi link penawaran. |
| **Kirim ulang** | Menunggu jawaban & masih berlaku | Mengirim ulang WA + email. |
| **Tandai diterima / ditolak** | Menunggu jawaban, diterima, ditolak, kedaluwarsa | Untuk jawaban yang Anda terima di luar aplikasi (telepon, chat). Tidak mengirim email notifikasi. |
| **Ubah jadi invoice** | Menunggu jawaban atau diterima | Membuat invoice **draft** lalu membuka halaman edit invoice. |
| **Duplikat** | Kapan saja | Membuat draft baru bertanggal hari ini dengan isi yang sama — cara membuat "revisi" penawaran. |
| **PDF** | Kapan saja | Lihat atau unduh PDF. |

## Halaman penawaran untuk klien

Link `/q/…` bisa dibuka klien tanpa login, nyaman di HP. Klien melihat kop perusahaan, rincian item,
total (termasuk PPN/PPh), masa berlaku, catatan, dan syarat. Tersedia dua tombol:

- **Terima penawaran** — klien boleh mengisi nama dan catatan (opsional). Waktu persetujuan dicatat.
- **Tolak** — klien boleh mengisi alasan.

Setelah dijawab, halaman menampilkan status akhirnya dan tombol tidak tersedia lagi. Penawaran yang sudah
**lewat masa berlaku tidak bisa diterima** — duplikat penawaran untuk mengirim harga terbaru. Penawaran
draft tidak bisa dibuka klien (hanya pratinjau bagi pengguna yang login).

Setiap jawaban klien mengirim email ke semua pengguna **Pemilik** dan **Admin** yang aktif.

## Ubah jadi invoice

Invoice yang dibuat berstatus **Draft**, bertanggal hari ini, dan membawa:

- klien, proyek, dan sub-proyek setiap item;
- diskon, PPN, dan PPh 23 yang sama — sehingga total invoice sama dengan total penawaran;
- catatan penawaran, diawali "Berdasarkan penawaran PNW-…".

Karena invoice tidak memakai kolom qty, item dengan qty ≠ 1 ditulis sebagai satu baris harga tetap,
mis. **"Desain logo (2 × Rp 500.000)"** senilai Rp 1.000.000.

Konversi hanya terjadi sekali: menekan **Ubah jadi invoice** lagi langsung membuka invoice yang sudah dibuat.
Bila invoice tersebut dihapus, penawaran bisa dikonversi ulang.

## PDF penawaran

Berjudul **PENAWARAN HARGA** dengan kop perusahaan (logo, alamat, NPWP), tanggal & **berlaku sampai**,
rincian item dengan kolom **qty**, subtotal/diskon/DPP/PPN/PPh 23/total, **terbilang**, QR & link untuk
menyetujui online (saat menunggu jawaban), catatan, syarat & ketentuan, tanda tangan, dan nomor halaman.
Watermark **DRAFT**, **DITOLAK**, atau **KEDALUWARSA** sesuai status, dan cap **DITERIMA** untuk penawaran
yang disetujui. Warna aksen, logo, dan tanda tangan mengikuti Pengaturan → Invoice.
