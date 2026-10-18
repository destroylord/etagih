import { usePage } from '@inertiajs/react';
import { BellRing, Plus, Stamp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    dueLabel,
    daysFromToday,
    formatDate,
    formatDateTime,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { SectionCard } from './section-card';
import type { InvoiceDetail, InvoiceSettings } from './types';
import { isOpen, remainingOf, STAMP_DUTY_THRESHOLD } from './types';

/** Ringkasan pembayaran: total, dibayar, sisa + progress bar. */
export function PaymentSummaryCard({
    invoice,
    onRecordPayment,
}: {
    invoice: InvoiceDetail;
    onRecordPayment?: () => void;
}) {
    const { settings } = usePage<{ settings?: InvoiceSettings }>().props;
    const total = toNumber(invoice.total);
    const pph = toNumber(invoice.pph_amount);
    const needsStamp =
        settings?.stamp_duty_enabled !== false &&
        invoice.status !== 'cancelled' &&
        total > STAMP_DUTY_THRESHOLD;
    const paid = toNumber(invoice.paid_amount);
    const remaining = remainingOf(invoice);
    const percent =
        total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const cancelled = invoice.status === 'cancelled';
    const open = isOpen(invoice.status);
    const late =
        open &&
        invoice.due_date !== null &&
        (daysFromToday(invoice.due_date) ?? 0) < 0;

    return (
        <SectionCard title="Pembayaran" icon={Wallet}>
            <div className="space-y-4">
                <div>
                    <p className="text-xs text-muted-foreground">
                        {cancelled ? 'Total (dibatalkan)' : 'Sisa tagihan'}
                    </p>
                    <p
                        className={cn(
                            'mt-0.5 text-2xl font-semibold tracking-tight tabular-nums',
                            cancelled && 'text-muted-foreground line-through',
                            remaining === 0 &&
                                !cancelled &&
                                'text-emerald-600 dark:text-emerald-400',
                        )}
                    >
                        {formatIDR(cancelled ? total : remaining)}
                    </p>
                    {open && invoice.due_date && (
                        <p
                            className={cn(
                                'mt-0.5 text-xs',
                                late
                                    ? 'font-medium text-red-600 dark:text-red-400'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {dueLabel(invoice.due_date)} ·{' '}
                            {formatDate(invoice.due_date)}
                        </p>
                    )}
                </div>

                {!cancelled && (
                    <div className="space-y-1.5">
                        <div
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            aria-label="Progres pembayaran"
                        >
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all',
                                    percent >= 100
                                        ? 'bg-emerald-500'
                                        : 'bg-primary',
                                )}
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">
                            {percent}% terbayar
                        </p>
                    </div>
                )}

                <dl className="space-y-1.5 text-sm">
                    {pph > 0 && (
                        <>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">
                                    Total tagihan
                                </dt>
                                <dd className="font-medium tabular-nums">
                                    {formatIDR(total + pph)}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">
                                    PPh 23 ({formatNumber(invoice.pph_rate)}%)
                                    dipotong
                                </dt>
                                <dd className="font-medium text-amber-600 tabular-nums dark:text-amber-400">
                                    − {formatIDR(pph)}
                                </dd>
                            </div>
                        </>
                    )}
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">
                            {pph > 0 ? 'Total dibayar' : 'Total'}
                        </dt>
                        <dd className="font-medium tabular-nums">
                            {formatIDR(total)}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Sudah dibayar</dt>
                        <dd className="font-medium tabular-nums">
                            {formatIDR(paid)}
                        </dd>
                    </div>
                    {!cancelled && (
                        <div className="flex justify-between gap-4 border-t pt-1.5">
                            <dt className="text-muted-foreground">Sisa</dt>
                            <dd className="font-semibold tabular-nums">
                                {formatIDR(remaining)}
                            </dd>
                        </div>
                    )}
                </dl>

                {pph > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Minta bukti potong PPh 23 dari klien sebagai kredit
                        pajak Anda.
                    </p>
                )}

                {needsStamp && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                        <Stamp className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                            Kuitansi untuk pembayaran &gt; Rp5 juta wajib
                            bermeterai Rp10.000 — sediakan e-Meterai.
                        </span>
                    </div>
                )}

                {open && onRecordPayment && remaining > 0 && (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={onRecordPayment}
                    >
                        <Plus /> Catat pembayaran
                    </Button>
                )}

                {invoice.status !== 'draft' && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        <BellRing className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                            {invoice.reminder_count > 0 ? (
                                <>
                                    {invoice.reminder_count}× pengingat terkirim
                                    {invoice.last_reminded_at && (
                                        <>
                                            , terakhir{' '}
                                            {formatDateTime(
                                                invoice.last_reminded_at,
                                            )}
                                        </>
                                    )}
                                </>
                            ) : (
                                'Belum ada pengingat otomatis yang terkirim.'
                            )}
                        </span>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
