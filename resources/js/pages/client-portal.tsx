import { Form, Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    CornerDownRight,
    Eye,
    FileText,
    FolderKanban,
    LogOut,
    Receipt,
    Timer,
    Wallet,
} from 'lucide-react';
import { Fragment } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/invoice-status-badge';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    dueLabel,
    formatDate,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Client, Invoice } from '@/types/models';

type Props = {
    client: Pick<Client, 'id' | 'name'> & Partial<Client>;
    invoices: Invoice[];
    summary: {
        total_billed: number;
        total_paid: number;
        outstanding: number;
        invoice_count: number;
    };
};

const appName = import.meta.env.VITE_APP_NAME || 'eTagih';
const PAYABLE = ['sent', 'partial', 'overdue'];

const isPayable = (inv: Invoice) => PAYABLE.includes(inv.status);
const remainingOf = (inv: Invoice) =>
    inv.status === 'cancelled'
        ? 0
        : Math.max(0, toNumber(inv.total) - toNumber(inv.paid_amount));

function InvoiceAction({
    invoice,
    className,
}: {
    invoice: Invoice;
    className?: string;
}) {
    const href = `/pay/${invoice.public_token}`;

    return isPayable(invoice) ? (
        <Button size="sm" asChild className={className}>
            <Link href={href}>
                Bayar <ArrowRight />
            </Link>
        </Button>
    ) : (
        <Button size="sm" variant="outline" asChild className={className}>
            <Link href={href}>
                <Eye /> Lihat
            </Link>
        </Button>
    );
}

type InvoiceGroup = {
    key: string;
    /** null = "Tanpa proyek". */
    name: string | null;
    invoices: Invoice[];
    outstanding: number;
};

/**
 * Kelompokkan invoice per proyek utama (sub-proyek digabung ke induknya).
 * Urutan grup mengikuti invoice terbaru; "Tanpa proyek" selalu terakhir.
 */
function groupByProject(invoices: Invoice[]): InvoiceGroup[] {
    const groups = new Map<string, InvoiceGroup>();
    const none: InvoiceGroup = {
        key: 'none',
        name: null,
        invoices: [],
        outstanding: 0,
    };

    for (const inv of invoices) {
        const p = inv.project;
        let group = none;

        if (p) {
            const rootId = p.parent_id ?? p.id;
            const rootName = p.parent_id ? (p.parent?.name ?? p.name) : p.name;
            const key = `p${rootId}`;
            group = groups.get(key) ?? {
                key,
                name: rootName,
                invoices: [],
                outstanding: 0,
            };
            groups.set(key, group);
        }

        group.invoices.push(inv);
        group.outstanding += remainingOf(inv);
    }

    const list = [...groups.values()];

    if (none.invoices.length > 0) {
        list.push(none);
    }

    return list;
}

/** Nama sub-proyek (bila invoice ditautkan ke sub-proyek). */
function SubProject({ invoice }: { invoice: Invoice }) {
    const p = invoice.project;

    if (!p?.parent_id) {
        return null;
    }

    return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">Sub-proyek:</span>
            <span className="truncate">{p.name}</span>
        </span>
    );
}

function GroupSummary({ group }: { group: InvoiceGroup }) {
    return (
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {formatNumber(group.invoices.length)} invoice
            {group.outstanding > 0 ? (
                <>
                    {' '}
                    · Sisa{' '}
                    <span className="font-medium text-foreground">
                        {formatIDR(group.outstanding)}
                    </span>
                </>
            ) : (
                ' · Lunas'
            )}
        </span>
    );
}

function GroupTitle({ group }: { group: InvoiceGroup }) {
    return (
        <span className="flex min-w-0 items-center gap-2 font-medium">
            <FolderKanban
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
            />
            <span className="truncate">{group.name ?? 'Tanpa proyek'}</span>
        </span>
    );
}

function DueText({ invoice }: { invoice: Invoice }) {
    if (!isPayable(invoice) || !invoice.due_date) {
        return null;
    }

    const label = dueLabel(invoice.due_date);
    const late = invoice.status === 'overdue' || label?.startsWith('Lewat');

    return (
        <span
            className={cn(
                'text-xs',
                late
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
            )}
        >
            {label}
        </span>
    );
}

