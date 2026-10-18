/**
 * Tipe data penawaran harga (quotation) dari QuoteController / PublicQuoteController.
 */
import type {
    Client,
    Decimal,
    DiscountType,
    Product,
    Project,
} from '@/types/models';

export type QuoteStatus =
    'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

export type QuoteItem = {
    id: number;
    quote_id?: number;
    product_id: number | null;
    project_id: number | null;
    product?: Pick<Product, 'id' | 'name'> | null;
    project?: Pick<Project, 'id' | 'name' | 'parent_id'> | null;
    description: string;
    quantity: Decimal;
    unit_price: Decimal;
    line_total: Decimal;
    sort_order?: number;
};

export type Quote = {
    id: number;
    client_id: number;
    project_id: number | null;
    quote_number: string;
    issue_date: string;
    valid_until: string | null;
    subtotal: Decimal;
    discount: Decimal;
    discount_type: DiscountType;
    discount_value: Decimal;
    tax_rate: Decimal;
    tax_amount: Decimal;
    pph_rate: Decimal;
    pph_amount: Decimal;
    total: Decimal;
    status: QuoteStatus;
    public_token: string;
    notes: string | null;
    terms: string | null;
    sent_at?: string | null;
    accepted_at: string | null;
    accepted_by: string | null;
    declined_at: string | null;
    decline_reason: string | null;
    response_note?: string | null;
    converted_invoice_id: number | null;
    created_at?: string;
    client?: Client | Pick<Client, 'id' | 'name'> | null;
    project?: Project | null;
    items?: QuoteItem[];
};

export type ConvertedInvoice = {
    id: number;
    invoice_number: string;
    status: string;
    total: Decimal;
};

/** Penawaran lengkap seperti dikirim `QuoteController@show`. */
export type QuoteDetail = Quote & {
    client: Client;
    items: QuoteItem[];
    converted_invoice?: ConvertedInvoice | null;
};

export type QuoteSettings = {
    company_name?: string | null;
    company_address?: string | null;
    company_email?: string | null;
    company_phone?: string | null;
    logo_url?: string | null;
    invoice_footer_text?: string | null;
    signature_url?: string | null;
    signer_name?: string | null;
    signer_title?: string | null;
};

/** Penawaran di halaman publik /q/{token} (field terbatas). */
export type PublicQuote = Pick<
    Quote,
    | 'quote_number'
    | 'issue_date'
    | 'valid_until'
    | 'status'
    | 'public_token'
    | 'subtotal'
    | 'discount'
    | 'discount_type'
    | 'discount_value'
    | 'tax_rate'
    | 'tax_amount'
    | 'pph_rate'
    | 'pph_amount'
    | 'total'
    | 'notes'
    | 'terms'
    | 'accepted_at'
    | 'accepted_by'
    | 'declined_at'
    | 'decline_reason'
> & {
    client: Pick<Client, 'id' | 'name' | 'email' | 'phone' | 'address'>;
    project: Project | null;
    items: QuoteItem[];
};

/** Baris syarat: satu per baris, penomoran/bullet di awal dibuang (cermin QuotePdf::terms). */
export function quoteTerms(terms: string | null | undefined): string[] {
    return (terms ?? '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(\d+[.)]|[-*•])\s*/u, '').trim())
        .filter(Boolean);
}
