import { Head, Link } from '@inertiajs/react';
import { Ban, Info, Repeat } from 'lucide-react';
import { useState } from 'react';
import { InvoiceActions } from '@/components/invoice-detail/invoice-actions';
import { InvoicePaper } from '@/components/invoice-detail/invoice-paper';
import { PaymentHistoryCard } from '@/components/invoice-detail/payment-history-card';
import { PaymentLinkCard } from '@/components/invoice-detail/payment-link-card';
import { PaymentSummaryCard } from '@/components/invoice-detail/payment-summary-card';
import { RecordPaymentDialog } from '@/components/invoice-detail/record-payment-dialog';
import { RecurringCard } from '@/components/invoice-detail/recurring-card';
import { ScheduleCard } from '@/components/invoice-detail/schedule-card';
import type {
    InvoiceDetail,
    InvoiceSettings,
    RecurringChild,
} from '@/components/invoice-detail/types';
import { isOpen } from '@/components/invoice-detail/types';
import { StatusBadge } from '@/components/invoice-status-badge';
import { PageContainer, PageHeader } from '@/components/page-header';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';

export default function InvoicesShow({
    invoice,
    settings,
    recurringChildren = [],
}: {
    invoice: InvoiceDetail;
    settings?: InvoiceSettings;
    recurringChildren?: RecurringChild[];
}) {
    const [paymentOpen, setPaymentOpen] = useState(false);
    const cancelled = invoice.status === 'cancelled';
    const open = isOpen(invoice.status);

    return (
        <>
            <Head title={`Invoice ${invoice.invoice_number}`} />
            <PageContainer>
                <PageHeader
                    backHref="/invoices"
                    title={invoice.invoice_number}
                    meta={<StatusBadge status={invoice.status} />}
                    description={
                        <>
                            {invoice.client ? (
                                <Link
                                    href={`/clients/${invoice.client.id}`}
                                    className="font-medium text-foreground hover:underline"
                                >
                                    {invoice.client.name}
                                </Link>
                            ) : (
                                'Tanpa klien'
                            )}
                            {invoice.project && (
                                <>
                                    {' · '}
                                    <Link
                                        href={`/projects/${invoice.project.id}`}
                                        className="hover:underline"
                                    >
                                        {invoice.project.parent
                                            ? `${invoice.project.parent.name} › ${invoice.project.name}`
                                            : invoice.project.name}
                                    </Link>
                                </>
                            )}
                            {' · '}
                            <span className="tabular-nums">
                                {formatIDR(invoice.total)}
                            </span>
                            {' · '}
                            {formatDate(invoice.issue_date)}
                        </>
                    }
                    actions={
                        <InvoiceActions
                            invoice={invoice}
                            onRecordPayment={() => setPaymentOpen(true)}
                        />
                    }
                />

                {cancelled && (
                    <div
                        role="status"
                        className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                    >
                        <Ban className="mt-0.5 size-4 shrink-0" />
                        <div className="space-y-0.5">
                            <p className="font-semibold">
                                Invoice dibatalkan
                                {invoice.cancelled_at && (
                                    <>
                                        {' '}
                                        pada{' '}
                                        {formatDateTime(invoice.cancelled_at)}
                                    </>
                                )}
                            </p>
                            <p className="text-red-700/90 dark:text-red-300/90">
                                {invoice.cancel_reason ? (
                                    <>Alasan: {invoice.cancel_reason}</>
                                ) : (
                                    'Tidak ada alasan yang dicatat.'
                                )}{' '}
                                Invoice ini tidak dihitung sebagai piutang dan
                                tidak bisa dibayar.
                            </p>
                        </div>
                    </div>
                )}

                {invoice.status === 'draft' && (
                    <div className="flex gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                        <Info className="mt-0.5 size-4 shrink-0" />
                        <p>
                            Ini masih{' '}
                            <span className="font-medium text-foreground">
                                draft
                            </span>{' '}
                            — klien belum menerima apa pun. Periksa isinya lalu
                            klik{' '}
                            <span className="font-medium text-foreground">
                                Kirim ke klien
                            </span>
                            .
                        </p>
                    </div>
                )}

                {invoice.recurring_parent && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Repeat className="size-4 shrink-0" />
                        <span>
                            Dibuat otomatis dari{' '}
                            <Link
                                href={`/invoices/${invoice.recurring_parent.id}`}
                                className="font-medium text-foreground underline-offset-4 hover:underline"
                            >
                                {invoice.recurring_parent.invoice_number}
                            </Link>
                        </span>
                    </div>
                )}

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="min-w-0">
                        <InvoicePaper invoice={invoice} settings={settings} />
                    </div>

                    {/* Mobile: ringkasan pembayaran tampil di atas kertas invoice. */}
                    <aside className="contents lg:grid lg:gap-4">
                        <div className="order-first min-w-0 lg:order-none">
                            <PaymentSummaryCard
                                invoice={invoice}
                                onRecordPayment={
                                    open
                                        ? () => setPaymentOpen(true)
                                        : undefined
                                }
                            />
                        </div>
                        <RecurringCard
                            invoice={invoice}
                            generated={recurringChildren}
                        />
                        {!cancelled && <PaymentLinkCard invoice={invoice} />}
                        <ScheduleCard invoice={invoice} />
                        {invoice.status !== 'draft' && (
                            <PaymentHistoryCard invoice={invoice} />
                        )}
                    </aside>
                </div>
            </PageContainer>

            {open && (
                <RecordPaymentDialog
                    invoice={invoice}
                    open={paymentOpen}
                    onOpenChange={setPaymentOpen}
                />
            )}
        </>
    );
}