function DesktopRow({ invoice: inv }: { invoice: Invoice }) {
    const cancelled = inv.status === 'cancelled';
    const remaining = remainingOf(inv);

    return (
        <TableRow className={cn(cancelled && 'text-muted-foreground')}>
            <TableCell className="pl-6">
                <div className={cn('font-medium', cancelled && 'line-through')}>
                    {inv.invoice_number}
                </div>
                <SubProject invoice={inv} />
                <DueText invoice={inv} />
            </TableCell>
            <TableCell>{formatDate(inv.issue_date)}</TableCell>
            <TableCell>
                <StatusBadge status={inv.status} />
            </TableCell>
            <TableCell
                className={cn(
                    'text-right tabular-nums',
                    cancelled && 'line-through',
                )}
            >
                {formatIDR(inv.total)}
            </TableCell>
            <TableCell
                className={cn(
                    'text-right tabular-nums',
                    remaining > 0 && 'font-semibold text-foreground',
                )}
            >
                {cancelled ? '—' : formatIDR(remaining)}
            </TableCell>
            <TableCell className="pr-6 text-right">
                <InvoiceAction invoice={inv} />
            </TableCell>
        </TableRow>
    );
}

function MobileItem({ invoice: inv }: { invoice: Invoice }) {
    const cancelled = inv.status === 'cancelled';
    const remaining = remainingOf(inv);

    return (
        <li
            className={cn(
                'space-y-3 p-4',
                cancelled && 'text-muted-foreground',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p
                        className={cn(
                            'font-medium',
                            cancelled && 'line-through',
                        )}
                    >
                        {inv.invoice_number}
                    </p>
                    <SubProject invoice={inv} />
                    <p className="text-xs text-muted-foreground">
                        {formatDate(inv.issue_date)}
                    </p>
                </div>
                <StatusBadge status={inv.status} />
            </div>
            <div className="flex items-end justify-between gap-3">
                <div className="text-sm tabular-nums">
                    <p
                        className={cn(
                            'font-semibold',
                            cancelled && 'line-through',
                        )}
                    >
                        {formatIDR(inv.total)}
                    </p>
                    {!cancelled && remaining > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Sisa {formatIDR(remaining)}
                        </p>
                    )}
                    <DueText invoice={inv} />
                </div>
                <InvoiceAction invoice={inv} />
            </div>
        </li>
    );
}

export default function ClientPortal({ client, invoices, summary }: Props) {
    // Invoice yang dibatalkan tetap tampil di daftar, tapi tidak dihitung sebagai tagihan.
    const active = invoices.filter((inv) => inv.status !== 'cancelled');
    const totalBilled = active.reduce((s, inv) => s + toNumber(inv.total), 0);
    const totalPaid = active.reduce(
        (s, inv) => s + toNumber(inv.paid_amount),
        0,
    );
    const outstanding = active.reduce((s, inv) => s + remainingOf(inv), 0);
    const payable = invoices.filter(isPayable);
    const overdueCount = payable.filter(
        (inv) => inv.status === 'overdue',
    ).length;
    const nextPayable = [...payable].sort((a, b) =>
        (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
    )[0];
    const groups = groupByProject(invoices);
    // Tanpa proyek sama sekali -> daftar polos seperti biasa (tanpa header grup).
    const grouped = groups.some((g) => g.name !== null);

    return (
        <>
            <Head title="Portal Klien" />
            <div className="flex min-h-dvh flex-col bg-muted/40">
                <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <div className="min-w-0 leading-tight">
                                <p className="text-xs text-muted-foreground">
                                    {appName} · Portal Klien
                                </p>
                                <p className="truncate font-semibold">
                                    {client.name}
                                </p>
                            </div>
                        </div>
                        <Form action="/client-portal/logout" method="post">
                            {({ processing }) => (
                                <Button
                                    type="submit"
                                    variant="ghost"
                                    size="sm"
                                    disabled={processing}
                                >
                                    {processing ? <Spinner /> : <LogOut />}
                                    <span className="hidden sm:inline">
                                        Keluar
                                    </span>
                                    <span className="sr-only sm:hidden">
                                        Keluar
                                    </span>
                                </Button>
                            )}
                        </Form>
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Halo, {client.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Berikut ringkasan seluruh invoice Anda. Klik{' '}
                            <span className="font-medium text-foreground">
                                Bayar
                            </span>{' '}
                            untuk melunasi tagihan secara online.
                        </p>
                    </div>

                    {payable.length > 0 ? (
                        <div
                            className={cn(
                                'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                                overdueCount > 0
                                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
                                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
                            )}
                            role="status"
                        >
                            <div className="flex items-start gap-3">
                                <AlertCircle
                                    className={cn(
                                        'mt-0.5 size-5 shrink-0',
                                        overdueCount > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-amber-600 dark:text-amber-400',
                                    )}
                                />
                                <div className="text-sm">
                                    <p className="font-medium">
                                        {formatNumber(payable.length)} tagihan
                                        menunggu pembayaran ·{' '}
                                        <span className="tabular-nums">
                                            {formatIDR(outstanding)}
                                        </span>
                                    </p>
                                    <p className="text-muted-foreground">
                                        {overdueCount > 0
                                            ? `${formatNumber(overdueCount)} invoice sudah melewati jatuh tempo.`
                                            : nextPayable?.due_date
                                              ? `Jatuh tempo terdekat: ${formatDate(nextPayable.due_date)} (${nextPayable.invoice_number}).`
                                              : 'Segera lakukan pembayaran agar tidak terlambat.'}
                                    </p>
                                </div>
                            </div>
                            {nextPayable && (
                                <Button asChild className="shrink-0">
                                    <Link
                                        href={`/pay/${nextPayable.public_token}`}
                                    >
                                        Bayar {nextPayable.invoice_number}{' '}
                                        <ArrowRight />
                                    </Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        active.length > 0 && (
                            <div
                                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40"
                                role="status"
                            >
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <p>
                                    Terima kasih! Semua tagihan Anda sudah
                                    lunas.
                                </p>
                            </div>
                        )
                    )}

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Total tagihan"
                            value={formatIDR(totalBilled)}
                            icon={Receipt}
                            hint={`${formatNumber(summary.invoice_count)} invoice`}
                        />
                        <StatCard
                            label="Terbayar"
                            value={formatIDR(totalPaid)}
                            icon={Wallet}
                            tone="success"
                        />
                        <StatCard
                            label="Sisa tagihan"
                            value={formatIDR(outstanding)}
                            icon={Timer}
                            tone={
                                outstanding > 0
                                    ? overdueCount > 0
                                        ? 'danger'
                                        : 'warning'
                                    : 'default'
                            }
                            hint={
                                outstanding > 0
                                    ? 'Belum dibayar'
                                    : 'Tidak ada tagihan tertunda'
                            }
                        />
                    </div>

                    <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="border-b px-4 py-4 sm:px-6">
                            <CardTitle className="text-base">
                                Daftar invoice
                            </CardTitle>
                            <CardDescription>
                                {grouped
                                    ? 'Dikelompokkan per proyek, invoice terbaru di atas. '
                                    : 'Invoice terbaru di atas. '}
                                Invoice yang dibatalkan tidak dihitung dalam
                                tagihan.
                            </CardDescription>
                        </CardHeader>

                        {invoices.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title="Belum ada invoice"
                                description="Invoice yang dikirim kepada Anda akan muncul di sini."
                            />
                        ) : (
                            <>
                                {/* Desktop */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                                <TableHead className="pl-6">
                                                    Invoice
                                                </TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">
                                                    Total
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Sisa
                                                </TableHead>
                                                <TableHead className="pr-6 text-right">
                                                    <span className="sr-only">
                                                        Aksi
                                                    </span>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {groups.map((group) => (
                                                <Fragment key={group.key}>
                                                    {grouped && (
                                                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                            <TableCell
                                                                colSpan={6}
                                                                className="px-6 py-2.5"
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <GroupTitle
                                                                        group={
                                                                            group
                                                                        }
                                                                    />
                                                                    <GroupSummary
                                                                        group={
                                                                            group
                                                                        }
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    {group.invoices.map(
                                                        (inv) => (
                                                            <DesktopRow
                                                                key={inv.id}
                                                                invoice={inv}
                                                            />
                                                        ),
                                                    )}
                                                </Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile */}
                                <div className="md:hidden">
                                    {groups.map((group) => (
                                        <section
                                            key={group.key}
                                            className="border-b last:border-b-0"
                                            aria-label={
                                                grouped
                                                    ? (group.name ??
                                                      'Tanpa proyek')
                                                    : undefined
                                            }
                                        >
                                            {grouped && (
                                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-muted/30 px-4 py-2.5 text-sm">
                                                    <GroupTitle group={group} />
                                                    <GroupSummary
                                                        group={group}
                                                    />
                                                </div>
                                            )}
                                            <ul className="divide-y">
                                                {group.invoices.map((inv) => (
                                                    <MobileItem
                                                        key={inv.id}
                                                        invoice={inv}
                                                    />
                                                ))}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>
                </main>

                <footer className="border-t bg-background">
                    <div className="mx-auto w-full max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
                        Ada pertanyaan tentang tagihan? Hubungi kami dan
                        sebutkan nomor invoice Anda.
                    </div>
                </footer>
            </div>
        </>
    );
}
