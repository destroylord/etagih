import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    CalendarClock,
    ChevronRight,
    CircleDollarSign,
    Clock,
    FilePlus2,
    FileText,
    Plus,
    ReceiptText,
    Timer,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/invoice-status-badge';
import { PageContainer, PageHeader } from '@/components/page-header';
import { RevenueChart } from '@/components/reports/revenue-chart';
import type { RevenueRow } from '@/components/reports/revenue-chart';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { UpdateBanner } from '@/components/update-banner';
import {
    daysFromToday,
    dueLabel,
    formatDate,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Decimal, InvoiceStatus } from '@/types/models';

type Stats = {
    total_count: number;
    paid_this_month_count: number;
    paid_this_month_amount: Decimal;
    outstanding_amount: Decimal;
    pending_count: number;
    overdue_count: number;
};

type RecentInvoice = {
    id: number;
    invoice_number: string;
    total: Decimal;
    paid_amount: Decimal;
    status: InvoiceStatus;
    issue_date: string;
    due_date: string | null;
    client: { name: string } | null;
};

type UpcomingInvoice = Omit<RecentInvoice, 'issue_date'>;

type Props = {
    stats: Stats;
    recentInvoices: RecentInvoice[];
    upcomingDue?: UpcomingInvoice[];
    revenue?: RevenueRow[];
};

function greeting(): string {
    const h = new Date().getHours();

    if (h < 11) {
        return 'Selamat pagi';
    }

    if (h < 15) {
        return 'Selamat siang';
    }

    if (h < 18) {
        return 'Selamat sore';
    }

    return 'Selamat malam';
}

const QUICK_LINKS: {
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
}[] = [
    {
        href: '/invoices/create',
        label: 'Buat invoice',
        description: 'Tagihan baru untuk klien',
        icon: FilePlus2,
    },
    {
        href: '/clients',
        label: 'Klien',
        description: 'Kelola data klien',
        icon: Users,
    },
    {
        href: '/time-tracker',
        label: 'Time tracker',
        description: 'Catat jam kerja',
        icon: Timer,
    },
    {
        href: '/reports',
        label: 'Laporan',
        description: 'Pendapatan & piutang',
        icon: BarChart3,
    },
];

