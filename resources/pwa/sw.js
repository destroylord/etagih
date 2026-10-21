/*
 * Service worker eTagih (PWA ringan).
 *
 * Disajikan lewat route GET /sw.js (App\Http\Controllers\PwaController) yang
 * mengganti __ETAGIH_SW_VERSION__ dengan hash build Vite, jadi setiap deploy
 * baru otomatis memicu update SW.
 *
 * Yang di-cache HANYA cangkang aplikasi (asset Vite, ikon, font) dan halaman
 * /offline. Halaman & data (Inertia JSON, PDF, upload) tidak pernah disimpan
 * karena berisi data pengguna — tidak ada edit data offline.
 */

const VERSION = '__ETAGIH_SW_VERSION__';
const PREFIX = 'etagih-';
const STATIC_CACHE = `${PREFIX}static-${VERSION}`;
const RUNTIME_CACHE = `${PREFIX}runtime-${VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
    OFFLINE_URL,
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/favicon.svg',
];

/** Path yang tidak pernah di-cache (selalu langsung ke jaringan). */
const NEVER_CACHE = [
    /^\/pay(\/|$)/,
    /^\/q(\/|$)/,
    /^\/webhooks?(\/|$)/,
    /^\/client-portal/,
    /^\/invitation/,
    /^\/setup/,
    /^\/login/,
    /^\/logout/,
    /^\/sw\.js$/,
    /^\/manifest\.webmanifest$/,
    /^\/notifications/,
    /^\/tasks\//,
    /^\/build\/hot$/,
    /^\/storage\//,
    /^\/settings\/system\/backup/,
    /\/pdf(\/|$)/,
    /\/receipts?(\/|$)/,
    /^\/@vite\//,
    /^\/@react-refresh/,
    /^\/node_modules\//,
    /^\/resources\//,
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) =>
                cache.addAll(
                    PRECACHE.map(
                        (url) => new Request(url, { cache: 'reload' }),
                    ),
                ),
            ),
    );
    // Tidak skipWaiting otomatis: halaman menampilkan toast "Muat ulang"
    // lalu mengirim pesan SKIP_WAITING.
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) =>
                                key.startsWith(PREFIX) &&
                                key !== STATIC_CACHE &&
                                key !== RUNTIME_CACHE,
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

function isNeverCache(request, url) {
    if (request.headers.has('X-Inertia')) {
        return true;
    }

    const accept = request.headers.get('Accept') || '';

    if (accept.includes('application/json')) {
        return true;
    }

    return NEVER_CACHE.some((pattern) => pattern.test(url.pathname));
}

/** Asset Vite ber-hash (immutable): cache-first. */
async function cacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    const response = await fetch(request);

    if (response.ok) {
        cache.put(request, response.clone());
    }

    return response;
}

/** Ikon, font, favicon: tampilkan dari cache, perbarui di belakang. */
async function staleWhileRevalidate(event) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(event.request);
    const network = fetch(event.request)
        .then((response) => {
            if (response.ok) {
                cache.put(event.request, response.clone());
            }

            return response;
        })
        .catch(() => cached);

    if (cached) {
        event.waitUntil(network);

        return cached;
    }

    return network;
}

/** Navigasi: selalu jaringan; kalau gagal tampilkan halaman offline. */
async function networkFirstNavigation(request) {
    try {
        return await fetch(request);
    } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);

        return offline || Response.error();
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        if (isNeverCache(request, url)) {
            return;
        }

        event.respondWith(networkFirstNavigation(request));

        return;
    }

    if (isNeverCache(request, url)) {
        return;
    }

    if (url.pathname.startsWith('/build/assets/')) {
        event.respondWith(cacheFirst(request));

        return;
    }

    if (
        url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/fonts/') ||
        /^\/(favicon\.(ico|svg)|apple-touch-icon\.png)$/.test(url.pathname) ||
        /\.(woff2?|ttf|otf)$/.test(url.pathname)
    ) {
        event.respondWith(staleWhileRevalidate(event));
    }
});
