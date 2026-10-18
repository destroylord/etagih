import { Link } from '@inertiajs/react';
import {
    CloudOff,
    FolderKanban,
    Pause,
    Play,
    Square,
    Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge } from '@/components/invoice-status-badge';
import { fmtClock } from '@/components/Stopwatch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { elapsedSeconds, useNow } from './live-timer';
import type { ActiveView } from './types';

/** Kartu stopwatch untuk sesi yang sedang berjalan / dijeda. */
export function ActiveSessionCard({
    active,
    busy,
    endPending,
    onAction,
}: {
    active: ActiveView;
    busy: boolean;
    /** Stop/cancel sudah diantrikan tapi belum tersinkron. */
    endPending: boolean;
    onAction: (kind: 'pause' | 'resume' | 'stop' | 'cancel') => void;
}) {
    const running = active.status === 'running' && !endPending;
    const now = useNow(running);
    const seconds = elapsedSeconds(
        active.accumulatedSeconds,
        active.segmentStartedAt,
        running,
        now,
    );
    const estimate = (seconds / 3600) * active.unitPrice;
    const disabled = busy || endPending;

    return (
        <Card
            className={cn(
                'relative gap-0 overflow-hidden py-0',
                running
                    ? 'border-blue-300 dark:border-blue-900'
                    : 'border-amber-300 dark:border-amber-900',
            )}
        >
            <div
                className={cn(
                    'h-1 w-full',
                    running ? 'animate-pulse bg-blue-500' : 'bg-amber-400',
                )}
                aria-hidden
            />
            <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={active.status} />
                        {active.localOnly && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                <CloudOff className="size-3.5" /> Belum
                                tersinkron
                            </span>
                        )}
                        {endPending && (
                            <span className="text-xs text-muted-foreground">
                                Menunggu sinkronisasi untuk mengakhiri sesi…
                            </span>
                        )}
                    </div>
                    <h2 className="text-lg leading-snug font-semibold break-words sm:text-xl">
                        {active.description}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {active.clientName}
                        </span>{' '}
                        · {formatIDR(active.unitPrice)}/jam
                    </p>
                    {active.project && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <FolderKanban
                                className="size-4 shrink-0"
                                aria-hidden
                            />
                            <span className="sr-only">Proyek:</span>
                            <Link
                                href={`/projects/${active.project.id}`}
                                className="min-w-0 truncate font-medium text-foreground underline-offset-2 hover:underline"
                            >
                                {active.project.label}
                            </Link>
                        </p>
                    )}
                    {active.notes && (
                        <p className="text-sm whitespace-pre-line text-muted-foreground">
                            {active.notes}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                    <div className="sm:mr-auto lg:mr-0 lg:text-right">
                        <p
                            className={cn(
                                'font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl',
                                running
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                            )}
                            role="timer"
                            aria-label="Durasi sesi"
                        >
                            {fmtClock(seconds)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                            Estimasi {formatIDR(estimate)} (sebelum pembulatan)
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {active.status === 'running' ? (
                            <Button
                                variant="outline"
                                onClick={() => onAction('pause')}
                                disabled={disabled}
                            >
                                <Pause /> Jeda
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={() => onAction('resume')}
                                disabled={disabled}
                            >
                                <Play /> Lanjutkan
                            </Button>
                        )}
                        <Button
                            variant="destructive"
                            onClick={() => onAction('stop')}
                            disabled={disabled}
                        >
                            <Square /> Selesai
                        </Button>
                        <ConfirmDialog
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={disabled}
                                    aria-label="Batalkan sesi"
                                >
                                    <Trash2 className="text-red-600 dark:text-red-400" />
                                </Button>
                            }
                            title="Batalkan sesi ini?"
                            description="Sesi akan dihapus dan waktunya tidak dicatat. Gunakan Selesai jika ingin menyimpan waktu kerja."
                            confirmLabel="Batalkan sesi"
                            cancelLabel="Kembali"
                            destructive
                            onConfirm={(done) => {
                                onAction('cancel');
                                done();
                            }}
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
}
