import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatIDR, formatNumber, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    PublicQuote,
    QuoteDetail,
    QuoteItem,
    QuoteSettings,
} from '@/types/quotes';
import { quoteTerms } from '@/types/quotes';

type Group = {
    key: string;
    name: string | null;
    rows: QuoteItem[];
    subtotal: number | null;
};

/** Sama dengan PDF: kelompokkan per sub-proyek (dengan subtotal) atau per produk. */
export function groupQuoteItems(
    items: QuoteItem[],
    quoteProjectName: string | null,
): Group[] {
    const byProject = items.some(
        (i) => i.project_id !== null && i.project_id !== undefined,
    );
    const groups: Group[] = [];

    for (const item of items) {
        const key = byProject
            ? item.project_id
                ? `pr-${item.project_id}`
                : 'quote'
            : item.product_id
              ? `p-${item.product_id}`
              : 'manual';
        let group = groups.find((g) => g.key === key);

        if (!group) {
            const name = byProject
                ? (item.project?.name ?? quoteProjectName ?? 'Umum')
                : (item.product?.name ?? null);
            group = { key, name, rows: [], subtotal: byProject ? 0 : null };
            groups.push(group);
        }

        group.rows.push(item);

        if (group.subtotal !== null) {
            group.subtotal += toNumber(item.line_total);
        }
    }

    return groups;
}

function Label({ children }: { children: ReactNode }) {
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
            <dt>{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
        </div>
    );
}

/** Tabel item + total — dipakai pratinjau admin & halaman publik. */
export function QuoteItemsTable({
    quote,
}: {
    quote: Pick<
        QuoteDetail | PublicQuote,
        | 'items'
        | 'project'
        | 'subtotal'
        | 'discount'
        | 'discount_type'
        | 'discount_value'
        | 'tax_rate'
        | 'tax_amount'
        | 'pph_rate'
        | 'pph_amount'
        | 'total'
    >;
}) {
    const groups = groupQuoteItems(quote.items, quote.project?.name ?? null);
    const discount = toNumber(quote.discount);
    const tax = toNumber(quote.tax_amount);
    const pph = toNumber(quote.pph_amount);

    return (
        <>
            <div className="-mx-5 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[480px] text-sm">
                    <thead>
                        <tr className="bg-gray-100 text-left text-xs font-semibold tracking-wide text-gray-600 uppercase">
                            <th className="py-2.5 pr-3 pl-5 sm:pl-4">
                                Deskripsi
                            </th>
                            <th className="px-3 py-2.5 text-right">Qty</th>
                            <th className="px-3 py-2.5 text-right">Harga</th>
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
                                            colSpan={3}
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
                                {group.rows.map((item) => (
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
                                            {item.description}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                                            {formatNumber(item.quantity)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-600 tabular-nums">
                                            {formatIDR(item.unit_price)}
                                        </td>
                                        <td className="py-2.5 pr-5 pl-3 text-right font-medium whitespace-nowrap tabular-nums sm:pr-4">
                                            {formatIDR(item.line_total)}
                                        </td>
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                        {quote.items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="py-6 text-center text-gray-400"
                                >
                                    Belum ada item.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
                <dl className="w-full max-w-xs space-y-1.5 text-sm text-gray-600">
                    <TotalRow
                        label="Subtotal"
                        value={formatIDR(quote.subtotal)}
                    />
                    {discount > 0 && (
                        <TotalRow
                            label={
                                quote.discount_type === 'percent'
                                    ? `Diskon (${formatNumber(quote.discount_value)}%)`
                                    : 'Diskon'
                            }
                            value={`− ${formatIDR(discount)}`}
                        />
                    )}
                    {discount > 0 && (tax > 0 || pph > 0) && (
                        <TotalRow
                            label="DPP"
                            value={formatIDR(
                                toNumber(quote.subtotal) - discount,
                            )}
                        />
                    )}
                    {tax > 0 && (
                        <TotalRow
                            label={`PPN ${formatNumber(quote.tax_rate)}%`}
                            value={formatIDR(tax)}
                        />
                    )}
                    {pph > 0 && (
                        <TotalRow
                            label={`PPh 23 (${formatNumber(quote.pph_rate)}%) dipotong klien`}
                            value={`− ${formatIDR(pph)}`}
                        />
                    )}
                    <TotalRow
                        label={pph > 0 ? 'Total dibayar' : 'Total'}
                        value={formatIDR(quote.total)}
                        className="border-t border-gray-300 pt-2 text-base font-bold text-gray-900"
                    />
                </dl>
            </div>
        </>
    );
}

/**
 * Pratinjau "kertas" penawaran — selalu terang agar mirip PDF.
 */
export function QuotePaper({
    quote,
    settings,
}: {
    quote: QuoteDetail;
    settings?: QuoteSettings;
}) {
    const companyName = settings?.company_name || 'Perusahaan Saya';
    const client = quote.client;
    const projectLabel = quote.project
        ? quote.project.parent
            ? `${quote.project.parent.name} › ${quote.project.name}`
            : quote.project.name
        : null;
    const terms = quoteTerms(quote.terms);
    const stamp =
        quote.status === 'accepted' || quote.status === 'converted'
            ? { label: 'Diterima', tone: 'ok' }
            : quote.status === 'declined'
              ? { label: 'Ditolak', tone: 'bad' }
              : quote.status === 'expired'
                ? { label: 'Kedaluwarsa', tone: 'bad' }
                : null;

    return (
        <div className="relative overflow-hidden rounded-xl border bg-white text-gray-900 shadow-sm">
            {stamp && (
                <div
                    aria-hidden
                    className={cn(
                        'pointer-events-none absolute top-8 right-6 rotate-12 rounded-md border-[3px] px-3 py-1 text-lg font-extrabold tracking-[0.2em] uppercase opacity-60 select-none sm:top-10 sm:right-10 sm:text-2xl',
                        stamp.tone === 'ok'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-red-500 text-red-500',
                    )}
                >
                    {stamp.label}
                </div>
            )}

            <div className="p-5 sm:p-10">
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
                        <div className="text-xl font-extrabold tracking-[0.12em] sm:text-2xl">
                            PENAWARAN HARGA
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-700">
                            {quote.quote_number}
                        </div>
                        <dl className="mt-3 space-y-0.5 text-sm text-gray-600">
                            <div className="flex gap-2 sm:justify-end">
                                <dt className="text-gray-400">Tanggal</dt>
                                <dd className="font-medium">
                                    {formatDate(quote.issue_date)}
                                </dd>
                            </div>
                            <div className="flex gap-2 sm:justify-end">
                                <dt className="text-gray-400">
                                    Berlaku sampai
                                </dt>
                                <dd className="font-medium">
                                    {formatDate(
                                        quote.valid_until,
                                        'Tidak dibatasi',
                                    )}
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

                <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2 sm:gap-8">
                    <div>
                        <Label>Ditujukan kepada</Label>
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

                <div className="mt-8">
                    <QuoteItemsTable quote={quote} />
                </div>

                <div className="mt-8 grid gap-8 border-t border-gray-100 pt-6 sm:grid-cols-[1fr_200px]">
                    <div className="space-y-4 text-sm text-gray-600">
                        {quote.notes && (
                            <div>
                                <Label>Catatan</Label>
                                <div className="whitespace-pre-line">
                                    {quote.notes}
                                </div>
                            </div>
                        )}
                        {terms.length > 0 && (
                            <div>
                                <Label>Syarat &amp; ketentuan</Label>
                                <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-500">
                                    {terms.map((t, i) => (
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
                            {settings?.signer_name || companyName}
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
