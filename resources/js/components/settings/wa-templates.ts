/**
 * Definisi template WhatsApp: placeholder yang tersedia per jenis pesan,
 * template default (salinan dari App\Services\WhatsAppService — dipakai saat
 * field dikosongkan), dan data contoh untuk pratinjau.
 */

export type Placeholder = { key: string; label: string };

export const PLACEHOLDER_LABEL: Record<string, string> = {
    client_name: 'Nama client',
    company_name: 'Nama perusahaan',
    invoice_number: 'Nomor invoice',
    total: 'Total invoice',
    public_link: 'Link pembayaran',
    amount: 'Nominal',
    remaining: 'Sisa tagihan',
    status: 'Status pembayaran',
    due_date: 'Tanggal jatuh tempo',
    installment: 'Keterangan cicilan',
    project: 'Nama proyek',
};

const keys = (...k: string[]): Placeholder[] =>
    k.map((key) => ({ key, label: PLACEHOLDER_LABEL[key] ?? key }));

export const PLACEHOLDERS = {
    invoice: keys(
        'client_name',
        'company_name',
        'invoice_number',
        'project',
        'total',
        'public_link',
    ),
    payment_received: keys(
        'client_name',
        'company_name',
        'invoice_number',
        'project',
        'amount',
        'remaining',
        'status',
    ),
    reminder: keys(
        'client_name',
        'company_name',
        'invoice_number',
        'project',
        'amount',
        'due_date',
        'installment',
        'public_link',
    ),
} as const;

export const DEFAULT_TEMPLATES = {
    invoice: `Halo {{client_name}},

Invoice baru dari {{company_name}}:
Nomor : {{invoice_number}}
Total : {{total}}

Silakan bayar melalui link berikut:
{{public_link}}

Terima kasih atas kepercayaan Anda.`,
    payment_received: `Halo {{client_name}},

Pembayaran untuk invoice *{{invoice_number}}* telah kami terima.
Nominal : {{amount}}
Sisa    : {{remaining}}
Status  : {{status}}

Terima kasih.`,
    reminder: `Halo {{client_name}},

Kami ingin mengingatkan bahwa pembayaran untuk invoice *{{invoice_number}}* sebesar {{amount}} belum kami terima.

Silakan selesaikan pembayaran melalui link berikut:
{{public_link}}

Terima kasih.`,
    reminder_upcoming: `Halo {{client_name}},

Sekadar mengingatkan, tagihan *{{invoice_number}}* {{installment}} sebesar {{amount}} akan jatuh tempo pada {{due_date}}.

Pembayaran bisa dilakukan melalui link berikut:
{{public_link}}

Terima kasih.`,
};

export function sampleValues(
    companyName: string,
    prefix: string,
): Record<string, string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const due = new Date(d.getTime() + 3 * 86_400_000);

    return {
        client_name: 'Budi Santoso',
        company_name: companyName || 'Nama Perusahaan Anda',
        invoice_number: `${prefix || 'INV'}-${ymd}-0001`,
        total: 'Rp 2.500.000',
        project: 'Toko Online › Aplikasi Mobile',
        public_link: `${typeof window !== 'undefined' ? window.location.origin : 'https://contoh.id'}/pay/abc123`,
        amount: 'Rp 1.250.000',
        remaining: 'Rp 1.250.000',
        status: 'Sebagian terbayar',
        due_date: due.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }),
        installment: 'Cicilan ke-2',
    };
}

/** Ganti {{key}} dengan nilai — sama seperti strtr() di backend. Placeholder asing dibiarkan. */
export function renderTemplate(
    template: string,
    values: Record<string, string>,
    allowed: readonly Placeholder[],
): string {
    const allowedKeys = new Set(allowed.map((p) => p.key));

    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        allowedKeys.has(key) ? (values[key] ?? match) : match,
    );
}

/** Placeholder yang dipakai di template tapi tidak didukung jenis pesan ini. */
export function unknownPlaceholders(
    template: string,
    allowed: readonly Placeholder[],
): string[] {
    const allowedKeys = new Set(allowed.map((p) => p.key));
    const found = new Set<string>();

    for (const m of template.matchAll(/\{\{(\w+)\}\}/g)) {
        if (!allowedKeys.has(m[1])) {
            found.add(m[0]);
        }
    }

    return [...found];
}
