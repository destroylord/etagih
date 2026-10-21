---
title: "Task & board"
description: "Membagi pekerjaan proyek menjadi task, memantau di board, mencatat waktu, lalu menagihnya."
---

Task adalah unit pekerjaan di dalam proyek atau sub-proyek. Alurnya menyatu dengan penagihan:

```
Task dibuat → dikerjakan (Time Tracker) → Selesai → ditagih ke invoice
```

Buka menu **Task** (di HP: tab **Task** di navigasi bawah).

## Membuat task

Klik **Task baru** (atau tombol **+** di HP → **Task baru**). Isian:

| Kolom              | Keterangan                                                                 |
| ------------------ | -------------------------------------------------------------------------- |
| Judul & proyek     | Wajib. Task selalu milik satu proyek atau sub-proyek.                       |
| Penanggung jawab   | Admin atau anggota proyek. Ia mendapat notifikasi saat ditugaskan.          |
| Prioritas          | Rendah, Normal, Tinggi, Mendesak.                                          |
| Tanggal mulai & tenggat | Tenggat dipakai untuk pengingat dan pengelompokan "Task saya".        |
| Estimasi           | Jam & menit; dibandingkan dengan waktu yang tercatat.                      |
| Bisa ditagih       | Task selesai yang bisa ditagih muncul di **Ambil dari task** saat membuat invoice. |
| Harga tetap        | Opsional. Jika kosong, task ditagih dari jam kerja × tarif.                 |

Di dalam task ada **checklist**, **komentar**, dan riwayat **sesi waktu**.

## Tiga tampilan

- **Task saya** — task yang ditugaskan ke Anda, dikelompokkan: Terlambat, Hari ini, Minggu ini,
  Nanti, Tanpa tenggat, dan Selesai 7 hari terakhir. Centang untuk menandai selesai.
- **Board** — kolom **To do → Dikerjakan → Review → Selesai**. Seret kartu untuk memindahkan
  status atau mengubah urutan. Di HP, geser per kolom dan gunakan menu **Pindah ke…** pada kartu.
- **List** — tabel semua task dengan filter klien, proyek, penanggung jawab, prioritas, dan tenggat.

Halaman detail proyek juga menampilkan ringkasan task proyek tersebut beserta tautan ke board-nya.

## Mencatat waktu dari task

Tekan **▶** pada kartu task atau di panel detail. Sesi Time Tracker langsung dimulai dengan
klien, proyek, deskripsi, dan tarif dari task tersebut. Task yang masih *To do* otomatis
pindah ke *Dikerjakan*. Di halaman Time Tracker, Anda juga bisa memilih task saat memulai sesi.

## Menagih task

Saat membuat atau mengubah invoice, pilih klien lalu klik **Ambil dari task**. Daftar berisi task
**selesai**, **bisa ditagih**, dan **belum ditagih** milik klien tersebut.

- Invoice **harga tetap**: satu baris per task seharga *harga tetap* task, atau jam × tarif bila
  harga tetap kosong.
- Invoice **per jam**: jam diambil dari sesi waktu task.

Sesi waktu task ikut ditandai tertagih, jadi jam yang sama tidak bisa ditagih dua kali. Task yang
sudah ditagih tidak bisa dihapus. Jika baris dihapus dari invoice, invoice draft dihapus, atau
invoice dibatalkan, task kembali berstatus belum ditagih.

## Hak akses

| Tindakan                         | Siapa                                           |
| -------------------------------- | ----------------------------------------------- |
| Melihat & berkomentar            | Admin dan anggota proyek                        |
| Mengubah & memindahkan           | Admin, pembuat task, atau penanggung jawab      |
| Menghapus                        | Admin atau pembuat task (bila belum ditagih)    |

## Notifikasi

Ikon lonceng di header menampilkan notifikasi: ditugaskan task, komentar baru, tenggat besok,
dan task terlambat. Notifikasi yang sama dikirim ke email, kecuali dimatikan di
**Pengaturan → Profil → Kirim notifikasi task ke email**.

Pengingat tenggat dikirim setiap hari pukul 07.00 oleh scheduler — pastikan
[scheduler berjalan](/panduan/otomatisasi).
