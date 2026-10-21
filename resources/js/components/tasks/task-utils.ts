import type { VisitOptions } from '@inertiajs/core';
import { router, usePage } from '@inertiajs/react';
import { daysFromToday } from '@/lib/format';
import {
    move as moveRoute,
    startTimer as startTimerRoute,
} from '@/routes/tasks';
import type {
    AuthCan,
    Task,
    TaskPriority,
    TaskProjectOption,
    TaskStatus,
    TaskUserOption,
    UserRef,
} from '@/types/tasks';

/** Warna titik prioritas. */
export const PRIORITY_DOT: Record<TaskPriority, string> = {
    low: 'bg-slate-400 dark:bg-slate-500',
    normal: 'bg-sky-500',
    high: 'bg-amber-500',
    urgent: 'bg-red-500',
};

/** Warna badge status. */
export const STATUS_BADGE: Record<TaskStatus, string> = {
    todo: 'border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    in_progress:
        'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    review: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    done: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

/** Aksen garis atas kolom papan. */
export const STATUS_ACCENT: Record<TaskStatus, string> = {
    todo: 'bg-slate-400',
    in_progress: 'bg-sky-500',
    review: 'bg-amber-500',
    done: 'bg-emerald-500',
};

/** Menit → "2j 30m" / "45m" / "—". */
export function formatMinutes(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) {
        return '—';
    }

    const total = Math.max(0, Math.round(minutes));
    const h = Math.floor(total / 60);
    const m = total % 60;

    if (h === 0) {
        return `${m}m`;
    }

    return m === 0 ? `${h}j` : `${h}j ${m}m`;
}

/** Tenggat relatif singkat: "Hari ini", "Besok", "Kemarin", "3 hari lagi", "Lewat 2 hari", atau tanggal. */
export function relativeDue(date: string | null): string | null {
    const diff = daysFromToday(date);

    if (diff === null || !date) {
        return null;
    }

    if (diff === 0) {
        return 'Hari ini';
    }

    if (diff === 1) {
        return 'Besok';
    }

    if (diff === -1) {
        return 'Kemarin';
    }

    if (diff < 0) {
        return `Lewat ${Math.abs(diff)} hari`;
    }

    if (diff <= 7) {
        return `${diff} hari lagi`;
    }

    const d = new Date(`${date}T00:00:00`);

    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        ...(d.getFullYear() !== new Date().getFullYear()
            ? { year: 'numeric' }
            : {}),
    });
}

/** Waktu relatif untuk datetime ISO: "baru saja", "5 menit lalu", "kemarin", … */
export function relativeTime(value: string | null): string {
    if (!value) {
        return '';
    }

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
        return '';
    }

    const sec = Math.round((Date.now() - d.getTime()) / 1000);

    if (sec < 45) {
        return 'baru saja';
    }

    const min = Math.round(sec / 60);

    if (min < 60) {
        return `${min} menit lalu`;
    }

    const hours = Math.round(min / 60);

    if (hours < 24) {
        return `${hours} jam lalu`;
    }

    const days = Math.round(hours / 24);

    if (days === 1) {
        return 'kemarin';
    }

    if (days < 7) {
        return `${days} hari lalu`;
    }

    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function initials(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/\s+/u).filter(Boolean);

    if (parts.length === 0) {
        return '?';
    }

    const first = Array.from(parts[0])[0] ?? '';
    const last =
        parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';

    return (first + last).toUpperCase();
}

/** Kelompokkan proyek per klien (untuk <optgroup> / SelectGroup). */
export function groupProjectsByClient(
    projects: TaskProjectOption[],
): { client: { id: number; name: string }; projects: TaskProjectOption[] }[] {
    const map = new Map<
        number,
        { client: { id: number; name: string }; projects: TaskProjectOption[] }
    >();

    for (const p of projects) {
        const group = map.get(p.client.id) ?? {
            client: p.client,
            projects: [],
        };
        group.projects.push(p);
        map.set(p.client.id, group);
    }

    return Array.from(map.values()).sort((a, b) =>
        a.client.name.localeCompare(b.client.name, 'id'),
    );
}

/** Penerima tugas yang valid untuk proyek: owner/admin atau anggota proyek utama. */
export function assignableFor(
    users: TaskUserOption[],
    project: TaskProjectOption | null | undefined,
): UserRef[] {
    if (!project) {
        return users;
    }

    return users.filter(
        (u) =>
            u.role === 'owner' ||
            u.role === 'admin' ||
            project.member_ids.includes(u.id),
    );
}

/** `auth.can` dari HandleInertiaRequests (bisa null untuk tamu). */
export function useAuthCan(): AuthCan | null {
    const { auth } = usePage().props;

    return ((auth as { can?: AuthCan | null } | undefined)?.can ??
        null) as AuthCan | null;
}

export function useAuthUserId(): number | null {
    const { auth } = usePage().props;

    return (auth?.user?.id as number | undefined) ?? null;
}

/** Ganti/hapus `?task=` di URL tanpa kunjungan Inertia. */
export function setTaskQueryParam(id: number | null): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (id === null) {
        if (!url.searchParams.has('task')) {
            return;
        }

        url.searchParams.delete('task');
    } else {
        if (url.searchParams.get('task') === String(id)) {
            return;
        }

        url.searchParams.set('task', String(id));
    }

    window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash,
    );
}

export function readTaskQueryParam(): number | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = new URL(window.location.href).searchParams.get('task');
    const id = raw ? Number(raw) : NaN;

    return Number.isInteger(id) && id > 0 ? id : null;
}

type WriteOptions = Pick<
    VisitOptions,
    'only' | 'onSuccess' | 'onError' | 'onFinish'
>;

/** Pindah status (akhir kolom, atau sebelum `beforeId`). */
export function moveTask(
    task: Pick<Task, 'id'>,
    status: TaskStatus,
    beforeId: number | null = null,
    options: WriteOptions = {},
): void {
    router.patch(
        moveRoute.url(task.id),
        { status, before_id: beforeId },
        { preserveScroll: true, preserveState: true, ...options },
    );
}

export function startTaskTimer(
    task: Pick<Task, 'id'>,
    options: WriteOptions = {},
): void {
    router.post(
        startTimerRoute.url(task.id),
        {},
        { preserveScroll: true, preserveState: true, ...options },
    );
}

/** Ambil pesan error pertama dari error bag Inertia. */
export function firstError(errors: Record<string, string>): string {
    return Object.values(errors)[0] ?? 'Terjadi kesalahan.';
}