export default function Dashboard({
    stats,
    recentInvoices,
    upcomingDue = [],
    revenue = [],
}: Props) {
    const { auth } = usePage().props;
    const firstName = auth?.user?.name?.split(' ')[0];
    const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const revenueTotal = revenue.reduce((s, r) => s + toNumber(r.amount), 0);
    const overdue = stats.overdue_count > 0;

    return (
        <>
            <Head title="Dashboard" />
            <PageContainer size="wide">
                <PageHeader
                    title={
                        firstName ? `${greeting()}, ${firstName}` : greeting()
                    }
                    description={`${today} · Ringkasan tagihan dan pembayaran Anda.`}
                    actions={
                        <Button asChild>
                            <Link href="/invoices/create">
                                <Plus className="size-4" />
                                Buat Invoice
                            </Link>
                        </Button>
                    }
                />

                <UpdateBanner />

                {/* KPI */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Piutang aktif"
                        value={formatIDR(stats.outstanding_amount)}
                        hint={`${formatNumber(stats.pending_count + stats.overdue_count)} invoice belum lunas`}
                        icon={ReceiptText}
                    />
                    <StatCard
                        label="Diterima bulan ini"
                        value={formatIDR(stats.paid_this_month_amount)}
                        hint={`${formatNumber(stats.paid_this_month_count)} invoice lunas bulan ini`}
                        icon={CircleDollarSign}
                        tone="success"
                    />
                    <StatCard
                        label="Menunggu pembayaran"
                        value={formatNumber(stats.pending_count)}
                        hint="Invoice terkirim & dibayar sebagian"
                        icon={Clock}
                        tone={stats.pending_count > 0 ? 'warning' : 'default'}
                    />
                    <Link
                        href="/invoices?status=overdue"
                        className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`Terlambat: ${stats.overdue_count} invoice — lihat daftar`}
                    >
                        <StatCard
                            label="Terlambat"
                            value={formatNumber(stats.overdue_count)}
                            hint={
                                <span className="inline-flex items-center gap-1">
                                    {overdue
                                        ? 'Melewati jatuh tempo — tindak lanjuti'
                                        : 'Tidak ada invoice terlambat'}
                                    <ArrowRight
                                        className="size-3 transition-transform group-hover:translate-x-0.5"
                                        aria-hidden
                                    />
                                </span>
                            }
                            icon={AlertTriangle}
                            tone={overdue ? 'danger' : 'default'}
                            className={cn(
                                'h-full transition-colors group-hover:bg-muted/40',
                                overdue &&
                                    'border-red-200 dark:border-red-900/60',
                            )}
                        />
                    </Link>
                </div>

                {/* Grafik pendapatan + jatuh tempo */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="gap-4 lg:col-span-2">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1.5">
                                <CardTitle>Pendapatan</CardTitle>
                                <CardDescription>
                                    Pembayaran diterima, {revenue.length || 6}{' '}
                                    bulan terakhir
                                </CardDescription>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                    Total
                                </p>
                                <p className="font-semibold tabular-nums">
                                    {formatIDR(revenueTotal)}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="mt-auto">
                            {revenueTotal > 0 ? (
                                <RevenueChart revenue={revenue} height={200} />
                            ) : (
                                <EmptyState
                                    icon={BarChart3}
                                    title="Belum ada pendapatan"
                                    description="Grafik akan terisi setelah ada pembayaran yang diterima."
                                    className="py-8"
                                />
                            )}
                        </CardContent>
                        <div className="-mt-1 px-6">
                            <Link
                                href="/reports"
                                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                Lihat laporan lengkap{' '}
                                <ArrowRight className="size-3.5" />
                            </Link>
                        </div>
                    </Card>

                    <Card className="gap-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarClock
                                    className="size-4 text-muted-foreground"
                                    aria-hidden
                                />
                                Segera jatuh tempo
                            </CardTitle>
                            <CardDescription>14 hari ke depan</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 px-3">
                            {upcomingDue.length === 0 ? (
                                <EmptyState
                                    icon={CalendarClock}
                                    title="Tidak ada yang mendesak"
                                    description="Belum ada invoice yang jatuh tempo dalam 14 hari."
                                    className="py-8"
                                />
                            ) : (
                                <ul className="space-y-0.5">
                                    {upcomingDue.map((inv) => {
                                        const remaining =
                                            toNumber(inv.total) -
                                            toNumber(inv.paid_amount);
                                        const days = daysFromToday(
                                            inv.due_date,
                                        );
                                        const soon = days !== null && days <= 3;

                                        return (
                                            <li key={inv.id}>
                                                <Link
                                                    href={`/invoices/${inv.id}`}
                                                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium">
                                                            {inv.client?.name ??
                                                                '—'}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {inv.invoice_number}{' '}
                                                            ·{' '}
                                                            {formatDate(
                                                                inv.due_date,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-sm font-medium tabular-nums">
                                                            {formatIDR(
                                                                remaining,
                                                            )}
                                                        </p>
                                                        <p
                                                            className={cn(
                                                                'text-xs',
                                                                soon
                                                                    ? 'font-medium text-amber-700 dark:text-amber-400'
                                                                    : 'text-muted-foreground',
                                                            )}
                                                        >
                                                            {dueLabel(
                                                                inv.due_date,
                                                            )}
                                                        </p>
                                                    </div>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Invoice terbaru */}
                <Card className="gap-0 py-0">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 py-5">
                        <div className="space-y-1.5">
                            <CardTitle>Invoice terbaru</CardTitle>
                            <CardDescription>
                                {formatNumber(stats.total_count)} invoice total
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/invoices">
                                Lihat semua <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    {recentInvoices.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="Belum ada invoice"
                            description="Buat invoice pertama Anda untuk mulai menagih klien."
                            action={
                                <Button size="sm" asChild>
                                    <Link href="/invoices/create">
                                        <Plus className="size-4" /> Buat Invoice
                                    </Link>
                                </Button>
                            }
                            className="border-t"
                        />
                    ) : (
                        <div className="border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-6">
                                            No. invoice
                                        </TableHead>
                                        <TableHead className="hidden sm:table-cell">
                                            Klien
                                        </TableHead>
                                        <TableHead className="hidden md:table-cell">
                                            Tanggal
                                        </TableHead>
                                        <TableHead className="hidden md:table-cell">
                                            Jatuh tempo
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Total
                                        </TableHead>
                                        <TableHead className="pr-6">
                                            Status
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentInvoices.map((inv) => (
                                        <TableRow
                                            key={inv.id}
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                if (
                                                    (
                                                        e.target as HTMLElement
                                                    ).closest('a')
                                                ) {
                                                    return;
                                                }

                                                router.visit(
                                                    `/invoices/${inv.id}`,
                                                );
                                            }}
                                        >
                                            <TableCell className="pl-6">
                                                <Link
                                                    href={`/invoices/${inv.id}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {inv.invoice_number}
                                                </Link>
                                                <span className="block max-w-[10rem] truncate text-xs text-muted-foreground sm:hidden">
                                                    {inv.client?.name ?? '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden max-w-[14rem] truncate sm:table-cell">
                                                {inv.client?.name ?? '—'}
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground md:table-cell">
                                                {formatDate(inv.issue_date)}
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground md:table-cell">
                                                {formatDate(inv.due_date)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {formatIDR(inv.total)}
                                            </TableCell>
                                            <TableCell className="pr-6">
                                                <StatusBadge
                                                    status={inv.status}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Card>

                {/* Pintasan */}
                <nav
                    aria-label="Pintasan"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                    {QUICK_LINKS.map((q) => (
                        <Link
                            key={q.href}
                            href={q.href}
                            className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
                                <q.icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">
                                    {q.label}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {q.description}
                                </span>
                            </span>
                            <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                                aria-hidden
                            />
                        </Link>
                    ))}
                </nav>
            </PageContainer>
        </>
    );
}
