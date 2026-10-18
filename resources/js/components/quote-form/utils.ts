import { toNumber } from '@/lib/format';
import type { DiscountType } from '@/types/models';

/** Satu baris item penawaran di form. `key` hanya untuk React (tidak dikirim). */
export type QuoteItemRow = {
    key: string;
    product_id: number | null;
    description: string;
    quantity: string;
    unit_price: string;
    /** Sub-proyek baris (null = ikut proyek penawaran / tanpa proyek). */
    project_id: number | null;
};

export type QuoteFormData = {
    client_id: number | null;
    project_id: number | null;
    client: { name: string; phone: string; email: string; address: string };
    issue_date: string;
    valid_until: string;
    discount_type: DiscountType;
    discount_value: string;
    tax_rate: string;
    pph_rate: string;
    notes: string;
    terms: string;
    items: QuoteItemRow[];
};

let keySeq = 0;

export const blankQuoteRow = (
    overrides: Partial<QuoteItemRow> = {},
): QuoteItemRow => ({
    key: `q-row-${++keySeq}`,
    product_id: null,
    description: '',
    quantity: '1',
    unit_price: '',
    project_id: null,
    ...overrides,
});

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Cermin QuoteLineBuilder: line_total = qty × harga. */
export function quoteLineTotal(
    row: Pick<QuoteItemRow, 'quantity' | 'unit_price'>,
) {
    return round2(
        round2(toNumber(row.quantity)) * round2(toNumber(row.unit_price)),
    );
}

/** Baris yang benar-benar kosong dibuang saat submit. */
export const isBlankQuoteRow = (row: QuoteItemRow) =>
    row.product_id === null &&
    row.description.trim() === '' &&
    toNumber(row.unit_price) === 0;

export type QuoteTotals = {
    subtotal: number;
    discount: number;
    taxable: number;
    tax: number;
    pph: number;
    gross: number;
    total: number;
};

/** Cermin App\Support\DocumentTotals: total = DPP + PPN − PPh 23. */
export function computeQuoteTotals(
    subtotal: number,
    discountType: DiscountType,
    discountValue: string,
    taxRate: string,
    pphRate: string,
): QuoteTotals {
    const value = toNumber(discountValue);
    let discount =
        discountType === 'percent'
            ? round2((subtotal * Math.min(value, 100)) / 100)
            : value;
    discount = Math.min(Math.max(0, discount), subtotal);
    const taxable = round2(subtotal - discount);
    const tax = round2((taxable * Math.max(0, toNumber(taxRate))) / 100);
    const pph = round2((taxable * Math.max(0, toNumber(pphRate))) / 100);

    return {
        subtotal: round2(subtotal),
        discount,
        taxable,
        tax,
        pph,
        gross: round2(taxable + tax),
        total: Math.max(0, round2(taxable + tax - pph)),
    };
}

/** "2026-10-18" + n hari → "2026-11-01" (tanggal lokal). */
export function addDaysISO(iso: string, days: number): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);

    if (!m) {
        return '';
    }

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Selisih hari antara dua tanggal ISO. */
export function daysBetweenISO(from: string, to: string): number | null {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(from);
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(to);

    if (!a || !b) {
        return null;
    }

    const da = new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
    const db = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3]));

    return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}
