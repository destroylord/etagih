import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Format detik → "HH:MM:SS" */
export function fmtClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Stopwatch live. `startedAt` = ISO timestamp agar akurat walau refresh
 * (berbasis clock, bukan interval counter yang drift).
 */
export function Stopwatch({
    startedAt,
    running = true,
    className,
}: {
    startedAt: string;
    running?: boolean;
    className?: string;
}) {
    // Elapsed dihitung saat render dari jam; interval hanya memicu render ulang.
    const [, setTick] = useState(0);
    const elapsed = diffSeconds(startedAt);

    useEffect(() => {
        if (!running) {
            return;
        }

        const id = window.setInterval(() => setTick((t) => t + 1), 1000);

        return () => window.clearInterval(id);
    }, [running, startedAt]);

    return (
        <span
            className={cn(
                'font-mono tabular-nums',
                running && 'detail-date text-green-600',
                className,
            )}
        >
            {fmtClock(elapsed)}
        </span>
    );
}

function diffSeconds(iso: string): number {
    const start = new Date(iso).getTime();

    if (Number.isNaN(start)) {
        return 0;
    }

    return Math.max(0, (Date.now() - start) / 1000);
}
