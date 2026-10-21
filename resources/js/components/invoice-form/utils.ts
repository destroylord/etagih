import { toNumber } from '@/lib/format';
import type {
    Client,
    Decimal,
    DiscountType,
    InvoiceMode,
    InvoiceType,
    Product,
    ProjectOption,
    Recurrence,
    WorkSession,
} from '@/types/models';

export type FormClient = Pick<Client, 'id' | 'name'> & {
    phone?: string | null;
    email?: string | null;
    hourly_rate?: Decimal | null;
};

export type FormProduct = Pick<Product, 'id' | 'name' | 'client_id'>;

export type FormSession = Pick<
    WorkSession,
    | 'id'
    | 'client_id'
    | 'project_id'
    | 'project'
    | 'description'
    | 'unit_price'
    | 'duration_seconds'
    | 'started_at'
>;

/**
 * Satu baris item di form. `key` hanya untuk React (tidak dikirim).
 * Mode hourly: baris dengan session_ids → jam dari Time Tracker; tanpa sessions → hours_qty manual.
 */
export type ItemRow = {
    key: string;
    product_id: number | null;
    description: string;
    unit_price: string;
    hours_qty: string;
    session_ids: number[];
    /** Sub-proyek baris (null = ikut proyek invoice / tanpa proyek). */
    project_id: number | null;
    /** Tugas yang ditagihkan lewat baris ini (null = bukan dari tugas). */
    task_id: number | null;
    /** Judul tugas untuk badge (tidak dikirim). */
    task_title?: string;
};

export type InvoiceFormData = {
    client_id: number | null;
    /** Proyek atau sub-proyek invoice (opsional). */
    project_id: number | null;
    client: { name: string; phone: string; email: string; address: string };
    invoice_mode: InvoiceMode;
    type: InvoiceType;
    issue_date: string;
    due_date: string;
    notes: string;
    discount_type: DiscountType;
    discount_value: string;
    tax_rate: string;
    /** PPh 23 yang dipotong klien (%), 0 = tidak ada. */
    pph_rate: string;
    recurrence: Recurrence;
    recurrence_auto_send: boolean;
    items: ItemRow[];
    installments: {
        count: number | string;
        first_due_date: string;
        interval_days: number | string;
    };
};

let keySeq = 0;
export const newRowKey = () => `row-${++keySeq}`;

export const blankRow = (overrides: Partial<ItemRow> = {}): ItemRow => ({
    key: newRowKey(),
    product_id: null,
    description: '',
    unit_price: '',
    hours_qty: '',
    session_ids: [],
    project_id: null,
    task_id: null,
    ...overrides,
});

/** "1250000.00" → "1250000"; null → ''. Membersihkan decimal dari backend untuk input. */
export const cleanDecimal = (value: Decimal | null | undefined): string =>
    value === null || value === undefined || value === ''
        ? ''
        : String(toNumber(value));

const positiveRate = (value: Decimal | null | undefined): string =>
    toNumber(value) > 0 ? cleanDecimal(value) : '';

/**
 * Tarif per jam default: sub-proyek → proyek utama → client.
 * Mengembalikan '' bila tidak ada tarif yang diatur.
 */
export function defaultHourlyRate(
    projects: ProjectOption[],
    projectId: number | null,
    clientRate: Decimal | null | undefined,
): string {
    const project =
        projectId !== null ? projects.find((p) => p.id === projectId) : null;
    const parent =
        project?.parent_id != null
            ? projects.find((p) => p.id === project.parent_id)
            : null;

    return (
        positiveRate(project?.hourly_rate) ||
        positiveRate(parent?.hourly_rate) ||
        positiveRate(clientRate)
    );
}

/** Apakah `projectId` adalah `root` itu sendiri atau sub-proyeknya. */
export function isWithinProject(
    projects: ProjectOption[],
    projectId: number | null | undefined,
    rootId: number,
): boolean {
    if (projectId === null || projectId === undefined) {
        return false;
    }

    return (
        projectId === rootId ||
        projects.find((p) => p.id === projectId)?.parent_id === rootId
    );
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type SessionMap = Map<number, FormSession>;

export function rowHours(row: ItemRow, sessions: SessionMap): number {
    if (row.session_ids.length > 0) {
        const seconds = row.session_ids.reduce(
            (s, id) => s + toNumber(sessions.get(id)?.duration_seconds),
            0,
        );

        return seconds / 3600;
    }

    return toNumber(row.hours_qty);
}

/** Cermin InvoiceLineBuilder::buildItems — fixed = unit_price, hourly = jam × tarif. */
export function lineTotal(
    row: ItemRow,
    isHourly: boolean,
    sessions: SessionMap,
): number {
    const price = toNumber(row.unit_price);

    return isHourly ? round2(rowHours(row, sessions) * price) : price;
}

/** Baris yang benar-benar kosong dibuang saat submit. */
export const isBlankRow = (row: ItemRow) =>
    row.product_id === null &&
    row.task_id === null &&
    row.session_ids.length === 0 &&
    row.description.trim() === '' &&
    toNumber(row.unit_price) === 0 &&
    toNumber(row.hours_qty) === 0;

export type Totals = {
    subtotal: number;
    discount: number;
    taxable: number;
    tax: number;
    /** PPh 23 yang dipotong klien. */
    pph: number;
    /** Total tagihan sebelum PPh (DPP + PPN). */
    gross: number;
    /** Total dibayar klien = DPP + PPN − PPh. */
    total: number;
};

/** Cermin InvoiceLineBuilder::applyTotals. */
export function computeTotals(
    subtotal: number,
    discountType: DiscountType,
    discountValue: string,
    taxRate: string,
    pphRate: string = '0',
): Totals {
    const value = toNumber(discountValue);
    let discount =
        discountType === 'percent'
            ? round2((subtotal * Math.min(value, 100)) / 100)
            : value;
    discount = Math.min(Math.max(0, discount), subtotal);
    const taxable = round2(subtotal - discount);
    const tax = round2((taxable * Math.max(0, toNumber(taxRate))) / 100);
    const pph = round2((taxable * Math.max(0, toNumber(pphRate))) / 100);
    const gross = round2(taxable + tax);

    return {
        subtotal: round2(subtotal),
        discount,
        taxable,
        tax,
        pph,
        gross,
        total: Math.max(0, round2(gross - pph)),
    };
}

export type SchedulePreview = {
    sequence: number;
    due_date: string | null;
    amount: number;
};

function addDaysISO(iso: string, days: number): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

    if (!m) {
        return null;
    }

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Cermin InvoiceLineBuilder::buildSchedules — cicilan terakhir menampung sisa pembulatan. */
export function buildSchedulePreview(
    total: number,
    count: number | string,
    firstDue: string,
    intervalDays: number | string,
): SchedulePreview[] {
    const n = Math.min(24, Math.max(2, Math.trunc(toNumber(count)) || 2));
    const interval = Math.max(7, Math.trunc(toNumber(intervalDays)) || 30);
    const per = Math.floor((total / n) * 100) / 100;
    const remainder = round2(total - per * n);

    return Array.from({ length: n }, (_, i) => ({
        sequence: i + 1,
        due_date: firstDue ? addDaysISO(firstDue, i * interval) : null,
        amount: i === n - 1 ? round2(per + remainder) : per,
    }));
}
