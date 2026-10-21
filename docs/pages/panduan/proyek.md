---
title: "Proyek & sub-proyek"
description: "Mengelompokkan pekerjaan klien: Klien → Proyek → Sub-proyek."
---

Kelompokkan pekerjaan klien dalam dua level:

```
PT Maju Jaya (klien)
└─ Toko Online (proyek)
   ├─ Aplikasi Mobile (sub-proyek)
   └─ Dashboard Admin (sub-proyek)
```

Buat proyek dari menu **Proyek** atau dari halaman detail klien. Invoice, baris item invoice, dan sesi Time Tracker
bisa ditautkan ke **proyek** saja atau langsung ke **sub-proyek**.

| Pengaturan | Keterangan |
|---|---|
| Status | **Aktif**, **Selesai**, atau **Diarsipkan**. Proyek yang diarsipkan tidak muncul di pilihan form. |
| Tarif per jam | Opsional. Urutan tarif Time Tracker: sub-proyek → proyek → klien → tarif default. |

**Angka di halaman proyek:**

- **Ditagih / Terbayar / Sisa** dihitung dari invoice yang ditautkan langsung ke proyek. Angka proyek utama sudah
  termasuk semua sub-proyeknya. Invoice draft dan dibatalkan tidak dihitung.
- **Nilai pekerjaan** = jumlah baris item per sub-proyek (sebelum diskon & pajak). Satu invoice "Toko Online" yang berisi
  item Aplikasi Mobile dan Dashboard Admin dibagi ke masing-masing sub-proyek lewat angka ini.
- **Jam tercatat** dari sesi Time Tracker yang ditautkan.

Proyek yang sudah dipakai invoice atau Time Tracker tidak bisa dihapus, jadi **arsipkan** saja.

## Anggota & task

Setiap proyek utama punya daftar **anggota** (kartu **Anggota** di halaman detail proyek). Staf
hanya melihat proyek yang ia ikuti beserta sub-proyeknya — lihat [Pengguna & role](/panduan/pengguna).
Pekerjaan di dalam proyek dibagi menjadi [task](/panduan/task); ringkasannya tampil di halaman
detail proyek.
