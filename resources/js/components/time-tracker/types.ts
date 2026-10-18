import type { LocalActive } from '@/lib/work-session-sync';
import type { Client, Project, WorkSession } from '@/types/models';

export type TrackerClient = Pick<Client, 'id' | 'name' | 'hourly_rate'>;

export type TrackerFilters = {
    client_id?: string;
    project_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
};

/** Ringkasan proyek untuk ditampilkan (nama lengkap + link). */
export type ProjectRef = { id: number; label: string };

/**
 * Bentuk seragam sesi aktif — bisa berasal dari server (prop `active`) atau
 * mirror lokal offline (`tt.active`).
 */
export type ActiveView = {
    id: number | null;
    clientName: string;
    project: ProjectRef | null;
    description: string;
    unitPrice: number;
    status: 'running' | 'paused';
    /** Mulai segmen berjalan (null saat dijeda). */
    segmentStartedAt: string | null;
    /** Akumulasi detik dari segmen-segmen sebelumnya. */
    accumulatedSeconds: number;
    notes: string | null;
    /** Belum tersinkron ke server. */
    localOnly: boolean;
};

/**
 * Mirror lokal + info proyek. Field tambahan ikut tersimpan di localStorage
 * (applyLocal pause/resume & flushQueue memakai spread, jadi tidak hilang).
 */
export type LocalActiveWithProject = LocalActive & {
    project_id?: number | null;
    project_name?: string | null;
};

export type TrackerSession = WorkSession & {
    client?: Pick<Client, 'id' | 'name'> | null;
    /** Pencatat sesi (multi-user). */
    user?: { id: number; name: string } | null;
};

/** "Gym › Allstar" — pakai full_name dari server, fallback rakit dari parent. */
export function projectLabel(
    p: Pick<Project, 'name' | 'full_name' | 'parent'> | null | undefined,
): string | null {
    if (!p) {
        return null;
    }

    return p.full_name ?? (p.parent ? `${p.parent.name} › ${p.name}` : p.name);
}
