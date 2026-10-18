import { FileDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    formatDate,
    formatDateTime,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InvoiceItem } from '@/types/models';
import type { PayCompany, PayInvoice } from './types';

type Group = {
    key: string;
    name: string | null;
    rows: InvoiceItem[];
    subtotal: number | null;
};

/**
 * Sama dengan PDF: item yang ditautkan ke sub-proyek dikelompokkan per
 * sub-proyek (dengan subtotal); selain itu per produk.
 */
function groupItems(
    items: InvoiceItem[],
    invoiceProjectName: string | null,
): { groups: Group[]; byProject: boolean } {
    const byProject = items.some((i) => i.project_id != null);
    const groups: Group[] = [];

    for (const it of items) {
        const key = byProject
            ? it.project_id
                ? `pr-${it.project_id}`
                : 'invoice'
            : it.product_id
              ? String(it.product_id)
              : 'manual';
        let g = groups.find((x) => x.key === key);

        if (!g) {
            g = {
                key,
                name: byProject
                    ? (it.project?.name ?? invoiceProjectName ?? 'Umum')
                    : (it.product?.name ?? null),
                rows: [],
                subtotal: byProject ? 0 : null,
            };
            groups.push(g);
        }

        g.rows.push(it);

        if (g.subtotal !== null) {
            g.subtotal += toNumber(it.line_total);
        }
    }

    return { groups, byProject };
}

function itemQty(item: InvoiceItem): number {
    if (item.manual_hours !== null && item.manual_hours !== undefined) {
        return toNumber(item.manual_hours);
    }

    if (item.hours_qty !== null && item.hours_qty !== undefined) {
        return toNumber(item.hours_qty);
    }

    const price = toNumber(item.unit_price);

    return price > 0 ? toNumber(item.line_total) / price : 1;
}

function Row({
    label,
    value,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-4',
                className,
            )}
        >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
        </div>
    );
}

