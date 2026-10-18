---
title: "Otomatisasi terjadwal"
description: "Tugas harian: status terlambat, pengingat, invoice berulang."
---

Membutuhkan scheduler & queue worker yang berjalan (sudah termasuk di [Docker](/memulai/instalasi-docker)).

| Waktu | Tugas |
|---|---|
| 00:05 | Tandai invoice & cicilan yang lewat jatuh tempo sebagai **Terlambat** |
| 00:30 | Batalkan sesi Time Tracker yang lupa dihentikan (> 24 jam) |
| 06:00 | Buat invoice dari jadwal **berulang** (opsional langsung dikirim) |
| 09:00 | Kirim **pengingat WhatsApp**: sebelum jatuh tempo (H-3, H-1) dan sesudahnya (tiap N hari, maksimal M kali) |

Waktu mengikuti `APP_TIMEZONE`.
