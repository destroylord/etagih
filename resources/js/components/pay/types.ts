import type {
    Client,
    Invoice,
    InvoiceItem,
    Payment,
    PaymentSchedule,
} from '@/types/models';

/** Invoice seperti dikirim PaymentController::show (relasi sudah di-load). */
export type PayInvoice = Invoice & {
    client: Client;
    items: InvoiceItem[];
    schedules: PaymentSchedule[];
    payments: Payment[];
};

export type PayCompany = {
    company_name: string | null;
    company_address: string | null;
    company_phone: string | null;
    company_email: string | null;
    bank_account_info: string | null;
    invoice_footer_text: string | null;
    company_logo_path: string | null;
};

export type QrResult = {
    qris_string: string;
    /** Kartu QRIS bergaya dari server (Pengaturan → QRIS). */
    qris_svg?: string;
    history_id?: string;
    final_amount?: number;
    expiry_time?: string | number | null;
};

export type SuccessInfo = {
    amount: number;
    newPaid: number;
    newRemaining: number;
    total: number;
    invoiceNumber: string;
    scheduleSequence?: number;
    fullyPaid: boolean;
};

/**
 * expiry_time dari gateway bisa epoch (detik/milidetik) atau string tanggal.
 * Return timestamp ms, atau null kalau tidak bisa diparse.
 */
export function parseExpiry(value: QrResult['expiry_time']): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
        const n = Number(value);

        return n < 1e12 ? n * 1000 : n;
    }

    const s = String(value).trim();
    const t = new Date(s.includes('T') ? s : s.replace(' ', 'T')).getTime();

    return Number.isNaN(t) ? null : t;
}
