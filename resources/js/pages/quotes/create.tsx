import { Head } from '@inertiajs/react';
import type { FormClient, FormProduct } from '@/components/invoice-form/utils';
import { PageContainer, PageHeader } from '@/components/page-header';
import { QuoteForm } from '@/components/quote-form/quote-form';
import { addDaysISO, blankQuoteRow } from '@/components/quote-form/utils';
import type { QuoteFormData } from '@/components/quote-form/utils';
import { todayISO } from '@/lib/format';
import type { ProjectOption } from '@/types/models';

export default function QuotesCreate({
    clients,
    products,
    projects = [],
    defaultTaxRate = 0,
    defaultValidDays = 14,
    preselectedClientId = null,
    preselectedProjectId = null,
    canCreateClient = true,
}: {
    clients: FormClient[];
    products: FormProduct[];
    projects?: ProjectOption[];
    defaultTaxRate?: number;
    defaultValidDays?: number;
    preselectedClientId?: number | null;
    preselectedProjectId?: number | null;
    canCreateClient?: boolean;
}) {
    const preselectedProject =
        projects.find((p) => p.id === preselectedProjectId) ?? null;
    const preselected = clients.find(
        (c) => c.id === (preselectedProject?.client_id ?? preselectedClientId),
    );
    const today = todayISO();

    const initial: QuoteFormData = {
        client_id: preselected?.id ?? clients[0]?.id ?? null,
        project_id:
            preselectedProject &&
            preselectedProject.client_id === preselected?.id
                ? preselectedProject.id
                : null,
        client: { name: '', phone: '', email: '', address: '' },
        issue_date: today,
        valid_until: addDaysISO(today, defaultValidDays),
        discount_type: 'amount',
        discount_value: '',
        tax_rate: String(Number(defaultTaxRate) || 0),
        pph_rate: '0',
        notes: '',
        terms: '',
        items: [blankQuoteRow()],
    };

    return (
        <>
            <Head title="Buat Penawaran" />
            <PageContainer size="wide">
                <PageHeader
                    title="Buat Penawaran"
                    description="Penawaran disimpan sebagai draft dulu — kirim ke klien setelah dicek."
                    backHref="/quotes"
                />
                <QuoteForm
                    mode="create"
                    initial={initial}
                    clients={clients}
                    products={products}
                    projects={projects}
                    submitUrl="/quotes"
                    method="post"
                    submitLabel="Simpan sebagai Draft"
                    cancelHref="/quotes"
                    defaultTaxRate={Number(defaultTaxRate) || 0}
                    canCreateClient={canCreateClient}
                />
            </PageContainer>
        </>
    );
}
