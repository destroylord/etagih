import { cn } from '@/lib/utils';
import type { QuoteStatus } from '@/types/quotes';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'muted';

// Gaya sama dengan StatusBadge invoice (components/invoice-status-badge).
const TONE_STYLE: Record<Tone, string> = {
    neutral:
        'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900',
    warning:
        'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900',
    success:
        'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
    danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
    muted: 'bg-zinc-50 text-zinc-500 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800',
};

const DOT_STYLE: Record<Tone, string> = {
    neutral: 'bg-zinc-400',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    muted: 'bg-zinc-300',
};

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> =
    {
        draft: { label: 'Draft', tone: 'neutral' },
        sent: { label: 'Menunggu jawaban', tone: 'info' },
        accepted: { label: 'Diterima', tone: 'success' },
        declined: { label: 'Ditolak', tone: 'danger' },
        expired: { label: 'Kedaluwarsa', tone: 'muted' },
        converted: { label: 'Jadi invoice', tone: 'success' },
    };

export const QUOTE_STATUS_OPTIONS: QuoteStatus[] = [
    'draft',
    'sent',
    'accepted',
    'declined',
    'expired',
    'converted',
];

export function quoteStatusLabel(status: string): string {
    return QUOTE_STATUS[status as QuoteStatus]?.label ?? status;
}

export function QuoteStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const meta = QUOTE_STATUS[status as QuoteStatus] ?? {
        label: status,
        tone: 'neutral' as Tone,
    };

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
