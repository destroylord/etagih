import type { ZudokuConfig } from "zudoku";

/**
 * Situs dokumentasi eTagih (https://zudoku.dev).
 * Konten: docs/pages/**. Jalankan: `npm run dev` (http://localhost:3000).
 *
 * DOCS_BASE_PATH  : set bila di-host di sub-path, mis. GitHub Pages → "/etagih".
 * DOCS_SITE_URL   : URL publik situs dokumentasi (untuk sitemap & canonical).
 */
const GITHUB_URL = "https://github.com/destroylord/etagih";
const siteUrl = process.env.DOCS_SITE_URL;

const config: ZudokuConfig = {
  basePath: process.env.DOCS_BASE_PATH || undefined,
  canonicalUrlOrigin: siteUrl,
  site: {
    title: "eTagih Docs",
    logo: {
      src: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
      alt: "eTagih",
      width: "150px",
    },
  },
  metadata: {
    title: "%s · eTagih Docs",
    defaultTitle: "Dokumentasi eTagih",
    description:
      "Dokumentasi eTagih — aplikasi invoice open source dengan QRIS, WhatsApp, time tracker, dan proyek.",
    favicon: "/favicon.svg",
  },
  theme: {
    // Warna aksen sama dengan invoice PDF (biru tua #1e3a8a).
    light: {
      primary: "224 64% 33%",
      primaryForeground: "0 0% 100%",
    },
    dark: {
      primary: "217 91% 68%",
      primaryForeground: "224 64% 15%",
    },
  },
  search: {
    type: "pagefind",
  },
  docs: {
    files: "/pages/**/*.{md,mdx}",
    defaultOptions: {
      toc: true,
      showLastModified: true,
      suggestEdit: {
        url: `${GITHUB_URL}/edit/main/docs/{filePath}`,
        text: "Sunting halaman ini",
      },
    },
  },
  ...(siteUrl ? { sitemap: { siteUrl } } : {}),
  navigation: [
    {
      type: "category",
      label: "Dokumentasi",
      icon: "book-open",
      items: [
        "/pengenalan",
        {
          type: "category",
          label: "Memulai",
          icon: "rocket",
          collapsible: false,
          items: [
            { type: "doc", file: "memulai/instalasi-docker", label: "Instalasi Docker", icon: "container" },
            { type: "doc", file: "memulai/instalasi-manual", label: "Instalasi manual", icon: "terminal" },
            { type: "doc", file: "memulai/konfigurasi", label: "Konfigurasi", icon: "settings" },
          ],
        },
        {
          type: "category",
          label: "Panduan pengguna",
          icon: "book-user",
          collapsible: false,
          items: [
            { type: "doc", file: "panduan/ringkasan", label: "Ringkasan & alur kerja", icon: "map" },
            { type: "doc", file: "panduan/klien", icon: "users" },
            { type: "doc", file: "panduan/proyek", icon: "folder-kanban" },
            { type: "doc", file: "panduan/task", icon: "list-todo" },
            { type: "doc", file: "panduan/produk", icon: "package" },
            { type: "doc", file: "panduan/penawaran", icon: "file-signature" },
            { type: "doc", file: "panduan/invoice", icon: "receipt" },
            { type: "doc", file: "panduan/pembayaran", icon: "qr-code" },
            { type: "doc", file: "panduan/time-tracker", icon: "timer" },
            { type: "doc", file: "panduan/laporan", icon: "chart-column" },
            { type: "doc", file: "panduan/portal-klien", icon: "key-round" },
            { type: "doc", file: "panduan/otomatisasi", icon: "calendar-clock" },
            { type: "doc", file: "panduan/pengguna", icon: "user-cog" },
            { type: "doc", file: "panduan/pasang-di-hp", icon: "smartphone" },
          ],
        },
        {
          type: "category",
          label: "Penggunaan",
          icon: "plug",
          collapsible: false,
          items: [
            { type: "doc", file: "penggunaan/integrasi", label: "Integrasi", icon: "plug" },
            { type: "doc", file: "penggunaan/operasional", label: "Operasional", icon: "life-buoy" },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Pengembang",
      icon: "code",
      items: [
        { type: "doc", file: "pengembang/pengembangan", label: "Panduan pengembangan", icon: "code" },
        { type: "link", to: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`, label: "Berkontribusi", icon: "git-pull-request" },
        { type: "link", to: `${GITHUB_URL}/blob/main/SECURITY.md`, label: "Keamanan", icon: "shield" },
        { type: "link", to: `${GITHUB_URL}/blob/main/CHANGELOG.md`, label: "Changelog", icon: "history" },
      ],
    },
    {
      type: "link",
      to: GITHUB_URL,
      label: "GitHub",
      icon: "git-branch",
    },
  ],
  redirects: [{ from: "/", to: "/pengenalan" }],
};

export default config;
