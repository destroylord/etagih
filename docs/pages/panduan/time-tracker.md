---
title: "Time Tracker"
description: "Mencatat jam kerja dan menagihkannya lewat invoice per jam."
---

Stopwatch jam kerja untuk invoice per jam.

1. Pilih klien, (opsional) proyek/sub-proyek, isi deskripsi. Tarif terisi otomatis dari proyek/klien/default.
2. **Mulai → Jeda → Lanjutkan → Selesai.** Hanya boleh ada **satu sesi aktif** pada satu waktu.
3. Saat selesai, durasi dibulatkan ke atas per 15 menit (minimal 15 menit; bisa diatur di `.env`).
4. Sesi selesai berstatus **Belum ditagih**. Pilih sesi-sesi itu saat membuat invoice mode **Per jam**, lalu statusnya
   berubah jadi **Sudah ditagih**. Bila sesi dilepas dari invoice draft, invoice draft dihapus, atau invoice dibatalkan, sesi kembali menjadi **Belum ditagih**.

Stopwatch tetap jalan saat koneksi terputus (antrean offline) dan disinkronkan saat online kembali. Sesi yang lupa
dihentikan lebih dari 24 jam dibatalkan otomatis.
