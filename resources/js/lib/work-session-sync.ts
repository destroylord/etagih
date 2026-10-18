/**
 * Offline-first sync buat Time Tracker.
 *
 * Semua mutasi (start/pause/resume/stop/cancel) masuk op-log di localStorage,
 * lalu di-flush ke server berurutan. Kalau offline / request gagal → ops tetap
 * di queue, UI optimistik dari mirror `tt.active`, banner nunggu koneksi.
 *
 * Server tetap source of truth — setelah flush sukses, queue dibersihkan dan
 * page di-reload biar prop Inertia sinkron.
 */

export type QueueOp = {
    kind: 'start' | 'pause' | 'resume' | 'stop' | 'cancel';
    at: string; // ISO timestamp saat op dibuat
    payload?: {
        client_id?: number;
        client_name?: string;
        description?: string;
        unit_price?: number;
        notes?: string | null;
    };
};

export type LocalActive = {
    localOnly: boolean; // true = start belum pernah sukses ke server
    id: number | null;
    client_id: number;
    client_name: string;
    description: string;
    unit_price: number;
    started_at: string | null; // mulai segmen aktif (null saat paused)
    accumulated_seconds: number;
    status: 'running' | 'paused';
};

const QUEUE_KEY = 'tt.queue';
const ACTIVE_KEY = 'tt.active';

/* ---------- storage ---------- */

export function loadQueue(): QueueOp[] {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        const parsed = raw ? (JSON.parse(raw) as QueueOp[]) : [];

        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveQueue(q: QueueOp[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export { saveQueue };

export function loadLocalActive(): LocalActive | null {
    try {
        const raw = localStorage.getItem(ACTIVE_KEY);

        return raw ? (JSON.parse(raw) as LocalActive) : null;
    } catch {
        return null;
    }
}

export function saveLocalActive(a: LocalActive | null): void {
    if (a === null) {
        localStorage.removeItem(ACTIVE_KEY);
    } else {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
    }
}

/* ---------- optimistic local state ---------- */

/** Terapkan satu op ke LocalActive secara optimistik (tanpa sentuh server). */
export function applyLocal(
    op: QueueOp,
    current: LocalActive | null,
): LocalActive | null {
    switch (op.kind) {
        case 'start': {
            return {
                localOnly: true,
                id: null,
                client_id: op.payload?.client_id ?? 0,
                client_name: op.payload?.client_name ?? '',
                description: op.payload?.description ?? '',
                unit_price: op.payload?.unit_price ?? 0,
                started_at: op.at,
                accumulated_seconds: 0,
                status: 'running',
            };
        }
        case 'pause': {
            if (!current) {
                return null;
            }

            const seg =
                current.started_at !== null
                    ? Math.max(
                          0,
                          (Date.now() -
                              new Date(current.started_at).getTime()) /
                              1000,
                      )
                    : 0;

            return {
                ...current,
                accumulated_seconds: Math.round(
                    current.accumulated_seconds + seg,
                ),
                started_at: null,
                status: 'paused',
            };
        }
        case 'resume': {
            if (!current) {
                return null;
            }

            return { ...current, started_at: op.at, status: 'running' };
        }
        case 'stop':
        case 'cancel':
            // Tunggu flush sukses baru clear — kalau gagal, user bisa retry
            // dan id-nya masih ada di localActive. Sini cuma tandain via queue.
            return current;
    }
}

/* ---------- network ---------- */

async function xsrfHeader(): Promise<Record<string, string>> {
    const raw =
        (
            document.cookie
                .split('; ')
                .find((c) => c.startsWith('XSRF-TOKEN=')) ?? ''
        ).split('=')[1] ?? '';

    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-XSRF-TOKEN': decodeURIComponent(raw),
    };
}

type PostResult =
    | { ok: true; sessionId?: number }
    | { ok: false; conflict: boolean; error?: string };

async function postOp(
    op: QueueOp,
    activeId: number | null,
): Promise<PostResult> {
    let url = '';
    let body: Record<string, unknown> = {};

    if (op.kind === 'start') {
        url = '/work-sessions/start';
        body = {
            client_id: op.payload?.client_id,
            description: op.payload?.description,
            unit_price: op.payload?.unit_price,
            notes: op.payload?.notes ?? null,
        };
    } else {
        // pause/resume/stop/cancel menempel ke session aktif.
        if (!activeId) {
            return {
                ok: false,
                conflict: false,
                error: 'Tidak ada session aktif untuk operasi ini.',
            };
        }

        url =
            op.kind === 'cancel'
                ? `/work-sessions/${activeId}`
                : `/work-sessions/${activeId}/${op.kind}`;
    }

    try {
        const res = await fetch(url, {
            method: op.kind === 'cancel' ? 'DELETE' : 'POST',
            headers: await xsrfHeader(),
            body: op.kind === 'cancel' ? undefined : JSON.stringify(body),
        });

        const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            session?: { id: number };
        };

        if (!res.ok) {
            // 409/422 = konflik bisnis (session lain aktif / state invalid).
            const conflict = res.status === 409 || res.status === 422;

            return {
                ok: false,
                conflict,
                error: data.error ?? `HTTP ${res.status}`,
            };
        }

        return { ok: true, sessionId: data.session?.id };
    } catch {
        // Network error → biarkan queue, tunggu online.
        return { ok: false, conflict: false };
    }
}

export type FlushResult = {
    flushed: number; // jumlah op yang berhasil dikirim
    remaining: number; // sisa op di queue
    error?: string; // pesan error terakhir (kalau ada)
};

/**
 * Kirim seluruh queue berurutan. Berhenti di op pertama yang gagal
 * (biar urutan aman). Conflict → buang local state, server menang.
 */
export async function flushQueue(): Promise<FlushResult> {
    const queue = loadQueue();

    if (queue.length === 0) {
        return { flushed: 0, remaining: 0 };
    }

    // Id awal: dari mirror lokal (bisa null kalau start belum tersinkron).
    let activeId = loadLocalActive()?.id ?? null;
    let flushed = 0;

    for (const op of queue) {
        const result = await postOp(op, activeId);

        if (!result.ok) {
            if (result.conflict) {
                // Server punya realitas lain → buang semua local, ikuti server.
                saveQueue([]);
                saveLocalActive(null);

                return { flushed, remaining: 0, error: result.error };
            }

            return {
                flushed,
                remaining: queue.length - flushed,
                error: result.error ?? 'Offline / jaringan bermasalah.',
            };
        }

        if (op.kind === 'start' && result.sessionId) {
            activeId = result.sessionId;
            const cur = loadLocalActive();

            if (cur) {
                saveLocalActive({ ...cur, id: activeId, localOnly: false });
            }
        }

        flushed++;
        saveQueue(queue.slice(flushed));
    }

    // Semua sukses → bersihkan + reload supaya data Inertia fresh.
    saveQueue([]);
    saveLocalActive(null);

    return { flushed, remaining: 0 };
}
