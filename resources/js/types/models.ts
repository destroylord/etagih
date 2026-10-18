/**
 * Tipe data domain yang dikirim backend lewat Inertia props.
 * Kolom decimal Laravel diserialisasi sebagai string ("1000000.00").
 */

export type Decimal = string | number;

export type InvoiceStatus =
    'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceType = 'full' | 'installment';
export type InvoiceMode = 'fixed' | 'hourly';
export type DiscountType = 'amount' | 'percent';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type Client = {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    hourly_rate: Decimal | null;
    invoices_count?: number;
    products_count?: number;
};

export type ProjectStatus = 'active' | 'completed' | 'archived';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
    active: 'Aktif',
    completed: 'Selesai',
    archived: 'Diarsipkan',
};

/** Statistik proyek (dari App\Support\ProjectStats; proyek utama sudah termasuk sub-proyek). */
export type ProjectStats = {
    invoice_count: number;
    billed: number;
    paid: number;
    outstanding: number;
    /** Nilai pekerjaan per item (sebelum diskon & pajak). */
    work_value: number;
    tracked_seconds: number;
    unbilled_seconds: number;
};

/** Proyek utama (parent_id null) atau sub-proyek. */
export type Project = {
    id: number;
    client_id: number;
    parent_id: number | null;
    name: string;
    /** "Toko Online › Aplikasi Mobile" */
    full_name?: string;
    description?: string | null;
    status: ProjectStatus;
    hourly_rate: Decimal | null;
    parent?: Pick<Project, 'id' | 'name'> | null;
};

/** Opsi proyek untuk select (WorkSessionController::projectOptions). */
export type ProjectOption = {
    id: number;
    client_id: number;
    client_name?: string;
    parent_id: number | null;
    name: string;
    full_name: string;
    hourly_rate: string | null;
    status: ProjectStatus;
};

/** Node pohon proyek + statistik (ProjectStats::tree). */
export type ProjectNode = {
    id: number;
    client_id: number;
    parent_id: number | null;
    name: string;
    description: string | null;
    status: ProjectStatus;
    hourly_rate: Decimal | null;
    stats: ProjectStats;
    children?: ProjectNode[];
    client?: Pick<Client, 'id' | 'name'> | null;
};

export type Product = {
    id: number;
    name: string;
    client_id: number | null;
    is_active: boolean;
    client?: Pick<Client, 'id' | 'name'> | null;
};

export type WorkSession = {
    id: number;
    client_id: number;
    project_id: number | null;
    project?: Project | null;
    invoice_id: number | null;
    invoice_item_id: number | null;
    description: string;
    unit_price: Decimal;
    started_at: string | null;
    ended_at: string | null;
    duration_seconds: number | null;
    status: 'running' | 'paused' | 'completed' | 'billed' | 'cancelled';
    notes: string | null;
    client?: Pick<Client, 'id' | 'name'> | null;
};

export type InvoiceItem = {
    id: number;
    invoice_id: number;
    product_id: number | null;
    project_id: number | null;
    project?: Project | null;
    description: string;
    unit_price: Decimal;
    manual_hours: Decimal | null;
    hours_qty?: Decimal | null;
    line_total: Decimal;
    sort_order: number;
    product?: Pick<Product, 'id' | 'name'> | null;
    sessions?: WorkSession[];
};

export type PaymentSchedule = {
    id: number;
    invoice_id: number;
    sequence: number;
    due_date: string;
    amount: Decimal;
    status: 'pending' | 'paid' | 'overdue';
    paid_at: string | null;
    payment_id: number | null;
};

export type Payment = {
    id: number;
    invoice_id: number;
    schedule_id: number | null;
    amount: Decimal;
    method: 'qris' | 'manual';
    external_id: string | null;
    status: 'pending' | 'success' | 'failed' | 'expired';
    paid_at: string | null;
    notes: string | null;
    /** Nomor kuitansi (KWT-YYYYMMDD-0001), terisi saat pembayaran sukses. */
    receipt_number?: string | null;
    created_at: string;
};

export type Invoice = {
    id: number;
    client_id: number;
    project_id: number | null;
    project?: Project | null;
    invoice_number: string;
    issue_date: string;
    due_date: string | null;
    invoice_mode: InvoiceMode;
    type: InvoiceType;
    subtotal: Decimal;
    discount: Decimal;
    discount_type: DiscountType;
    discount_value: Decimal;
    tax_rate: Decimal;
    tax_amount: Decimal;
    /** PPh 23 (%) yang dipotong klien. */
    pph_rate: Decimal;
    pph_amount: Decimal;
    /** Jumlah yang dibayar klien = DPP + PPN − PPh. */
    total: Decimal;
    paid_amount: Decimal;
    status: InvoiceStatus;
    public_token: string;
    notes: string | null;
    recurrence: Recurrence;
    recurrence_next_date: string | null;
    recurrence_auto_send: boolean;
    recurring_parent_id: number | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    reminder_count: number;
    last_reminded_at: string | null;
    created_at: string;
    client?: Client | null;
    items?: InvoiceItem[];
    schedules?: PaymentSchedule[];
    payments?: Payment[];
    recurring_parent?: Pick<Invoice, 'id' | 'invoice_number'> | null;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
    none: 'Tidak berulang',
    weekly: 'Mingguan',
    monthly: 'Bulanan',
    quarterly: 'Per 3 bulan',
    yearly: 'Tahunan',
};
