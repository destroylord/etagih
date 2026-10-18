---
title: "Pengguna & role"
description: "Menambah akun staf dan mengatur hak akses: pemilik, admin, staf."
---

Satu instalasi eTagih bisa dipakai bersama tim. Setiap orang punya akun sendiri dengan
salah satu dari tiga role. Kelola semuanya di **Pengaturan → Pengguna** (hanya terlihat oleh
pemilik dan admin).

## Role & hak akses

| Kemampuan                                                              | Pemilik | Admin | Staf |
| ---------------------------------------------------------------------- | :-----: | :---: | :--: |
| Membuat, mengubah, dan mengirim invoice & penawaran                     |   ✅    |  ✅   |  ✅  |
| Mencatat pembayaran                                                     |   ✅    |  ✅   |  ✅  |
| Menambah & mengubah klien, proyek, dan produk                           |   ✅    |  ✅   |  ✅  |
| Time tracker (stopwatch milik sendiri)                                  |   ✅    |  ✅   |  ✅  |
| Menghapus klien atau proyek                                             |   ✅    |  ✅   |  ❌  |
| Membatalkan invoice                                                     |   ✅    |  ✅   |  ❌  |
| Ekspor Excel (invoice & klien) dan halaman Laporan                      |   ✅    |  ✅   |  ❌  |
| Pengaturan invoice, QRIS, dan Status sistem                             |   ✅    |  ✅   |  ❌  |
| Menambah, mengubah, menonaktifkan, dan menghapus **staf**               |   ✅    |  ✅   |  ❌  |
| Menambah, mengubah, menonaktifkan, dan menghapus **admin**              |   ✅    |  ❌   |  ❌  |
| Mengalihkan kepemilikan                                                 |   ✅    |  ❌   |  ❌  |

- **Pemilik** — hanya ada satu. Biasanya akun pertama yang dibuat saat instalasi.
- **Admin** — akses penuh ke aplikasi, tetapi hanya bisa mengelola akun staf.
- **Staf** — cocok untuk tim operasional: menagih dan mencatat pembayaran, tanpa akses ke
  pengaturan, laporan, maupun tindakan yang menghapus data.

:::note

Pembatasan dicek di server. Jika staf membuka tautan halaman admin secara langsung, aplikasi
menampilkan pesan **403 – Halaman ini hanya untuk admin**.

:::

## Menambah pengguna

1. Buka **Pengaturan → Pengguna**, klik **Tambah pengguna**.
2. Isi nama dan email (email harus unik).
3. Pilih role. Admin hanya bisa menambah staf; pemilik bisa menambah admin maupun staf.
4. Pilih cara mengatur password:
   - **Kirim email untuk mengatur password** — pengguna menerima tautan dan memilih password
     sendiri. Membutuhkan [konfigurasi email](/memulai/konfigurasi) yang berfungsi. Jika email
     gagal terkirim, akun tetap dibuat dan muncul peringatan; kirim ulang lewat menu
     **Kirim reset password** atau buat akun baru dengan password sementara.
   - **Buat password sementara** — aplikasi membuat password acak 12 karakter dan
     menampilkannya **sekali** setelah akun dibuat. Salin dan berikan langsung ke pengguna,
     lalu minta mereka menggantinya di **Pengaturan → Keamanan**.

Akun yang dibuat dari halaman ini langsung dianggap terverifikasi.

## Mengubah & menonaktifkan pengguna

Lewat menu **⋯** di setiap baris:

- **Edit** — ubah nama, email, role, dan status **Akun aktif**.
- **Kirim reset password** — kirim tautan untuk mengatur password baru (password lama tetap
  berlaku sampai diganti).
- **Hapus** — menghapus akun permanen. Catatan waktu milik pengguna tersebut tetap tersimpan.

Menonaktifkan lebih aman daripada menghapus: pengguna nonaktif tidak bisa masuk (termasuk
lewat passkey), dan sesi yang sedang berjalan otomatis dikeluarkan pada permintaan berikutnya.
Aktifkan kembali kapan saja.

Aturan pengaman:

- Tidak ada yang bisa mengubah role, menonaktifkan, atau menghapus **pemilik**.
- Anda tidak bisa menonaktifkan, menghapus, atau mengubah role akun Anda sendiri.
- Admin tidak bisa mengubah admin lain — hanya pemilik.

## Mengalihkan kepemilikan

Pemilik bisa menyerahkan perannya ke pengguna aktif lain lewat menu **⋯ → Jadikan pemilik**.
Setelah dikonfirmasi, pengguna tersebut menjadi pemilik dan akun Anda otomatis menjadi
**admin**. Hanya pemilik baru yang bisa mengalihkannya kembali.

## Time tracker per pengguna

Setiap pengguna punya stopwatch sendiri: masing-masing boleh memiliki **satu** sesi aktif
(berjalan atau dijeda) dalam waktu yang sama, jadi beberapa anggota tim bisa mencatat waktu
bersamaan. Riwayat sesi menyimpan siapa yang mencatatnya. Sesi lama dari sebelum fitur ini
ada dicatat atas nama pemilik.
