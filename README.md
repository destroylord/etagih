# eTagih

**Open-source invoicing for freelancers and small agencies in Indonesia.**
Clients & projects, time tracking, QRIS payments, WhatsApp & email reminders, and professional PDF invoices — self-hosted on your own server.

[![tests](https://github.com/destroylord/etagih/actions/workflows/tests.yml/badge.svg)](https://github.com/destroylord/etagih/actions/workflows/tests.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

> 🇮🇩 **Dokumentasi lengkap (Bahasa Indonesia): https://destroylord.github.io/etagih/** — sumbernya di [`docs/`](docs/README.md).

<!-- TODO: add screenshots (dashboard, invoice, payment page) to docs/images/ -->

## Features

- **Invoices** — fixed-price or hourly, full payment or 2–24 installments, percentage/amount discounts, VAT (PPN), **PPh 23 withholding**, recurring invoices, duplicate, void.
- **Quotations** — send a quote (*penawaran harga*), let the client accept or decline online, then turn it into an invoice in one click.
- **Clients → Projects → Sub-projects** — e.g. *Aqim → Gym → Allstar, Buildy*. Invoice lines, time entries and reports roll up per project.
- **Payments** — dynamic QRIS via [QRISLY](https://rajaongkir.com/docs/qrisly/getting-started/flow-overview-page) with webhook + server-side verification, manual bank transfer recording, automatic installment allocation.
- **Receipts (kuitansi)** — numbered PDF receipt for every payment, emailed to the client, with an *e-Meterai* reminder above Rp5 million.
- **Customisable QR codes** — colours, dot & corner shapes, framed card, centre logo.
- **Notifications** — WhatsApp via [Fonnte](https://fonnte.com) and email with the PDF attached; reminders before and after the due date (rate-limited).
- **Professional PDF** — letterhead, watermark, amount in words (*terbilang*), payment QR, terms, signature. Live preview before saving.
- **Time tracker** — stopwatch per client/project with pause, rounding, offline queue; bill sessions straight into an invoice.
- **Reports** — monthly revenue, receivables aging, top clients, per-project breakdown, Excel export.
- **Client portal** — clients log in with an access key to see and pay all their invoices.
- **Team** — owner, admin and staff roles; per-user time tracking.
- **Easy self-hosting** — prebuilt Docker images (amd64/arm64), browser setup wizard, system status page, update notifications, one-click backup download, client import from Excel/CSV.
- **Secure by default** — 2FA & passkeys, hashed portal keys, webhook re-verification, financial history protected from deletion.

## Quick start

**Production (Docker, ~1 GB RAM VPS, automatic HTTPS):**

```bash
git clone https://github.com/destroylord/etagih.git && cd etagih
cp .env.production.example .env        # fill in the values marked ⚠ (incl. ETAGIH_IMAGE, optional SETUP_TOKEN)
docker compose pull                    # prebuilt images from ghcr.io (or: docker compose up -d --build)
docker compose run --rm --no-deps --entrypoint php app artisan key:generate --show   # paste into APP_KEY
docker compose up -d
```

Then open `https://your-domain/setup` — a one-time wizard creates the owner account and business profile
(`/setup?token=…` if `SETUP_TOKEN` is set). Check **Settings → System status** afterwards; it also offers
one-click backups and tells you when a new release is available.

Full guide: [docs/pages/memulai/instalasi-docker.md](docs/pages/memulai/instalasi-docker.md).

**Local development:**

```bash
composer install && npm ci --include=dev
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
composer dev                            # http://localhost:8000 → setup wizard on first visit
```

Requirements: PHP 8.4+, Composer 2, Node 22+, MariaDB/MySQL or SQLite. See [docs/pages/memulai/instalasi-manual.md](docs/pages/memulai/instalasi-manual.md).

## Documentation

| | |
|---|---|
| [Installation (Docker)](docs/pages/memulai/instalasi-docker.md) · [Manual](docs/pages/memulai/instalasi-manual.md) | [Configuration](docs/pages/memulai/konfigurasi.md) |
| [User guide](docs/pages/panduan/ringkasan.md) | [Integrations](docs/pages/penggunaan/integrasi.md) — QRISLY, Fonnte, email |
| [Operations](docs/pages/penggunaan/operasional.md) — updates, backups, troubleshooting | [Development](docs/pages/pengembang/pengembangan.md) |
| [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) |

## Tech stack

Laravel 13 · PHP 8.4 · Inertia.js v3 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · DomPDF · Pest

## Contributing

Bug reports, ideas and pull requests are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) first.
Security issues: **do not open a public issue**, follow [SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0](LICENSE). eTagih is free to use, modify and self-host. If you run a modified version as a network service, you must make your source code available to its users.
