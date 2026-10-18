---
title: "Ringkasan & alur kerja"
description: "Gambaran alur eTagih dari klien sampai invoice lunas."
---

## Alur besar

```
Klien ──► Proyek ──► Sub-proyek
  │          │            │
  └──────────┴─── Time Tracker (jam kerja) ──┐
                                             ▼
                         Invoice (draft) ──► Kirim (WA + email + PDF)
                                             │
                     Klien membuka link bayar ◄┘
                                             │
                    QRIS / transfer / dicatat manual
                                             ▼
                         Lunas ──► konfirmasi WA ke klien
            (belum bayar → pengingat otomatis & status "Terlambat")
```

## Dashboard

Ringkasan cepat: piutang aktif, pembayaran diterima bulan ini, invoice menunggu pembayaran, invoice terlambat,
grafik pendapatan 6 bulan, tagihan yang segera jatuh tempo (14 hari), dan invoice terbaru.
