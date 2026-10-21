---
title: "Pakai eTagih di HP"
description: "Memasang eTagih di layar utama Android & iPhone supaya terbuka seperti aplikasi biasa."
---

eTagih bisa dipasang di layar utama HP (Progressive Web App / PWA). Setelah dipasang, eTagih punya ikon sendiri, terbuka layar penuh tanpa bilah alamat browser, dan muncul di daftar aplikasi seperti aplikasi biasa. Tidak perlu unduh dari Play Store / App Store.

:::note{title="Syarat: HTTPS"}
Browser hanya mengizinkan pemasangan bila eTagih dibuka lewat **https://** (misalnya `https://tagih.domainanda.com`). Instalasi Docker bawaan (Caddy) sudah otomatis memakai HTTPS. Cek di **Pengaturan → Status sistem**, baris **HTTPS (passkey & PWA)**.
:::

## Android (Chrome, Edge, Samsung Internet)

1. Buka eTagih di Chrome lalu login.
2. Ketuk **Pasang aplikasi** di menu **Akun** (navigasi bawah), **atau** ketuk menu **⋮** browser → **Pasang aplikasi** / **Tambahkan ke layar utama**.
3. Konfirmasi **Pasang**. Ikon eTagih muncul di layar utama dan laci aplikasi.

Tekan lama ikon eTagih untuk pintasan cepat: **Task saya**, **Mulai timer**, **Invoice baru**, dan **Klien**.

## iPhone & iPad (Safari)

1. Buka eTagih di **Safari** (di iOS, pemasangan hanya lewat Safari).
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas).
3. Gulir lalu pilih **Tambahkan ke Layar Utama**, kemudian **Tambah**.

## Komputer (Chrome / Edge)

Klik ikon **Pasang** di ujung kanan bilah alamat, atau menu browser → **Pasang eTagih**. eTagih terbuka di jendela sendiri.

## Nama & ikon

Nama aplikasi mengikuti **Nama usaha** di **Pengaturan** (misalnya "Studio Anda · eTagih"); bila belum diisi, dipakai "eTagih". Bila nama usaha diubah setelah dipasang, sebagian HP baru memperbaruinya setelah beberapa waktu, atau setelah aplikasi dipasang ulang.

## Apa yang bisa dipakai tanpa internet?

eTagih tetap butuh **koneksi internet** untuk semua data: invoice, klien, tugas, dan laporan selalu diambil langsung dari server dan **tidak disimpan di HP**, demi keamanan data Anda.

Yang disimpan di HP hanya tampilan aplikasi (kode, gaya, ikon) supaya eTagih terbuka lebih cepat. Bila jaringan putus saat Anda pindah halaman, eTagih menampilkan halaman **"Anda sedang offline"** dengan tombol **Coba lagi**; halaman dimuat ulang otomatis begitu koneksi kembali.

Pengecualian: stopwatch [Time Tracker](./time-tracker) yang **sudah terbuka** tetap jalan saat koneksi terputus, lalu disinkronkan saat online kembali.

## Pembaruan

Setelah server eTagih diperbarui, aplikasi di HP menampilkan pemberitahuan **"Versi baru eTagih tersedia"**. Ketuk **Muat ulang** untuk langsung memakai versi terbaru, atau abaikan saja: versi baru otomatis dipakai saat aplikasi ditutup lalu dibuka lagi.

## Melepas pemasangan

Hapus seperti aplikasi lain: tekan lama ikon eTagih → **Hapus** / **Copot pemasangan**. Data Anda tetap aman di server.
