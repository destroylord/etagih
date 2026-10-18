import { Fragment } from 'react';
import { formatDate, formatIDR, formatNumber, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InvoiceItem } from '@/types/models';
import type { InvoiceDetail, InvoiceSettings } from './types';
import { itemHours, remainingOf } from './types';

type Group = {
    key: string;
    name: string | null;
    rows: InvoiceItem[];
    /** Subtotal kelompok (hanya saat dikelompokkan per sub-proyek). */
    subtotal: number | null;
};

/**
 * Sama dengan PDF: bila ada item yang ditautkan ke sub-proyek, kelompokkan
 * per sub-proyek (dengan subtotal); selain itu kelompokkan per produk.
 */
function groupItems(
    items: InvoiceItem[],
    invoiceProjectName: string | null,
): { groups: Group[]; byProject: boolean } {
    const byProject = items.some(
        (i) => i.project_id !== null && i.project_id !== undefined,
    );
    const groups: Group[] = [];

    for (const item of items) {
        const key = byProject
            ? item.project_id
                ? `pr-${item.project_id}`
                : 'invoice'
            : item.product_id
              ? `p-${item.product_id}`
              : 'manual';
        let group = groups.find((g) => g.key === key);

        if (!group) {
            const name = byProject
                ? (item.project?.name ?? invoiceProjectName ?? 'Umum')
                : (item.product?.name ?? null);
            group = { key, name, rows: [], subtotal: byProject ? 0 : null };
            groups.push(group);
        }

        group.rows.push(item);

        if (group.subtotal !== null) {
            group.subtotal += toNumber(item.line_total);
        }
    }

    return { groups, byProject };
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            {children}
        </div>
    );
}

function TotalRow({
    label,
    value,
    className,
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-4',
                className,
            )}
        >
            <dt>{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
        </div>
    );
}

/**
 * Pratinjau "kertas" invoice. Sengaja selalu terang (putih) agar mirip PDF,
 * termasuk saat dark mode.
 */
