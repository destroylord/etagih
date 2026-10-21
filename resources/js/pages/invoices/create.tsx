import { Head } from '@inertiajs/react';
import { InvoiceForm } from '@/components/invoice-form/invoice-form';
import { blankRow } from '@/components/invoice-form/utils';
import type {
    FormClient,
    FormProduct,
    FormSession,
    InvoiceFormData,
} from '@/components/invoice-form/utils';
import { PageContainer, PageHeader } from '@/components/page-header';
import { todayISO } from '@/lib/format';
import type { ProjectOption } from '@/types/models';

export default function InvoicesCreate({
    clients,
    products,
    unbilledSessions,
    defaultTaxRate = 0,
    preselectedClientId = null,
    preselectedMode = null,
    projects = [],
    preselectedProjectId = null,
    canCreateClient = true,
}: {
    clients: FormClient[];
    products: FormProduct[];
    unbilledSessions: FormSession[];
    defaultTaxRate?: number;
    preselectedClientId?: number | null;
    preselectedMode?: 'hourly' | null;
    projects?: ProjectOption[];
    preselectedProjectId?: number | null;
    canCreateClient?: boolean;
}) {
    // ?project_id=… dari halaman proyek → pilih proyek & kliennya sekaligus.
    const preselectedProject =
        projects.find((p) => p.id === preselectedProjectId) ?? null;
    const preselected = clients.find(
        (c) => c.id === (preselectedProject?.client_id ?? preselectedClientId),
    );
    const initial: InvoiceFormData = {
        client_id: preselected?.id ?? clients[0]?.id ?? null,
        project_id:
            preselectedProject &&
            preselectedProject.client_id === preselected?.id
                ? preselectedProject.id
                : null,
        client: { name: '', phone: '', email: '', address: '' },
        invoice_mode: preselectedMode ?? 'fixed',
        type: 'full',
        issue_date: todayISO(),
        due_date: '',
        notes: '',
        discount_type: 'amount',
        discount_value: '',
        tax_rate: String(Number(defaultTaxRate) || 0),
        pph_rate: '0',
        recurrence: 'none',
        recurrence_auto_send: false,
        items: [blankRow()],
        installments: { count: 3, first_due_date: '', interval_days: 30 },
    };

    return (
        <>
            <Head title="Buat Invoice" />
            <PageContainer size="wide">
                <PageHeader
                    title="Buat Invoice"
                    description="Invoice disimpan sebagai draft dulu — kirim ke client setelah dicek."
                    backHref="/invoices"
                />
                <InvoiceForm
                    mode="create"
                    initial={initial}
                    clients={clients}
                    products={products}
                    projects={projects}
                    sessions={unbilledSessions}
                    submitUrl="/invoices"
                    method="post"
                    submitLabel="Simpan sebagai Draft"
                    cancelHref="/invoices"
                    defaultTaxRate={Number(defaultTaxRate) || 0}
                    canCreateClient={canCreateClient}
                />
            </PageContainer>
        </>
    );
}
