<!DOCTYPE html>
<html lang="id">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="robots" content="noindex">
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
        <title>Anda sedang offline - eTagih</title>
        {{-- Halaman ini disimpan service worker & ditampilkan tanpa jaringan:
             semua gaya & ikon harus inline (tidak boleh memuat asset lain). --}}
        <style>
            :root {
                color-scheme: light dark;
                --bg: #ffffff;
                --fg: #0a0a0a;
                --muted: #737373;
                --brand: #1e3a8a;
                --btn-bg: #171717;
                --btn-fg: #fafafa;
            }

            @media (prefers-color-scheme: dark) {
                :root {
                    --bg: #0a0a0a;
                    --fg: #fafafa;
                    --muted: #a3a3a3;
                    --btn-bg: #fafafa;
                    --btn-fg: #171717;
                }
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                min-height: 100vh;
                min-height: 100dvh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
                background: var(--bg);
                color: var(--fg);
                font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                -webkit-font-smoothing: antialiased;
            }

            main {
                max-width: 360px;
            }

            .logo {
                width: 64px;
                height: 64px;
                margin: 0 auto 24px;
            }

            h1 {
                margin: 0 0 8px;
                font-size: 1.25rem;
                font-weight: 600;
            }

            p {
                margin: 0 0 24px;
                color: var(--muted);
                font-size: 0.9375rem;
                line-height: 1.5;
            }

            button {
                appearance: none;
                border: 0;
                border-radius: 8px;
                padding: 10px 20px;
                min-height: 44px;
                background: var(--btn-bg);
                color: var(--btn-fg);
                font: inherit;
                font-weight: 500;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <main>
            <svg class="logo" viewBox="2 6 52 52" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="6" width="52" height="52" rx="12" fill="#1e3a8a" />
                <path d="M17 18h22v28l-3.7-2.6-3.6 2.6-3.7-2.6-3.6 2.6-3.7-2.6L17 46z" fill="#fff" />
                <path d="M22 26h12M22 32h12M22 38h7" stroke="#1e3a8a" stroke-width="2.6" stroke-linecap="round" />
            </svg>
            <h1>Anda sedang offline</h1>
            <p>eTagih butuh koneksi internet untuk memuat data. Periksa jaringan Anda, lalu coba lagi.</p>
            <button type="button" onclick="location.reload()">Coba lagi</button>
        </main>
        <script>
            // Muat ulang otomatis begitu koneksi kembali.
            window.addEventListener('online', function () {
                location.reload();
            });
        </script>
    </body>
</html>
