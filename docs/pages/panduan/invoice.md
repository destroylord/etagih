---
title: "Invoice"
description: "Membuat, mengirim, dan mengelola invoice: cicilan, diskon, PPN, PPh 23, berulang."
---

## Membuat invoice

**Invoice → Buat Invoice.** Semua invoice baru berstatus **Draft** dan belum terlihat oleh klien.

| Pilihan | Keterangan |
|---|---|
| **Klien** | Pilih klien, atau isi klien baru langsung di form. |
| **Proyek** | Opsional. Bila proyek punya sub-proyek, setiap baris item bisa diarahkan ke sub-proyek tertentu, dan PDF akan mengelompokkan item per sub-proyek dengan subtotal. |
| **Mode** | **Uraian jasa** (harga per item), atau **Per jam**: jam diambil dari sesi Time Tracker yang dipilih, atau diketik manual. |
| **Skema** | **Bayar penuh**, atau **Cicilan** 2–24 kali dengan jarak minimal 7 hari. Total dibagi rata; selisih pembulatan masuk ke cicilan terakhir. |
| **Diskon** | Nominal (Rp) atau persen. |
| **PPN** | Persen, dihitung dari subtotal setelah diskon. Default dari Pengaturan. |
| **PPh 23 dipotong klien** | Persen (0–15, pilihan cepat 0% / 2%). Isi bila klien berbentuk badan usaha yang memotong PPh 23 (umumnya 2% untuk jasa). Klien menyetor PPh ke kantor pajak dan memberi Anda bukti potong. |
| **Berulang** | Mingguan / bulanan / 3 bulanan / tahunan. Invoice baru dibuat otomatis tiap periode (dihitung dari tanggal terbit, mulai saat invoice dikirim), opsional langsung dikirim. |
| **Catatan** | Dicetak di PDF di atas syarat & ketentuan. |

Rumus total:

```
DPP           = subtotal − diskon
PPN           = DPP × tarif PPN
PPh 23        = DPP × tarif PPh 23
Total tagihan = DPP + PPN
Total dibayar = DPP + PPN − PPh 23
```

Tanpa PPh 23, total dibayar sama dengan total tagihan. Bila PPh 23 diisi, **total dibayar** (nilai bersih) yang menjadi
dasar sisa tagihan, cicilan, QRIS, dan laporan. Contoh: jasa Rp10.000.000, PPN 11%, PPh 23 2% → total tagihan
Rp11.100.000, PPh dipotong Rp200.000, klien membayar Rp10.900.000. Jangan lupa meminta **bukti potong PPh 23** dari
klien sebagai kredit pajak Anda. PPh 23 ikut tersalin saat invoice diduplikat.

## Status invoice

| Status | Arti |
|---|---|
| **Draft** | Belum dikirim. Bisa diedit & dihapus. Link bayar belum aktif. |
| **Terkirim** | Sudah dikirim, belum ada pembayaran. |
| **Sebagian** | Sebagian sudah dibayar (cicilan berjalan). |
| **Terlambat** | Melewati jatuh tempo dan belum lunas. Ditandai otomatis tiap malam. |
| **Lunas** | Terbayar penuh. |
| **Dibatalkan** | Dibatalkan (void). Tidak dihitung piutang dan tidak bisa dibayar. |

## Aksi pada invoice

| Aksi | Kapan tersedia | Efek |
|---|---|---|
| **Edit / Hapus** | Draft | Nomor invoice & link bayar tetap sama saat diedit. |
| **Kirim ke klien** | Draft | Status → Terkirim; WhatsApp + email (PDF terlampir) berisi link bayar. |
| **Kirim ulang** | Terkirim / Sebagian / Terlambat | Mengirim ulang WA + email. |
| **Catat pembayaran** | Terkirim / Sebagian / Terlambat | Untuk transfer bank / tunai. Nominal tidak boleh melebihi sisa tagihan. |
| **Batalkan** | Belum ada pembayaran | Status → Dibatalkan, QRIS menunggu dimatikan, sesi Time Tracker dikembalikan, invoice berulang dihentikan. |
| **Duplikat** | Kapan saja | Membuat draft baru dengan isi yang sama (tanggal disesuaikan). |
| **Hentikan berulang** | Invoice berulang | Tidak ada lagi invoice baru yang dibuat. |
| **PDF** | Kapan saja | Unduh atau lihat PDF. |

## PDF invoice

Berisi kop perusahaan (logo, alamat, NPWP), status, info tagihan, rincian item (dikelompokkan per sub-proyek bila ada),
subtotal/diskon/DPP/PPN/total (bila ada PPh 23: *Total tagihan*, *PPh 23 dipotong klien*, *TOTAL DIBAYAR*), **terbilang**, metode pembayaran (QR link bayar + rekening), jadwal cicilan, catatan,
syarat & ketentuan, tanda tangan, dan nomor halaman. Watermark: logo/teks sesuai Pengaturan, **DRAFT** atau
**DIBATALKAN** sesuai status, dan cap **LUNAS** untuk invoice lunas.
