import { Head } from '@inertiajs/react';
import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { InvoiceForm } from '@/components/invoice-form/invoice-form';
import { blankRow, cleanDecimal } from '@/components/invoice-form/utils';
import type {
    FormClient,
    FormProduct,
    FormSession,
    InvoiceFormData,
} from '@/components/invoice-form/utils';
import { StatusBadge } from '@/components/invoice-status-badge';
import { PageContainer, PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Invoice, ProjectOption } from '@/types/models';

const daysBetween = (from: string, to: string) =>
    Math.round(
        (new Date(`${to.slice(0, 10)}T00:00:00`).getTime() -
            new Date(`${from.slice(0, 10)}T00:00:00`).getTime()) /
            86_400_000,
    );

export default function InvoicesEdit({
    invoice,
    clients,
    products,
    unbilledSessions = [],
    projects = [],
}: {
    invoice: Invoice;
    clients: FormClient[];
    products: FormProduct[];
    unbilledSessions?: FormSession[];
    projects?: ProjectOption[];
}) {
    const items = invoice.items ?? [];
    const schedules = [...(invoice.schedules ?? [])].sort(
        (a, b) => a.sequence - b.sequence,
    );

    // Sesi yang sudah tertaut ke invoice ini tetap bisa dipilih (backend melepas & menaut ulang saat update).
    const sessions = useMemo<FormSession[]>(() => {
        const linked = (invoice.items ?? []).flatMap((it) => it.sessions ?? []);
        const map = new Map<number, FormSession>();
        [...linked, ...unbilledSessions].forEach((s) => map.set(s.id, s));

        return [...map.values()];
    }, [invoice.items, unbilledSessions]);

    const client: FormClient | undefined =
        clients.find((c) => c.id === invoice.client_id) ??
        (invoice.client ? { ...invoice.client } : undefined);

    const initial: InvoiceFormData = {
        client_id: invoice.client_id,
        project_id: invoice.project_id ?? null,
        client: { name: '', phone: '', email: '', address: '' },
        invoice_mode: invoice.invoice_mode,
        type: invoice.type,
        issue_date: invoice.issue_date?.slice(0, 10) ?? '',
        due_date: invoice.due_date?.slice(0, 10) ?? '',
        notes: invoice.notes ?? '',
        discount_type: invoice.discount_type ?? 'amount',
        discount_value: cleanDecimal(
            invoice.discount_value ?? invoice.discount,
        ),
        tax_rate: cleanDecimal(invoice.tax_rate) || '0',
        pph_rate: cleanDecimal(invoice.pph_rate) || '0',
        recurrence: invoice.recurrence ?? 'none',
        recurrence_auto_send: !!invoice.recurrence_auto_send,
        items: items.map((it) =>
            blankRow({
                product_id: it.product_id ?? null,
                description: it.description,
                unit_price: cleanDecimal(it.unit_price),
                hours_qty: cleanDecimal(
                    it.manual_hours ?? it.hours_qty ?? null,
                ),
                session_ids: (it.sessions ?? []).map((s) => s.id),
                project_id: it.project_id ?? null,
            }),
        ),
        installments: {
            count: schedules.length >= 2 ? schedules.length : 3,
            first_due_date: schedules[0]?.due_date?.slice(0, 10) ?? '',
            interval_days:
                schedules.length >= 2
                    ? Math.max(
                          7,
                          Math.round(
                              daysBetween(
                                  schedules[0].due_date,
                                  schedules[schedules.length - 1].due_date,
                              ) /
                                  (schedules.length - 1),
                          ),
                      )
                    : 30,
        },
    };

    return (
        <>
            <Head title={`Edit ${invoice.invoice_number}`} />
            <PageContainer size="wide">
                <PageHeader
                    title={`Edit ${invoice.invoice_number}`}
                    description="Nomor invoice & link bayar tidak berubah."
                    backHref={`/invoices/${invoice.id}`}
                    meta={<StatusBadge status={invoice.status} />}
                />
                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Hanya invoice berstatus draft yang bisa diedit. Setelah
                        dikirim ke client, isi invoice terkunci.
                    </AlertDescription>
                </Alert>
                <InvoiceForm
                    mode="edit"
                    initial={initial}
                    clients={client ? [client] : clients}
                    products={products}
                    projects={projects}
                    sessions={sessions}
                    submitUrl={`/invoices/${invoice.id}`}
                    method="put"
                    submitLabel="Simpan Perubahan"
                    cancelHref={`/invoices/${invoice.id}`}
                />
            </PageContainer>
        </>
    );
}
