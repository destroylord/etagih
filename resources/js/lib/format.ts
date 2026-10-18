/**
 * Helper format angka & tanggal (locale Indonesia). Pakai ini di semua halaman
 * supaya tampilan Rupiah/tanggal konsisten.
 */

export type Numeric = number | string | null | undefined;

export function toNumber(value: Numeric): number {
    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
});
const idrCompactFormatter = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
});

/** Rp 1.250.000 */
export function formatIDR(value: Numeric): string {
    return 'Rp ' + idrFormatter.format(Math.round(toNumber(value)));
}

/** Rp 1,3 jt — untuk sumbu grafik / kartu sempit. */
export function formatIDRCompact(value: Numeric): string {
    return 'Rp ' + idrCompactFormatter.format(toNumber(value));
}

export function formatNumber(value: Numeric): string {
    return numberFormatter.format(toNumber(value));
}

function parseDate(value?: string | null): Date | null {
    if (!value) {
        return null;
    }

    const s = String(value).trim();
    // "2026-10-15" diparse sebagai tanggal lokal (bukan UTC) supaya tidak bergeser sehari.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? new Date(`${s}T00:00:00`)
        : new Date(s.includes('T') ? s : s.replace(' ', 'T'));

    return Number.isNaN(d.getTime()) ? null : d;
}

/** 15 Okt 2026 */
export function formatDate(value?: string | null, fallback = '—'): string {
    const d = parseDate(value);

    return d
        ? d.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : fallback;
}

/** 15 Okt 2026 14.30 */
export function formatDateTime(value?: string | null, fallback = '—'): string {
    const d = parseDate(value);

    return d
        ? d.toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : fallback;
}

/** Selisih hari dari hari ini (negatif = sudah lewat). */
export function daysFromToday(value?: string | null): number | null {
    const d = parseDate(value);

    if (!d) {
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** "Jatuh tempo 3 hari lagi" / "Lewat 5 hari" / "Jatuh tempo hari ini". */
export function dueLabel(value?: string | null): string | null {
    const diff = daysFromToday(value);

    if (diff === null) {
        return null;
    }

    if (diff === 0) {
        return 'Jatuh tempo hari ini';
    }

    if (diff > 0) {
        return `Jatuh tempo ${diff} hari lagi`;
    }

    return `Lewat ${Math.abs(diff)} hari`;
}

/** Format durasi detik → "1j 30m". */
export function formatDuration(seconds: Numeric): string {
    const total = Math.max(0, Math.round(toNumber(seconds)));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);

    if (h === 0) {
        return `${m}m`;
    }

    return m === 0 ? `${h}j` : `${h}j ${m}m`;
}

/** YYYY-MM-DD untuk input type="date". */
export function todayISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
