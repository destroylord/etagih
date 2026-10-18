import { useEffect, useState } from 'react';

/** Detik berjalan = akumulasi + (sekarang − mulai segmen) saat running. */
export function elapsedSeconds(
    accumulated: number,
    segmentStartedAt: string | null,
    running: boolean,
    now = Date.now(),
): number {
    if (!running || !segmentStartedAt) {
        return Math.max(0, accumulated);
    }

    const start = new Date(segmentStartedAt).getTime();

    if (Number.isNaN(start)) {
        return Math.max(0, accumulated);
    }

    return Math.max(0, accumulated + Math.max(0, now - start) / 1000);
}

/** `Date.now()` yang diperbarui tiap detik selama `active` (berbasis jam, tidak drift). */
export function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!active) {
            return;
        }

        const id = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(id);
    }, [active]);

    return now;
}
