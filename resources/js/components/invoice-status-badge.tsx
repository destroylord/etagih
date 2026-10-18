import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'muted';

const TONE_STYLE: Record<Tone, string> = {
    neutral:
        'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900',
    warning:
        'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900',
    success:
        'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
    danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
    muted: 'bg-zinc-50 text-zinc-500 ring-zinc-200 line-through decoration-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-800',
};

const DOT_STYLE: Record<Tone, string> = {
    neutral: 'bg-zinc-400',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    muted: 'bg-zinc-300',
};

/** Label + warna untuk setiap status di aplikasi (invoice, cicilan, pembayaran, sesi). */
const STATUS: Record<string, { label: string; tone: Tone }> = {
    // invoice
    draft: { label: 'Draft', tone: 'neutral' },
    sent: { label: 'Terkirim', tone: 'info' },
    partial: { label: 'Sebagian', tone: 'warning' },
    paid: { label: 'Lunas', tone: 'success' },
    overdue: { label: 'Terlambat', tone: 'danger' },
    cancelled: { label: 'Dibatalkan', tone: 'muted' },
    // cicilan / pembayaran
    pending: { label: 'Menunggu', tone: 'neutral' },
    success: { label: 'Berhasil', tone: 'success' },
    failed: { label: 'Gagal', tone: 'danger' },
    expired: { label: 'Kedaluwarsa', tone: 'muted' },
    // sesi kerja
    running: { label: 'Berjalan', tone: 'info' },
    paused: { label: 'Dijeda', tone: 'warning' },
    completed: { label: 'Belum ditagih', tone: 'neutral' },
    billed: { label: 'Sudah ditagih', tone: 'success' },
};

export const INVOICE_STATUS_OPTIONS = [
    'draft',
    'sent',
    'partial',
    'overdue',
    'paid',
    'cancelled',
] as const;

export function statusLabel(status: string): string {
    return STATUS[status]?.label ?? status;
}

export function StatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const meta = STATUS[status] ?? { label: status, tone: 'neutral' as Tone };

    return (
        <span
            className={cn(
                'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                TONE_STYLE[meta.tone],
                className,
            )}
        >
            <span
                className={cn('size-1.5 rounded-full', DOT_STYLE[meta.tone])}
                aria-hidden
            />
            {meta.label}
        </span>
    );
}

/** Alias lama — dipakai di banyak halaman. */
export function InvoiceStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    return <StatusBadge status={status} className={className} />;
}
