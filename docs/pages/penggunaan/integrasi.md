---
title: "Integrasi"
description: "Menghubungkan QRISLY (QRIS), Fonnte (WhatsApp), dan email."
---

Semua integrasi bersifat **opsional**. Tanpa integrasi apa pun, eTagih tetap bisa membuat invoice & PDF,
mencatat pembayaran manual, dan menjalankan time tracker.

| Integrasi | Fungsi | Tanpa integrasi ini |
|---|---|---|
| [QRISLY](#qris-qrisly) | Pembayaran QRIS otomatis | Klien bayar via transfer; kamu catat manual |
| [Fonnte](#whatsapp-fonnte) | Kirim invoice, konfirmasi bayar, pengingat via WhatsApp | Tidak ada notifikasi WA (email tetap jalan) |
| [Email (SMTP)](#email) | Kirim invoice + PDF ke email klien | Tidak ada email |

---

## QRIS (QRISLY)

[QRISLY](https://rajaongkir.com/docs/qrisly/getting-started/flow-overview-page) (Komerce) membuat QRIS **dinamis**
(nominal tertentu) dari QRIS **statis** toko kamu, lalu memberi tahu aplikasi lewat webhook saat dibayar.

### Alur

```
1. (sekali) Upload QRIS statis toko ──► QRISLY ──► qris_id
2. Klien klik "Bayar" ──► generate-qris (nominal) ──► qris_string + history_id ──► QR tampil
3. Klien membayar ──► QRISLY ──► POST /webhook/qrisly
4. Aplikasi memverifikasi ulang ke GET /payment-status/{history_id} ──► catat lunas ──► WA konfirmasi
   (Halaman bayar juga mengecek status berkala sebagai cadangan bila webhook terlambat.)
```

### Langkah pengaturan

1. Daftar di dashboard Collaborator (Komerce), buat **API Key** di *Developer → API Settings*.
2. Isi `.env`:
   ```env
   QRISLY_IS_PRODUCTION=false     # sandbox dulu
   QRISLY_API_KEY=xxxxxxxx
   ```
3. Di aplikasi: **Pengaturan → QRIS → Upload QRIS**. Unggah gambar QRIS statis dari aplikasi merchant kamu
   (DANA, GoPay, ShopeePay, bank, dll), PNG/JPG maks. 5 MB. QRIS pertama otomatis menjadi QRIS **aktif**.
   Bisa menyimpan beberapa QRIS dan memilih mana yang aktif.
4. Daftarkan webhook: dashboard RajaOngkir → **Webhook → QRISLY → Outbound Webhook** →
   `https://domainkamu/webhook/qrisly`.
5. Uji coba di sandbox. Setelah berhasil, ubah `QRISLY_IS_PRODUCTION=true`.

:::note

`QRISLY_MERCHANT_ID` di `.env` hanya dipakai bila belum ada QRIS yang di-upload lewat Pengaturan.

:::

### Tampilan kode QR

QRISLY hanya mengirim teks QRIS. Gambar QR dibuat oleh aplikasi, jadi tampilannya bisa diatur di
**Pengaturan → QRIS → Tampilan kode QR**: warna titik/latar/sudut, bentuk titik (kotak/membulat/bulat), bentuk sudut,
bingkai (kartu berjudul / garis tepi / tanpa), judul, keterangan, nominal, dan logo perusahaan di tengah.
Kontras warna di bawah 3:1 ditolak agar QR tetap bisa dipindai. **Selalu uji pindai** setelah mengubah gaya.

### Keamanan webhook

QRISLY tidak mengirim tanda tangan (signature) pada webhook. Karena itu eTagih **tidak memercayai isi webhook**:
setiap status "lunas" dikonfirmasi ulang ke API `payment-status` QRISLY, dan nominal yang dicatat diambil dari jawaban
API tersebut. Webhook palsu tidak bisa menandai invoice lunas. Endpoint juga dibatasi 60 request/menit.

### Mode uji

Bila `APP_ENV` bukan `production` **dan** `QRISLY_IS_PRODUCTION=false`, halaman bayar menampilkan hitung mundur dan
tombol **simulasi** yang memeriksa status transaksi ke gateway. Di produksi tombol ini tidak ada.

---

## WhatsApp (Fonnte)

[Fonnte](https://fonnte.com) mengirim pesan WhatsApp dari nomor kamu sendiri.

1. Daftar di Fonnte, hubungkan perangkat WhatsApp (scan QR di dashboard Fonnte).
2. Salin **token** perangkat ke `.env`: `WA_API_KEY=xxxxxxxx`.
3. Pastikan nomor WhatsApp klien terisi di data klien.

| Pesan | Kapan | Template di Pengaturan |
|---|---|---|
| Invoice baru | Saat invoice dikirim / dikirim ulang | Invoice baru |
| Konfirmasi pembayaran | Setiap pembayaran berhasil (lewat queue) | Pembayaran diterima |
| Pengingat sebelum jatuh tempo | H-N sesuai Pengaturan, pukul 09:00 | Pengingat sebelum jatuh tempo |
| Pengingat terlambat | Tiap N hari, maksimal M kali | Pengingat |

Konfirmasi pembayaran dikirim lewat **queue**, jadi pastikan queue worker berjalan. Gagal kirim WA tidak membatalkan
pencatatan pembayaran; penyebabnya tercatat di log (`WhatsApp (Fonnte)`).

---

## Email

Saat invoice dikirim, klien yang punya alamat email menerima email berisi ringkasan, tombol **Lihat & Bayar Invoice**,
info rekening, dan **PDF invoice terlampir**.

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com          # contoh
MAIL_PORT=587
MAIL_USERNAME=akun@gmail.com
MAIL_PASSWORD=app-password        # Gmail: gunakan App Password
MAIL_FROM_ADDRESS=billing@domainkamu.com
MAIL_FROM_NAME=eTagih
```

Untuk volume lebih besar dan deliverability lebih baik, gunakan layanan transaksional (Brevo, Mailgun, Amazon SES,
Postmark, Resend). Atur juga SPF/DKIM domain pengirim.

Saat pengembangan, `MAIL_MAILER=log` menulis email ke `storage/logs` tanpa mengirim.

---

## Menambah gateway lain

Integrasi dibungkus di service tersendiri (`app/Services/QrislyService.php`, `app/Services/WhatsAppService.php`)
dan pencatatan pembayaran terpusat di `app/Actions/Invoice/RecordPayment.php`. Gateway baru (mis. Midtrans, Xendit)
cukup memanggil `RecordPayment` dari webhook-nya. Lihat [Panduan pengembangan](/pengembang/pengembangan).