export function InvoicePaper({
    invoice,
    settings,
}: {
    invoice: InvoiceDetail;
    settings?: InvoiceSettings;
}) {
    const companyName = settings?.company_name || 'Perusahaan Saya';
    const client = invoice.client;
    const projectLabel = invoice.project
        ? invoice.project.parent
            ? `${invoice.project.parent.name} › ${invoice.project.name}`
            : invoice.project.name
        : null;
    const { groups, byProject } = groupItems(
        invoice.items,
        invoice.project?.name ?? null,
    );
    const showHours =
        invoice.invoice_mode === 'hourly' ||
        invoice.items.some((i) => (itemHours(i) ?? 0) > 0);
    const colCount = showHours ? 4 : 3;

    const discount = toNumber(invoice.discount);
    const tax = toNumber(invoice.tax_amount);
    const pph = toNumber(invoice.pph_amount);
    const paid = toNumber(invoice.paid_amount);
    const cancelled = invoice.status === 'cancelled';
    const isPaid = invoice.status === 'paid';

    return (
        <div className="relative overflow-hidden rounded-xl border bg-white text-gray-900 shadow-sm">
            {(cancelled || isPaid) && (
                <div
                    aria-hidden
                    className={cn(
                        'pointer-events-none absolute top-8 right-6 rotate-12 rounded-md border-[3px] px-3 py-1 text-lg font-extrabold tracking-[0.2em] uppercase opacity-60 select-none sm:top-10 sm:right-10 sm:text-2xl',
                        cancelled
                            ? 'border-red-500 text-red-500'
                            : 'border-emerald-500 text-emerald-600',
                    )}
                >
                    {cancelled ? 'Dibatalkan' : 'Lunas'}
                </div>
            )}

            <div className="p-5 sm:p-10">
                {/* Header perusahaan */}
                <div className="flex flex-col gap-6 border-b-2 border-gray-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-[280px]">
                        {settings?.logo_url ? (
                            <img
                                src={settings.logo_url}
                                alt={companyName}
                                className="mb-3 max-h-16 object-contain"
                            />
                        ) : (
                            <div className="text-xl font-extrabold tracking-tight sm:text-2xl">
                                {companyName}
                            </div>
                        )}
                        {settings?.company_address && (
                            <div className="mt-1 text-xs leading-relaxed whitespace-pre-line text-gray-500">
                                {settings.company_address}
                            </div>
                        )}
                    </div>
                    <div className="sm:text-right">
                        <div className="text-2xl font-extrabold tracking-[0.12em] sm:text-3xl">
                            INVOICE
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-700">
                            {invoice.invoice_number}
                        </div>
                        <dl className="mt-3 space-y-0.5 text-sm text-gray-600">
                            <div className="flex gap-2 sm:justify-end">
                                <dt className="text-gray-400">Diterbitkan</dt>
                                <dd className="font-medium">
                                    {formatDate(invoice.issue_date)}
                                </dd>
                            </div>
                            {invoice.due_date && (
                                <div className="flex gap-2 sm:justify-end">
                                    <dt className="text-gray-400">
                                        Jatuh tempo
                                    </dt>
                                    <dd className="font-medium">
                                        {formatDate(invoice.due_date)}
                                    </dd>
                                </div>
                            )}
                            <div className="flex gap-2 sm:justify-end">
                                <dt className="text-gray-400">Pembayaran</dt>
                                <dd className="font-medium">
                                    {invoice.type === 'installment'
                                        ? 'Cicilan'
                                        : 'Penuh'}
                                    {invoice.invoice_mode === 'hourly'
                                        ? ' · Per jam'
                                        : ' · Uraian jasa'}
                                </dd>
                            </div>
                            {projectLabel && (
                                <div className="flex gap-2 sm:justify-end">
                                    <dt className="text-gray-400">Proyek</dt>
                                    <dd className="font-medium">
                                        {projectLabel}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>

                {/* Tagihan untuk & dari */}
                <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2 sm:gap-8">
                    <div>
                        <Label>Tagihan untuk</Label>
                        <div className="font-semibold">
                            {client?.name ?? '—'}
                        </div>
                        {client?.phone && (
                            <div className="text-sm text-gray-600">
                                {client.phone}
                            </div>
                        )}
                        {client?.email && (
                            <div className="text-sm break-all text-gray-600">
                                {client.email}
                            </div>
                        )}
                        {client?.address && (
                            <div className="mt-1 text-sm whitespace-pre-line text-gray-600">
                                {client.address}
                            </div>
                        )}
                    </div>
                    <div>
                        <Label>Dari</Label>
                        <div className="font-semibold">{companyName}</div>
                        {settings?.company_email && (
                            <div className="text-sm break-all text-gray-600">
                                {settings.company_email}
                            </div>
                        )}
                        {settings?.company_phone && (
                            <div className="text-sm text-gray-600">
                                {settings.company_phone}
                            </div>
                        )}
                    </div>
                </div>

                {/* Item */}
                <div className="-mx-5 mt-8 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[480px] text-sm">
                        <thead>
                            <tr className="bg-gray-100 text-left text-xs font-semibold tracking-wide text-gray-600 uppercase">
                                <th className="py-2.5 pr-3 pl-5 sm:pl-4">
                                    Deskripsi
                                </th>
                                {showHours && (
                                    <th className="px-3 py-2.5 text-right">
                                        Jam
                                    </th>
                                )}
                                <th className="px-3 py-2.5 text-right">
                                    Harga
                                </th>
                                <th className="py-2.5 pr-5 pl-3 text-right sm:pr-4">
                                    Jumlah
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map((group) => (
                                <Fragment key={group.key}>
                                    {group.name && (
                                        <tr className="border-t border-gray-200 bg-gray-50">
                                            <td
                                                colSpan={colCount - 1}
                                                className="py-2 pr-3 pl-5 font-semibold sm:pl-4"
                                            >
                                                {group.name}
                                            </td>
                                            <td className="py-2 pr-5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums sm:pr-4">
                                                {group.subtotal !== null &&
                                                    formatIDR(group.subtotal)}
                                            </td>
                                        </tr>
                                    )}
                                    {group.rows.map((item) => {
                                        const hours = itemHours(item);

                                        return (
                                            <tr
                                                key={item.id}
                                                className="border-t border-gray-100 align-top"
                                            >
                                                <td
                                                    className={cn(
                                                        'py-2.5 pr-3 whitespace-pre-line',
                                                        group.name
                                                            ? 'pl-9 text-gray-600 sm:pl-8'
                                                            : 'pl-5 sm:pl-4',
                                                    )}
                                                >
                                                    {byProject &&
                                                        item.product && (
                                                            <span className="font-medium text-gray-900">
                                                                {
                                                                    item.product
                                                                        .name
                                                                }{' '}
                                                                —{' '}
                                                            </span>
                                                        )}
                                                    {item.description}
                                                </td>
                                                {showHours && (
                                                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                                                        {hours
                                                            ? formatNumber(
                                                                  hours,
                                                              )
                                                            : '—'}
                                                    </td>
                                                )}
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-600 tabular-nums">
                                                    {formatIDR(item.unit_price)}
                                                </td>
                                                <td className="py-2.5 pr-5 pl-3 text-right font-medium whitespace-nowrap tabular-nums sm:pr-4">
                                                    {formatIDR(item.line_total)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </Fragment>
                            ))}
                            {invoice.items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={colCount}
                                        className="py-6 text-center text-gray-400"
                                    >
                                        Belum ada item.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Total */}
                <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
                    <dl className="w-full max-w-xs space-y-1.5 text-sm text-gray-600">
                        <TotalRow
                            label="Subtotal"
                            value={formatIDR(invoice.subtotal)}
                        />
                        {discount > 0 && (
                            <TotalRow
                                label={
                                    invoice.discount_type === 'percent'
                                        ? `Diskon (${formatNumber(invoice.discount_value)}%)`
                                        : 'Diskon'
                                }
                                value={`− ${formatIDR(discount)}`}
                            />
                        )}
                        {discount > 0 && (tax > 0 || pph > 0) && (
                            <TotalRow
                                label="Dasar Pengenaan Pajak"
                                value={formatIDR(
                                    toNumber(invoice.subtotal) - discount,
                                )}
                            />
                        )}
                        {tax > 0 && (
                            <TotalRow
                                label={`PPN ${formatNumber(invoice.tax_rate)}%`}
                                value={formatIDR(tax)}
                            />
                        )}
                        {pph > 0 && (
                            <>
                                <TotalRow
                                    label="Total tagihan"
                                    value={formatIDR(
                                        toNumber(invoice.total) + pph,
                                    )}
                                    className="border-t border-gray-200 pt-1.5"
                                />
                                <TotalRow
                                    label={`PPh 23 (${formatNumber(invoice.pph_rate)}%) dipotong klien`}
                                    value={`− ${formatIDR(pph)}`}
                                />
                            </>
                        )}
                        <TotalRow
                            label={pph > 0 ? 'Total dibayar' : 'Total'}
                            value={formatIDR(invoice.total)}
                            className="border-t border-gray-300 pt-2 text-base font-bold text-gray-900"
                        />
                        {!cancelled && paid > 0 && (
                            <>
                                <TotalRow
                                    label="Sudah dibayar"
                                    value={`− ${formatIDR(paid)}`}
                                />
                                <TotalRow
                                    label="Sisa tagihan"
                                    value={formatIDR(remainingOf(invoice))}
                                    className="font-semibold text-gray-900"
                                />
                            </>
                        )}
                    </dl>
                </div>

                {/* Catatan, syarat & tanda tangan — sama dengan PDF. */}
                <div className="mt-8 grid gap-8 border-t border-gray-100 pt-6 sm:grid-cols-[1fr_200px]">
                    <div className="space-y-4 text-sm text-gray-600">
                        {invoice.notes && (
                            <div>
                                <Label>Catatan</Label>
                                <div className="whitespace-pre-line">
                                    {invoice.notes}
                                </div>
                            </div>
                        )}
                        {settings?.terms && settings.terms.length > 0 && (
                            <div>
                                <Label>Syarat &amp; ketentuan</Label>
                                <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-500">
                                    {settings.terms.map((t, i) => (
                                        <li key={i}>{t}</li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                    <div className="text-center text-xs text-gray-500">
                        <div>Hormat kami,</div>
                        <div className="my-2 flex h-16 items-center justify-center">
                            {settings?.signature_url && (
                                <img
                                    src={settings.signature_url}
                                    alt="Tanda tangan"
                                    className="max-h-16 max-w-full object-contain"
                                />
                            )}
                        </div>
                        <div className="border-t border-gray-800 pt-1 text-sm font-semibold text-gray-900">
                            {settings?.signer_name ||
                                settings?.company_name ||
                                'Perusahaan Saya'}
                        </div>
                        {settings?.signer_title && (
                            <div>{settings.signer_title}</div>
                        )}
                    </div>
                </div>
            </div>

            {settings?.invoice_footer_text && (
                <div className="border-t border-gray-100 px-5 py-4 text-center text-xs whitespace-pre-line text-gray-400 sm:px-10">
                    {settings.invoice_footer_text}
                </div>
            )}
        </div>
    );
}
