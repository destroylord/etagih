---
title: "Pembayaran"
description: "Halaman bayar klien, QRIS, kuitansi, bea meterai, dan aturan pencatatan pembayaran."
---

## Halaman bayar untuk klien

Setiap invoice punya link publik `https://domainkamu/pay/<token>`. Link ini dikirim lewat WA/email dan ada di halaman
detail invoice. Klien tidak perlu login.

1. Klien membuka link dan menekan **Bayar** (seluruh sisa tagihan, atau per cicilan).
2. QRIS dibuat saat itu juga dari QRIS aktif. Nominal bisa bertambah beberapa rupiah (kode unik), dan QR punya batas waktu.
   Bila kedaluwarsa, klien cukup membuat QR baru.
3. Setelah dibayar, status berubah otomatis lewat webhook QRISLY (atau pengecekan berkala dari halaman bayar).
4. Klien menerima konfirmasi WhatsApp dan email berisi kuitansi (PDF).

Klien juga bisa menyimpan gambar QR untuk dipindai dari perangkat lain, atau memakai info transfer bank.

## Kuitansi

Setiap pembayaran yang **berhasil** (QRIS maupun dicatat manual) otomatis mendapat kuitansi bernomor.

- **Nomor**: `KWT-YYYYMMDD-0001` — tanggal = tanggal bayar, urutan di-reset tiap hari. Pembayaran manual bertanggal
  mundur memakai urutan tanggal tersebut. Pembayaran sukses yang tercatat sebelum fitur ini ada diberi nomor otomatis
  saat migrasi (urut tanggal bayar).
- **Isi**: judul KUITANSI, nomor & tanggal, *Telah terima dari* (klien), *Uang sejumlah* (terbilang), *Untuk
  pembayaran* (nomor invoice, proyek, cicilan ke-N), nominal, metode (QRIS / Transfer bank / Tunai — "Tunai" bila
  catatan pembayaran manual memuat kata *tunai* atau *cash*), dan tanda tangan dari Pengaturan.
- **Admin**: di detail invoice → *Riwayat pembayaran*, klik **Kuitansi** pada pembayaran yang berhasil.
- **Klien**: di halaman bayar muncul bagian *Kuitansi pembayaran* dengan tautan **Unduh kuitansi** untuk setiap
  pembayaran yang berhasil. Tautan hanya berlaku untuk invoice pemilik link tersebut.
- **Email**: setelah pembayaran berhasil, kuitansi (PDF terlampir) dikirim otomatis lewat antrean ke email klien bila
  diisi — sekali per pembayaran. Gagal kirim hanya dicatat di log dan tidak memengaruhi status pembayaran.

### Bea meterai

Sesuai UU No. 10 Tahun 2020, dokumen penerimaan uang dengan nilai **lebih dari Rp5.000.000** wajib bermeterai
**Rp10.000**. Bila pengingat aktif (**Pengaturan → Tampilan PDF & tanda tangan → Bea meterai kuitansi**, default aktif):

- kuitansi > Rp5 juta menampilkan kotak putus-putus **"Tempel e-Meterai Rp10.000"** di samping tanda tangan;
- detail invoice dengan total > Rp5 juta menampilkan pengingat untuk menyediakan e-Meterai.

Aplikasi tidak membubuhkan e-Meterai sendiri — beli dan tempel lewat distributor resmi e-Meterai sebelum kuitansi
diserahkan.

## Aturan pencatatan

- Pembayaran tanpa pilihan cicilan dialokasikan ke **cicilan paling awal** yang belum lunas.
- Satu transaksi QRIS tidak pernah tercatat dua kali, walau webhook datang berulang.
- Halaman bayar menolak pembayaran untuk invoice **draft**, **dibatalkan**, atau yang sudah **lunas**.
