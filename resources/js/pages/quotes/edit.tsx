import { Head } from '@inertiajs/react';
import { Info } from 'lucide-react';
import { cleanDecimal } from '@/components/invoice-form/utils';
import type { FormClient, FormProduct } from '@/components/invoice-form/utils';
import { PageContainer, PageHeader } from '@/components/page-header';
import { QuoteStatusBadge } from '@/components/quote-detail/quote-status-badge';
import { QuoteForm } from '@/components/quote-form/quote-form';
import { blankQuoteRow } from '@/components/quote-form/utils';
import type { QuoteFormData } from '@/components/quote-form/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ProjectOption } from '@/types/models';
import type { Quote } from '@/types/quotes';

export default function QuotesEdit({
    quote,
    clients,
    products,
    projects = [],
}: {
    quote: Quote;
    clients: FormClient[];
    products: FormProduct[];
    projects?: ProjectOption[];
}) {
    const client: FormClient | undefined =
        clients.find((c) => c.id === quote.client_id) ??
        (quote.client ? { ...quote.client } : undefined);

    const initial: QuoteFormData = {
        client_id: quote.client_id,
        project_id: quote.project_id ?? null,
        client: { name: '', phone: '', email: '', address: '' },
        issue_date: quote.issue_date?.slice(0, 10) ?? '',
        valid_until: quote.valid_until?.slice(0, 10) ?? '',
        discount_type: quote.discount_type ?? 'amount',
        discount_value: cleanDecimal(quote.discount_value ?? quote.discount),
        tax_rate: cleanDecimal(quote.tax_rate) || '0',
        pph_rate: cleanDecimal(quote.pph_rate) || '0',
        notes: quote.notes ?? '',
        terms: quote.terms ?? '',
        items: (quote.items ?? []).map((it) =>
            blankQuoteRow({
                product_id: it.product_id ?? null,
                description: it.description,
                quantity: cleanDecimal(it.quantity) || '1',
                unit_price: cleanDecimal(it.unit_price),
                project_id: it.project_id ?? null,
            }),
        ),
    };

    return (
        <>
            <Head title={`Edit ${quote.quote_number}`} />
            <PageContainer size="wide">
                <PageHeader
                    title={`Edit ${quote.quote_number}`}
                    description="Nomor penawaran & link untuk klien tidak berubah."
                    backHref={`/quotes/${quote.id}`}
                    meta={<QuoteStatusBadge status={quote.status} />}
                />
                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Hanya penawaran berstatus draft yang bisa diedit.
                        Setelah dikirim ke klien, isinya terkunci — gunakan
                        Duplikat untuk membuat versi baru.
                    </AlertDescription>
                </Alert>
                <QuoteForm
                    mode="edit"
                    initial={initial}
                    clients={client ? [client] : clients}
                    products={products}
                    projects={projects}
                    submitUrl={`/quotes/${quote.id}`}
                    method="put"
                    submitLabel="Simpan Perubahan"
                    cancelHref={`/quotes/${quote.id}`}
                />
            </PageContainer>
        </>
    );
}
