import { Check, QrCode } from 'lucide-react';
import { StatusBadge } from '@/components/invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { daysFromToday, dueLabel, formatDate, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PaymentSchedule } from '@/types/models';

/**
 * Daftar cicilan; tiap cicilan yang belum lunas bisa dibayar sendiri-sendiri.
 * Cicilan berikutnya (paling awal yang belum lunas) diberi tombol utama.
 */
export function InstallmentList({
    schedules,
    canPay,
    payingScheduleId,
    activeScheduleId,
    onPay,
}: {
    schedules: PaymentSchedule[];
    canPay: boolean;
    payingScheduleId: number | null;
    /** Cicilan yang QR-nya sedang ditampilkan. */
    activeScheduleId: number | null;
    onPay: (scheduleId: number) => void;
}) {
    const sorted = [...schedules].sort((a, b) => a.sequence - b.sequence);
    const nextId = sorted.find((s) => s.status !== 'paid')?.id ?? null;
    const paidCount = sorted.filter((s) => s.status === 'paid').length;

    return (
        <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">Jadwal cicilan</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {paidCount}/{sorted.length} lunas
                </span>
            </div>
            <ol className="divide-y rounded-lg border">
                {sorted.map((s) => {
                    const paid = s.status === 'paid';
                    const diff = daysFromToday(s.due_date);
                    const late = !paid && diff !== null && diff < 0;
                    const isNext = s.id === nextId;
                    const isActive = s.id === activeScheduleId;
                    const loading = payingScheduleId === s.id;

                    return (
                        <li
                            key={s.id}
                            className={cn(
                                'flex items-center gap-3 p-3',
                                isActive && 'bg-primary/5',
                                paid && 'text-muted-foreground',
                            )}
                        >
                            <span
                                className={cn(
                                    'grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold',
                                    paid
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                        : isNext
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted text-muted-foreground',
                                )}
                                aria-hidden
                            >
                                {paid ? (
                                    <Check className="size-4" />
                                ) : (
                                    s.sequence
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p
                                    className={cn(
                                        'text-sm font-medium tabular-nums',
                                        !paid && 'text-foreground',
                                    )}
                                >
                                    {formatIDR(s.amount)}
                                </p>
                                <p
                                    className={cn(
                                        'text-xs',
                                        late
                                            ? 'font-medium text-red-600 dark:text-red-400'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    Cicilan ke-{s.sequence} ·{' '}
                                    {paid
                                        ? `Lunas ${formatDate(s.paid_at, '')}`.trim()
                                        : late
                                          ? dueLabel(s.due_date)
                                          : formatDate(s.due_date)}
                                </p>
                            </div>
                            {paid ? (
                                <StatusBadge status="paid" />
                            ) : canPay ? (
                                <Button
                                    size="sm"
                                    variant={isNext ? 'default' : 'outline'}
                                    onClick={() => onPay(s.id)}
                                    disabled={payingScheduleId !== null}
                                    aria-label={`Bayar cicilan ke-${s.sequence}`}
                                >
                                    {loading ? <Spinner /> : <QrCode />}
                                    {isActive ? 'QR aktif' : 'Bayar'}
                                </Button>
                            ) : (
                                <StatusBadge status={s.status} />
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
