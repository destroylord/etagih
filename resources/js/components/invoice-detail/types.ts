import { toNumber } from '@/lib/format';
import type {
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    Payment,
    PaymentSchedule,
} from '@/types/models';

/** Invoice lengkap seperti yang dikirim `InvoiceController@show`. */
export type InvoiceDetail = Invoice & {
    items: InvoiceItem[];
    schedules: PaymentSchedule[];
    payments: Payment[];
};

export type InvoiceSettings = {
    company_name?: string | null;
    company_address?: string | null;
    company_email?: string | null;
    company_phone?: string | null;
    logo_url?: string | null;
    invoice_footer_text?: string | null;
    company_tax_id?: string | null;
    signature_url?: string | null;
    signer_name?: string | null;
    signer_title?: string | null;
    terms?: string[];
    accent_color?: string | null;
    /** Pengingat bea meterai pada kuitansi (default aktif). */
    stamp_duty_enabled?: boolean;
};

/**
 * Batas bea meterai (UU 10/2020): dokumen penerimaan uang > Rp5.000.000
 * wajib bermeterai Rp10.000. Cermin `App\Support\ReceiptPdf::STAMP_DUTY_THRESHOLD`.
 */
export const STAMP_DUTY_THRESHOLD = 5_000_000;

export type RecurringChild = {
    id: number;
    invoice_number: string;
    issue_date: string;
    status: InvoiceStatus;
    total: string | number;
};

/** Status yang masih bisa menerima pembayaran. */
export const OPEN_STATUSES: InvoiceStatus[] = ['sent', 'partial', 'overdue'];

export function isOpen(status: string): boolean {
    return (OPEN_STATUSES as string[]).includes(status);
}

/** Sisa tagihan, dibulatkan ke sen seperti `Invoice::remainingAmount()`. */
export function remainingOf(
    invoice: Pick<Invoice, 'total' | 'paid_amount'>,
): number {
    return Math.max(
        0,
        Math.round(
            (toNumber(invoice.total) - toNumber(invoice.paid_amount)) * 100,
        ) / 100,
    );
}

/**
 * Jumlah jam sebuah item. Backend tidak meng-append `hours_qty`, jadi hitung dari
 * sessions (completed/billed) yang sudah di-eager-load, fallback ke `manual_hours`.
 */
export function itemHours(item: InvoiceItem): number | null {
    if (
        item.hours_qty !== undefined &&
        item.hours_qty !== null &&
        item.hours_qty !== ''
    ) {
        return toNumber(item.hours_qty);
    }

    const seconds = (item.sessions ?? [])
        .filter((s) => s.status === 'completed' || s.status === 'billed')
        .reduce((sum, s) => sum + toNumber(s.duration_seconds), 0);

    if (seconds > 0) {
        return Math.round((seconds / 3600) * 10000) / 10000;
    }

    if (item.manual_hours !== null && item.manual_hours !== undefined) {
        return toNumber(item.manual_hours);
    }

    return null;
}
