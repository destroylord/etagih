import { toast } from 'sonner';

/*
 * Registrasi service worker PWA (lihat resources/pwa/sw.js).
 *
 * - Hanya build produksi & secure context (HTTPS / localhost). Saat dev (Vite
 *   HMR) SW yang tersisa dibongkar supaya tidak menyajikan asset lama.
 * - Versi baru terpasang → toast "Muat ulang"; halaman baru dimuat ulang
 *   setelah SW baru aktif (hanya bila pengguna yang memintanya).
 */

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

let reloadRequested = false;
let updateToastShown = false;

function promptUpdate(worker: ServiceWorker) {
    if (updateToastShown) {
        return;
    }

    updateToastShown = true;

    toast('Versi baru eTagih tersedia', {
        description: 'Muat ulang untuk memakai versi terbaru.',
        duration: Infinity,
        action: {
            label: 'Muat ulang',
            onClick: () => {
                reloadRequested = true;
                worker.postMessage({ type: 'SKIP_WAITING' });
            },
        },
        onDismiss: () => {
            updateToastShown = false;
        },
    });
}

async function unregisterAll() {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));

    if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key.startsWith('etagih-'))
                .map((key) => caches.delete(key)),
        );
    }
}

async function register() {
    const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
    });

    // SW baru sudah menunggu (mis. tab lain memicu update) → tawarkan muat ulang.
    if (registration.waiting && navigator.serviceWorker.controller) {
        promptUpdate(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
        const worker = registration.installing;

        worker?.addEventListener('statechange', () => {
            // Ada controller = ini update, bukan pemasangan pertama.
            if (
                worker.state === 'installed' &&
                navigator.serviceWorker.controller
            ) {
                promptUpdate(worker);
            }
        });
    });

    // Aplikasi terpasang bisa terbuka berhari-hari: cek update berkala.
    let lastCheck = Date.now();
    const checkForUpdate = () => {
        if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL / 6) {
            return;
        }

        lastCheck = Date.now();
        registration.update().catch(() => {});
    };

    window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkForUpdate();
        }
    });
}

export function setupServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    if (!import.meta.env.PROD) {
        unregisterAll().catch(() => {});

        return;
    }

    if (!window.isSecureContext) {
        return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloadRequested || refreshing) {
            return;
        }

        refreshing = true;
        window.location.reload();
    });

    const start = () => {
        register().catch((error) => {
            console.warn('Gagal mendaftarkan service worker', error);
        });
    };

    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start, { once: true });
    }
}
