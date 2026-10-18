import { FileDown, HandCoins, QrCode, Receipt } from 'lucide-react';
import { StatusBadge } from '@/components/invoice-status-badge';
import { formatDateTime, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SectionCard } from './section-card';
import type { InvoiceDetail } from './types';

/** Riwayat pembayaran (QRIS & manual), terbaru di atas. */
export function PaymentHistoryCard({ invoice }: { invoice: InvoiceDetail }) {
    const payments = [...invoice.payments].sort((a, b) =>
        String(b.paid_at ?? b.created_at).localeCompare(
            String(a.paid_at ?? a.created_at),
        ),
    );

    return (
        <SectionCard
            title="Riwayat pembayaran"
            icon={Receipt}
            bodyClassName={payments.length ? 'px-0 py-0' : undefined}
        >
            {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Belum ada pembayaran.
                </p>
            ) : (
                <ul className="divide-y">
                    {payments.map((p) => {
                        const Icon = p.method === 'qris' ? QrCode : HandCoins;
                        const success = p.status === 'success';

                        return (
                            <li
                                key={p.id}
                                className="flex items-start gap-3 px-5 py-3"
                            >
                                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                    <Icon className="size-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p
                                            className={cn(
                                                'text-sm font-medium tabular-nums',
                                                !success &&
                                                    'text-muted-foreground',
                                            )}
                                        >
                                            {formatIDR(p.amount)}
                                        </p>
                                        {!success && (
                                            <StatusBadge status={p.status} />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {p.method === 'qris'
                                            ? 'QRIS'
                                            : 'Manual'}{' '}
                                        ·{' '}
                                        {formatDateTime(
                                            p.paid_at ?? p.created_at,
                                        )}
                                    </p>
                                    {p.notes && (
                                        <p className="mt-1 text-xs break-words whitespace-pre-line text-muted-foreground">
                                            {p.notes}
                                        </p>
                                    )}
                                    {success && (
                                        <a
                                            href={`/payments/${p.id}/receipt`}
                                            target="_blank"
                                            rel="noopener"
                                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                                        >
                                            <FileDown className="size-3.5" />
                                            Kuitansi
                                            {p.receipt_number && (
                                                <span className="font-normal text-muted-foreground">
                                                    {p.receipt_number}
                                                </span>
                                            )}
                                        </a>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}
