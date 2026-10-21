import { Head, Link } from '@inertiajs/react';
import {
    ChevronDown,
    ExternalLink,
    FileDown,
    FilePlus2,
    KeyRound,
    Mail,
    MapPin,
    Package,
    Pencil,
    Phone,
    Receipt,
    StickyNote,
    Timer,
    Wallet,
    FileText,
    FolderKanban,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { RegenerateKeyDialog } from '@/components/clients/client-actions';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
import { ClientProjects } from '@/components/clients/client-projects';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/invoice-status-badge';
import { OverflowActions } from '@/components/mobile/overflow-actions';
import { PageContainer, PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import {
    dueLabel,
    formatDate,
    formatDateTime,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    Client,
    Invoice,
    Paginated,
    Product,
    ProjectNode,
} from '@/types/models';

type Summary = {
    total_billed: number;
    total_paid: number;
    outstanding: number;
    invoice_count: number;
    product_count: number;
};

type Props = {
    client: Client;
    invoices: Paginated<Invoice>;
    products: Product[];
    projects?: ProjectNode[];
    summary: Summary;
};

const METHOD_LABEL: Record<string, string> = { qris: 'QRIS', manual: 'Manual' };
const OPEN_STATUSES = ['sent', 'partial', 'overdue'];

function remainingOf(inv: Invoice) {
    return inv.status === 'cancelled'
        ? 0
        : Math.max(0, toNumber(inv.total) - toNumber(inv.paid_amount));
}

/** Proyek invoice, mis. "Toko Online › Aplikasi Mobile" (link ke halaman proyek). */
function InvoiceProject({ invoice }: { invoice: Invoice }) {
    const p = invoice.project;

    if (!p) {
        return null;
    }

    const label =
        p.full_name ?? (p.parent ? `${p.parent.name} › ${p.name}` : p.name);

    return (
        <Link
            href={`/projects/${p.id}`}
            className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
            <FolderKanban className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">Proyek:</span>
            <span className="truncate">{label}</span>
        </Link>
    );
}

function InvoiceItems({ invoice }: { invoice: Invoice }) {
    const items = invoice.items ?? [];

    return (
        <div className="space-y-3">
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada item.</p>
            ) : (
                <ul className="divide-y rounded-lg border bg-background">
                    {items.map((it) => {
                        const qty = it.hours_qty ?? it.manual_hours;

                        return (
                            <li
                                key={it.id}
                                className="flex items-start justify-between gap-4 px-3 py-2 text-sm"
                            >
                                <div className="min-w-0">
                                    <p className="break-words">
                                        {it.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {it.product?.name ?? 'Tanpa produk'}
                                        {qty !== null &&
                                            qty !== undefined &&
                                            qty !== '' && (
                                                <>
                                                    {' '}
                                                    · {formatNumber(qty)} ×{' '}
                                                    {formatIDR(it.unit_price)}
                                                </>
                                            )}
                                    </p>
                                </div>
                                <span className="shrink-0 font-medium tabular-nums">
                                    {formatIDR(it.line_total)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-right">{formatIDR(invoice.subtotal)}</dd>
                {toNumber(invoice.discount) > 0 && (
                    <>
                        <dt className="text-muted-foreground">Diskon</dt>
                        <dd className="text-right">
                            − {formatIDR(invoice.discount)}
                        </dd>
                    </>
                )}
                {toNumber(invoice.tax_amount) > 0 && (
                    <>
                        <dt className="text-muted-foreground">Pajak</dt>
                        <dd className="text-right">
                            {formatIDR(invoice.tax_amount)}
                        </dd>
                    </>
                )}
                <dt className="font-medium">Total</dt>
                <dd className="text-right font-semibold">
                    {formatIDR(invoice.total)}
                </dd>
            </dl>
        </div>
    );
}

function ContactRow({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof Mail;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex gap-3">
            <Icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
            />
            <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm break-words">{children}</dd>
            </div>
        </div>
    );
}

export default function ClientsShow({
    client,
    invoices,
    products,
    projects = [],
    summary,
}: Props) {
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [editOpen, setEditOpen] = useState(false);
    const [editKey, setEditKey] = useState(0);
    const [keyOpen, setKeyOpen] = useState(false);
    // Edit klien, kunci portal & export hanya untuk admin.
    const { manageClients } = useCan();

    const toggle = (id: number) => setExpanded((o) => ({ ...o, [id]: !o[id] }));

    const payments = invoices.data
        .flatMap((inv) =>
            (inv.payments ?? []).map((p) => ({
                ...p,
                invoice_number: inv.invoice_number,
                invoice_id: inv.id,
            })),
        )
        .sort((a, b) =>
            (b.paid_at ?? b.created_at ?? '').localeCompare(
                a.paid_at ?? a.created_at ?? '',
            ),
        );

    const createInvoiceHref = `/invoices/create?client_id=${client.id}`;
    const subtitle =
        [client.email, client.phone].filter(Boolean).join(' · ') ||
        'Detail klien, transaksi & pembayaran';

    return (
        <>
            <Head title={`Klien · ${client.name}`} />
            <PageContainer>
                <PageHeader
                    title={client.name}
                    description={subtitle}
                    backHref="/clients"
                    actions={
                        <>
                            <OverflowActions
                                items={[
                                    {
                                        label: 'Edit',
                                        icon: Pencil,
                                        hidden: !manageClients,
                                        onClick: () => {
                                            setEditKey((k) => k + 1);
                                            setEditOpen(true);
                                        },
                                    },
                                    {
                                        label: 'Kunci akses baru',
                                        icon: KeyRound,
                                        hidden: !manageClients,
                                        onClick: () => setKeyOpen(true),
                                    },
                                    {
                                        label: 'Export Excel',
                                        icon: FileDown,
                                        hidden: !manageClients,
                                        href: `/clients/${client.id}/export`,
                                        external: true,
                                    },
                                ]}
                            />
                            <Button asChild className="flex-1 sm:flex-none">
                                <Link href={createInvoiceHref}>
                                    <FilePlus2 /> Buat invoice
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <StatCard
                        label="Total ditagih"
                        value={formatIDR(summary.total_billed)}
                        icon={Receipt}
                    />
                    <StatCard
                        label="Terbayar"
                        value={formatIDR(summary.total_paid)}
                        icon={Wallet}
                        tone="success"
                    />
                    <StatCard
                        label="Sisa tagihan"
                        value={formatIDR(summary.outstanding)}
                        icon={Timer}
                        tone={summary.outstanding > 0 ? 'warning' : 'default'}
                        hint={
                            summary.outstanding > 0
                                ? 'Belum dibayar klien'
                                : 'Semua tagihan lunas'
                        }
                    />
                    <StatCard
                        label="Invoice"
                        value={formatNumber(summary.invoice_count)}
                        icon={FileText}
                        hint={`${formatNumber(summary.product_count)} produk terdaftar`}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        {/* Proyek */}
                        <ClientProjects
                            clientId={client.id}
                            clientName={client.name}
                            projects={projects}
                        />

                        {/* Invoice */}
                        <Card className="gap-0 overflow-hidden py-0">
                            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Receipt className="size-4 text-muted-foreground" />{' '}
                                    Invoice
                                </CardTitle>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href={createInvoiceHref}>
                                        <FilePlus2 /> Baru
                                    </Link>
                                </Button>
                            </CardHeader>

                            {invoices.data.length === 0 ? (
                                <EmptyState
                                    icon={Receipt}
                                    title="Belum ada invoice"
                                    description={`Buat invoice pertama untuk ${client.name}.`}
                                    action={
                                        <Button asChild>
                                            <Link href={createInvoiceHref}>
                                                <FilePlus2 /> Buat invoice
                                            </Link>
                                        </Button>
                                    }
                                />
                            ) : (
                                <>
                                    {/* Desktop */}
                                    <div className="hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                                    <TableHead className="w-10 pl-4">
                                                        <span className="sr-only">
                                                            Rincian
                                                        </span>
                                                    </TableHead>
                                                    <TableHead>
                                                        No. invoice
                                                    </TableHead>
                                                    <TableHead>
                                                        Tanggal
                                                    </TableHead>
                                                    <TableHead>
                                                        Status
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Total
                                                    </TableHead>
                                                    <TableHead className="pr-4 text-right">
                                                        Sisa
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invoices.data.map((inv) => {
                                                    const isOpen =
                                                        !!expanded[inv.id];
                                                    const due =
                                                        OPEN_STATUSES.includes(
                                                            inv.status,
                                                        )
                                                            ? dueLabel(
                                                                  inv.due_date,
                                                              )
                                                            : null;
                                                    const remaining =
                                                        remainingOf(inv);

                                                    return (
                                                        <Fragment key={inv.id}>
                                                            <TableRow
                                                                data-state={
                                                                    isOpen
                                                                        ? 'selected'
                                                                        : undefined
                                                                }
                                                            >
                                                                <TableCell className="pl-4">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-7"
                                                                        onClick={() =>
                                                                            toggle(
                                                                                inv.id,
                                                                            )
                                                                        }
                                                                        aria-expanded={
                                                                            isOpen
                                                                        }
                                                                        aria-label={
                                                                            isOpen
                                                                                ? 'Sembunyikan rincian'
                                                                                : 'Tampilkan rincian'
                                                                        }
                                                                    >
                                                                        <ChevronDown
                                                                            className={cn(
                                                                                'size-4 transition-transform',
                                                                                !isOpen &&
                                                                                    '-rotate-90',
                                                                            )}
                                                                        />
                                                                    </Button>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Link
                                                                        href={`/invoices/${inv.id}`}
                                                                        className="font-medium hover:underline"
                                                                    >
                                                                        {
                                                                            inv.invoice_number
                                                                        }
                                                                    </Link>
                                                                    <InvoiceProject
                                                                        invoice={
                                                                            inv
                                                                        }
                                                                    />
                                                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                                                        {inv.invoice_mode ===
                                                                            'hourly' && (
                                                                            <Badge variant="outline">
                                                                                Per
                                                                                jam
                                                                            </Badge>
                                                                        )}
                                                                        {inv.type ===
                                                                            'installment' && (
                                                                            <Badge variant="outline">
                                                                                Cicilan
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm">
                                                                    <div>
                                                                        {formatDate(
                                                                            inv.issue_date,
                                                                        )}
                                                                    </div>
                                                                    {due && (
                                                                        <div
                                                                            className={cn(
                                                                                'text-xs',
                                                                                inv.status ===
                                                                                    'overdue'
                                                                                    ? 'text-red-600 dark:text-red-400'
                                                                                    : 'text-muted-foreground',
                                                                            )}
                                                                        >
                                                                            {
                                                                                due
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <StatusBadge
                                                                        status={
                                                                            inv.status
                                                                        }
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium tabular-nums">
                                                                    {formatIDR(
                                                                        inv.total,
                                                                    )}
                                                                </TableCell>
                                                                <TableCell
                                                                    className={cn(
                                                                        'pr-4 text-right tabular-nums',
                                                                        remaining >
                                                                            0
                                                                            ? 'font-medium'
                                                                            : 'text-muted-foreground',
                                                                    )}
                                                                >
                                                                    {inv.status ===
                                                                    'cancelled'
                                                                        ? '—'
                                                                        : formatIDR(
                                                                              remaining,
                                                                          )}
                                                                </TableCell>
                                                            </TableRow>
                                                            {isOpen && (
                                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                                    <TableCell
                                                                        colSpan={
                                                                            6
                                                                        }
                                                                        className="px-4 py-4 whitespace-normal sm:pl-14"
                                                                    >
                                                                        <InvoiceItems
                                                                            invoice={
                                                                                inv
                                                                            }
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </Fragment>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile */}
                                    <ul className="divide-y md:hidden">
                                        {invoices.data.map((inv) => {
                                            const isOpen = !!expanded[inv.id];
                                            const remaining = remainingOf(inv);

                                            return (
                                                <li
                                                    key={inv.id}
                                                    className="p-4"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <Link
                                                                href={`/invoices/${inv.id}`}
                                                                className="font-medium hover:underline"
                                                            >
                                                                {
                                                                    inv.invoice_number
                                                                }
                                                            </Link>
                                                            <InvoiceProject
                                                                invoice={inv}
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatDate(
                                                                    inv.issue_date,
                                                                )}
                                                            </p>
                                                        </div>
                                                        <StatusBadge
                                                            status={inv.status}
                                                        />
                                                    </div>
                                                    <div className="mt-2 flex items-end justify-between gap-3">
                                                        <div className="text-sm tabular-nums">
                                                            <p className="font-semibold">
                                                                {formatIDR(
                                                                    inv.total,
                                                                )}
                                                            </p>
                                                            {inv.status !==
                                                                'cancelled' &&
                                                                remaining >
                                                                    0 && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Sisa{' '}
                                                                        {formatIDR(
                                                                            remaining,
                                                                        )}
                                                                    </p>
                                                                )}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                toggle(inv.id)
                                                            }
                                                            aria-expanded={
                                                                isOpen
                                                            }
                                                        >
                                                            Rincian
                                                            <ChevronDown
                                                                className={cn(
                                                                    'size-4 transition-transform',
                                                                    isOpen &&
                                                                        'rotate-180',
                                                                )}
                                                            />
                                                        </Button>
                                                    </div>
                                                    {isOpen && (
                                                        <div className="mt-3">
                                                            <InvoiceItems
                                                                invoice={inv}
                                                            />
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                            <DataPagination
                                paginator={invoices}
                                noun="invoice"
                            />
                        </Card>

                        {/* Pembayaran */}
                        <Card className="gap-0 overflow-hidden py-0">
                            <CardHeader className="border-b px-4 py-4 sm:px-6">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Wallet className="size-4 text-muted-foreground" />{' '}
                                    Riwayat pembayaran
                                </CardTitle>
                            </CardHeader>
                            {payments.length === 0 ? (
                                <EmptyState
                                    icon={Wallet}
                                    title="Belum ada pembayaran"
                                    description="Pembayaran untuk invoice di halaman ini akan muncul di sini."
                                />
                            ) : (
                                <ul className="divide-y">
                                    {payments.map((p) => (
                                        <li
                                            key={p.id}
                                            className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Link
                                                        href={`/invoices/${p.invoice_id}`}
                                                        className="text-sm font-medium hover:underline"
                                                    >
                                                        {p.invoice_number}
                                                    </Link>
                                                    <StatusBadge
                                                        status={p.status}
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateTime(
                                                        p.paid_at ??
                                                            p.created_at,
                                                    )}{' '}
                                                    ·{' '}
                                                    {METHOD_LABEL[p.method] ??
                                                        p.method}
                                                </p>
                                            </div>
                                            <span
                                                className={cn(
                                                    'shrink-0 text-sm font-medium tabular-nums',
                                                    p.status === 'success'
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {formatIDR(p.amount)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        {/* Kontak */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Kontak
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-4">
                                    <ContactRow icon={Mail} label="Email">
                                        {client.email ? (
                                            <a
                                                href={`mailto:${client.email}`}
                                                className="hover:underline"
                                            >
                                                {client.email}
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </ContactRow>
                                    <ContactRow icon={Phone} label="Telepon">
                                        {client.phone ? (
                                            <a
                                                href={`tel:${client.phone}`}
                                                className="hover:underline"
                                            >
                                                {client.phone}
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </ContactRow>
                                    <ContactRow icon={MapPin} label="Alamat">
                                        <span className="whitespace-pre-line">
                                            {client.address || (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </span>
                                    </ContactRow>
                                    <ContactRow
                                        icon={Timer}
                                        label="Tarif per jam"
                                    >
                                        <span className="tabular-nums">
                                            {client.hourly_rate !== null ? (
                                                formatIDR(client.hourly_rate)
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Tarif default
                                                </span>
                                            )}
                                        </span>
                                    </ContactRow>
                                    {client.notes && (
                                        <ContactRow
                                            icon={StickyNote}
                                            label="Catatan"
                                        >
                                            <span className="whitespace-pre-line">
                                                {client.notes}
                                            </span>
                                        </ContactRow>
                                    )}
                                </dl>
                            </CardContent>
                        </Card>

                        {/* Produk */}
                        <Card className="gap-0 overflow-hidden py-0">
                            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-6 py-4">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Package className="size-4 text-muted-foreground" />{' '}
                                    Produk
                                    <Badge
                                        variant="secondary"
                                        className="tabular-nums"
                                    >
                                        {products.length}
                                    </Badge>
                                </CardTitle>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href="/products">
                                        Kelola <ExternalLink />
                                    </Link>
                                </Button>
                            </CardHeader>
                            {products.length === 0 ? (
                                <EmptyState
                                    icon={Package}
                                    title="Belum ada produk"
                                    description="Produk khusus klien ini bisa ditambahkan di halaman Produk."
                                />
                            ) : (
                                <ul className="divide-y">
                                    {products.map((p) => (
                                        <li
                                            key={p.id}
                                            className="flex items-center justify-between gap-3 px-6 py-3"
                                        >
                                            <span
                                                className={cn(
                                                    'truncate text-sm',
                                                    !p.is_active &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {p.name}
                                            </span>
                                            {p.is_active ? (
                                                <Badge
                                                    variant="outline"
                                                    className="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
                                                >
                                                    Aktif
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-muted-foreground"
                                                >
                                                    Nonaktif
                                                </Badge>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                </div>
            </PageContainer>

            <ClientFormDialog
                key={editKey}
                open={editOpen}
                onOpenChange={setEditOpen}
                client={client}
            />
            <RegenerateKeyDialog
                client={keyOpen ? client : null}
                onOpenChange={setKeyOpen}
            />
        </>
    );
}

ClientsShow.layout = {
    breadcrumbs: [
        { title: 'Klien', href: '/clients' },
        { title: 'Detail klien', href: '#' },
    ],
};
