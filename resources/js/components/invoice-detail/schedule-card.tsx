import { CalendarClock } from 'lucide-react';
import { StatusBadge } from '@/components/invoice-status-badge';
import { daysFromToday, dueLabel, formatDate, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SectionCard } from './section-card';
import type { InvoiceDetail } from './types';

/** Jadwal cicilan dengan status + label jatuh tempo per baris. */
export function ScheduleCard({ invoice }: { invoice: InvoiceDetail }) {
    const schedules = invoice.schedules;

    if (invoice.type !== 'installment' || schedules.length === 0) {
        return null;
    }

    const paidCount = schedules.filter((s) => s.status === 'paid').length;
    const showDue =
        invoice.status !== 'cancelled' && invoice.status !== 'draft';

    return (
        <SectionCard
            title="Jadwal cicilan"
            icon={CalendarClock}
            action={
                <span className="text-xs text-muted-foreground tabular-nums">
                    {paidCount}/{schedules.length} lunas
                </span>
            }
            bodyClassName="px-0 py-0"
        >
            <ol className="divide-y">
                {schedules.map((s) => {
                    const open = s.status !== 'paid';
                    const late = open && (daysFromToday(s.due_date) ?? 0) < 0;

                    return (
                        <li
                            key={s.id}
                            className="flex items-center gap-3 px-5 py-3"
                        >
                            <span
                                className={cn(
                                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                                    open
                                        ? 'bg-muted text-muted-foreground'
                                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                                )}
                            >
                                {s.sequence}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium tabular-nums">
                                    {formatIDR(s.amount)}
                                </p>
                                <p
                                    className={cn(
                                        'truncate text-xs',
                                        late && showDue
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {formatDate(s.due_date)}
                                    {open && showDue && (
                                        <> · {dueLabel(s.due_date)}</>
                                    )}
                                    {!open && s.paid_at && (
                                        <> · dibayar {formatDate(s.paid_at)}</>
                                    )}
                                </p>
                            </div>
                            <StatusBadge status={s.status} />
                        </li>
                    );
                })}
            </ol>
        </SectionCard>
    );
}