export function InvoiceDetails({
    invoice,
    company,
}: {
    invoice: PayInvoice;
    company: PayCompany;
}) {
    const { groups, byProject } = groupItems(
        invoice.items,
        invoice.project?.name ?? null,
    );
    const projectLabel = invoice.project
        ? invoice.project.parent
            ? `${invoice.project.parent.name} › ${invoice.project.name}`
            : invoice.project.name
        : null;
    const discount = toNumber(invoice.discount);
    const taxRate = toNumber(invoice.tax_rate);
    const taxAmount = toNumber(invoice.tax_amount);
    const pph = toNumber(invoice.pph_amount);
    const paid = toNumber(invoice.paid_amount);
    const receipts = invoice.payments
        .filter((p) => p.status === 'success')
        .sort((a, b) =>
            String(a.paid_at ?? a.created_at).localeCompare(
                String(b.paid_at ?? b.created_at),
            ),
        );

    return (
        <Card className="gap-0 overflow-hidden py-0">
            {/* Meta */}
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Ditagihkan kepada
                    </p>
                    <p className="mt-1 font-semibold break-words">
                        {invoice.client.name}
                    </p>
                    {invoice.client.email && (
                        <p className="text-sm break-all text-muted-foreground">
                            {invoice.client.email}
                        </p>
                    )}
                    {projectLabel && (
                        <p className="mt-2 text-sm">
                            <span className="text-muted-foreground">
                                Proyek:{' '}
                            </span>
                            <span className="font-medium">{projectLabel}</span>
                        </p>
                    )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:text-right">
                    <div>
                        <dt className="text-xs text-muted-foreground">
                            Tanggal terbit
                        </dt>
                        <dd className="font-medium">
                            {formatDate(invoice.issue_date)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">
                            Jatuh tempo
                        </dt>
                        <dd className="font-medium">
                            {formatDate(invoice.due_date)}
                        </dd>
                    </div>
                </dl>
            </div>

            <Separator />

            {/* Items */}
            <div className="p-5 sm:p-6">
                <h2 className="mb-3 text-sm font-semibold">Rincian tagihan</h2>
                <div className="hidden grid-cols-[1fr_auto_auto] gap-4 border-b pb-2 text-xs font-medium text-muted-foreground sm:grid">
                    <span>Deskripsi</span>
                    <span className="w-28 text-right">Qty × Harga</span>
                    <span className="w-28 text-right">Jumlah</span>
                </div>
                <ul className="divide-y">
                    {groups.map((g) => (
                        <li key={g.key} className="py-1">
                            {g.name && (
                                <p className="flex items-baseline justify-between gap-3 pt-2 text-sm font-semibold">
                                    <span className="min-w-0 break-words">
                                        {g.name}
                                    </span>
                                    {g.subtotal !== null && (
                                        <span className="tabular-nums">
                                            {formatIDR(g.subtotal)}
                                        </span>
                                    )}
                                </p>
                            )}
                            <ul>
                                {g.rows.map((item) => {
                                    const qty = itemQty(item);

                                    return (
                                        <li
                                            key={item.id}
                                            className={cn(
                                                'grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2 text-sm sm:grid-cols-[1fr_auto_auto]',
                                                g.name && 'pl-3 sm:pl-4',
                                            )}
                                        >
                                            <span className="min-w-0 break-words">
                                                {byProject && item.product && (
                                                    <span className="font-medium">
                                                        {item.product.name}{' '}
                                                        —{' '}
                                                    </span>
                                                )}
                                                {item.description}
                                            </span>
                                            <span className="col-start-1 row-start-2 text-xs text-muted-foreground tabular-nums sm:col-start-auto sm:row-start-auto sm:w-28 sm:text-right sm:text-sm">
                                                {formatNumber(qty)} ×{' '}
                                                {formatIDR(item.unit_price)}
                                            </span>
                                            <span className="row-span-2 text-right font-medium tabular-nums sm:row-span-1 sm:w-28">
                                                {formatIDR(item.line_total)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                    ))}
                </ul>

                {/* Totals */}
                <dl className="mt-4 ml-auto space-y-2 border-t pt-4 text-sm sm:max-w-xs">
                    <Row label="Subtotal" value={formatIDR(invoice.subtotal)} />
                    {discount > 0 && (
                        <Row
                            label={
                                invoice.discount_type === 'percent'
                                    ? `Diskon (${formatNumber(invoice.discount_value)}%)`
                                    : 'Diskon'
                            }
                            value={
                                <span className="text-emerald-600 dark:text-emerald-400">
                                    − {formatIDR(discount)}
                                </span>
                            }
                        />
                    )}
                    {(taxRate > 0 || taxAmount > 0) && (
                        <Row
                            label={`PPN (${formatNumber(taxRate)}%)`}
                            value={formatIDR(taxAmount)}
                        />
                    )}
                    {pph > 0 && (
                        <>
                            <Row
                                label="Total tagihan"
                                value={formatIDR(toNumber(invoice.total) + pph)}
                                className="border-t pt-2"
                            />
                            <Row
                                label={`PPh 23 (${formatNumber(invoice.pph_rate)}%) dipotong`}
                                value={`− ${formatIDR(pph)}`}
                            />
                        </>
                    )}
                    <Row
                        label={
                            <span className="font-semibold text-foreground">
                                {pph > 0 ? 'Total dibayar' : 'Total'}
                            </span>
                        }
                        value={
                            <span className="text-base font-semibold">
                                {formatIDR(invoice.total)}
                            </span>
                        }
                        className="border-t pt-2"
                    />
                    {paid > 0 && (
                        <Row
                            label="Sudah dibayar"
                            value={
                                <span className="text-emerald-600 dark:text-emerald-400">
                                    − {formatIDR(paid)}
                                </span>
                            }
                        />
                    )}
                </dl>
                {pph > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground sm:ml-auto sm:max-w-xs">
                        PPh 23 dipotong &amp; disetor sendiri oleh pihak Anda —
                        mohon kirimkan bukti potongnya kepada kami.
                    </p>
                )}
            </div>

            {receipts.length > 0 && (
                <>
                    <Separator />
                    <div className="p-5 sm:p-6">
                        <h2 className="mb-3 text-sm font-semibold">
                            Kuitansi pembayaran
                        </h2>
                        <ul className="divide-y rounded-lg border text-sm">
                            {receipts.map((p) => (
                                <li
                                    key={p.id}
                                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
                                >
                                    <span className="min-w-0">
                                        <span className="font-medium tabular-nums">
                                            {formatIDR(p.amount)}
                                        </span>{' '}
                                        <span className="text-xs text-muted-foreground">
                                            {p.receipt_number
                                                ? `${p.receipt_number} · `
                                                : ''}
                                            {formatDateTime(
                                                p.paid_at ?? p.created_at,
                                            )}
                                        </span>
                                    </span>
                                    <a
                                        href={`/pay/${invoice.public_token}/receipts/${p.id}`}
                                        target="_blank"
                                        rel="noopener"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                                    >
                                        <FileDown className="size-3.5" />
                                        Unduh kuitansi
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}

            {(invoice.notes || company.company_address) && (
                <>
                    <Separator />
                    <div className="grid gap-4 p-5 text-sm sm:grid-cols-2 sm:p-6">
                        {invoice.notes && (
                            <div>
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Catatan
                                </p>
                                <p className="mt-1 whitespace-pre-line">
                                    {invoice.notes}
                                </p>
                            </div>
                        )}
                        {company.company_address && (
                            <div>
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Alamat penerbit
                                </p>
                                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                                    {company.company_address}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
}
