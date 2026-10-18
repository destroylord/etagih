import { Link, router } from '@inertiajs/react';
import { Repeat } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge } from '@/components/invoice-status-badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatIDR } from '@/lib/format';
import { RECURRENCE_LABEL } from '@/types/models';
import { SectionCard } from './section-card';
import type { InvoiceDetail, RecurringChild } from './types';

/** Info invoice berulang + daftar invoice yang sudah dibuat otomatis. */
export function RecurringCard({
    invoice,
    generated,
}: {
    invoice: InvoiceDetail;
    generated: RecurringChild[];
}) {
    const active = invoice.recurrence !== 'none';

    if (!active && generated.length === 0) {
        return null;
    }

    return (
        <SectionCard
            title="Invoice berulang"
            icon={Repeat}
            action={
                active ? (
                    <ConfirmDialog
                        trigger={
                            <Button
                                variant="ghost"
                                size="sm"
                                className="-my-1 h-7 text-destructive hover:text-destructive"
                            >
                                Hentikan
                            </Button>
                        }
                        title="Hentikan invoice berulang?"
                        description="Tidak akan ada invoice baru yang dibuat otomatis dari invoice ini. Invoice yang sudah dibuat tidak terpengaruh."
                        confirmLabel="Hentikan"
                        destructive
                        onConfirm={(done) =>
                            router.post(
                                `/invoices/${invoice.id}/recurrence/stop`,
                                {},
                                { preserveScroll: true, onFinish: done },
                            )
                        }
                    />
                ) : undefined
            }
        >
            <div className="space-y-4">
                {active ? (
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Interval
                            </dt>
                            <dd className="font-medium">
                                {RECURRENCE_LABEL[invoice.recurrence]}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Berikutnya
                            </dt>
                            <dd className="font-medium">
                                {formatDate(invoice.recurrence_next_date)}
                            </dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">
                                Pengiriman
                            </dt>
                            <dd className="font-medium">
                                {invoice.recurrence_auto_send
                                    ? 'Otomatis dikirim ke klien'
                                    : 'Disimpan sebagai draft'}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Pengulangan sudah dihentikan.
                    </p>
                )}

                {generated.length > 0 && (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                            Sudah dibuat ({generated.length})
                        </p>
                        <ul className="-mx-2">
                            {generated.map((child) => (
                                <li key={child.id}>
                                    <Link
                                        href={`/invoices/${child.id}`}
                                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">
                                                {child.invoice_number}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {formatDate(child.issue_date)} ·{' '}
                                                <span className="tabular-nums">
                                                    {formatIDR(child.total)}
                                                </span>
                                            </span>
                                        </span>
                                        <StatusBadge status={child.status} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
