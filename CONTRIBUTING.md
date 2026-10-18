# Berkontribusi ke eTagih

Terima kasih sudah ingin membantu! 🙌
*(English speakers: issues and pull requests in English are welcome too.)*

Dengan berpartisipasi, kamu setuju mengikuti [Code of Conduct](CODE_OF_CONDUCT.md).

## Melaporkan bug

1. Cari dulu di [Issues](../../issues), siapa tahu sudah dilaporkan.
2. Buka issue baru dengan template **Laporan bug**: langkah mereproduksi, hasil yang diharapkan vs yang terjadi,
   versi eTagih, cara instalasi (Docker/manual), dan potongan log bila ada.
3. **Jangan sertakan data pribadi klien, API key, atau isi `.env`.**

Celah keamanan **jangan** dilaporkan lewat issue publik, tapi ikuti [SECURITY.md](SECURITY.md).

## Mengusulkan fitur

Buka issue dengan template **Usulan fitur** dan ceritakan masalah yang ingin diselesaikan, bukan hanya solusinya.
Untuk perubahan besar (mis. gateway baru, perubahan skema database), diskusikan dulu sebelum menulis kode.

## Mengirim pull request

1. Fork repo, buat branch dari `main`: `fix/nama-singkat` atau `feat/nama-singkat`.
2. Siapkan lingkungan pengembangan: lihat [Panduan pengembangan](docs/pages/pengembang/pengembangan.md).
3. Tulis kode + **test** untuk perubahan perilaku. Perbaikan bug sebaiknya diawali test yang gagal.
4. Pastikan semua pemeriksaan lulus:
   ```bash
   composer ci:check
   ```
5. Perbarui dokumentasi di `docs/pages/` bila perilaku atau konfigurasi berubah, dan tambahkan catatan di bagian
   *Unreleased* pada [CHANGELOG.md](CHANGELOG.md).
6. Buka pull request dan isi template-nya. Satu PR untuk satu perubahan.

### Gaya kode

- PHP diformat Pint, TypeScript/React oleh ESLint + Prettier (dijalankan `composer ci:check`).
- Antarmuka & komentar dalam Bahasa Indonesia; nama kelas/fungsi/variabel dalam Bahasa Inggris.
- Logika bisnis di `app/Actions`, bukan di controller. Detail di [Panduan pengembangan](docs/pages/pengembang/pengembangan.md#konvensi).
- Jangan mengubah migrasi yang sudah dirilis; buat migrasi baru.

### Pesan commit

Ringkas dan jelas, mis. `fix: cicilan tidak ditandai lunas dari webhook` atau `feat: filter invoice per proyek`.

## Lisensi

eTagih berlisensi [AGPL-3.0](LICENSE). Dengan mengirim pull request, kamu setuju kontribusimu dirilis di bawah
lisensi yang sama.
