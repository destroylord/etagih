import { Head, router } from '@inertiajs/react';
import {
    BarChart3,
    CircleDollarSign,
    Download,
    FileText,
    FolderKanban,
    HandCoins,
    ReceiptText,
    Users,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { AgingBreakdown } from '@/components/reports/aging-breakdown';
import type { AgingRow } from '@/components/reports/aging-breakdown';
import { ProjectBreakdown } from '@/components/reports/project-breakdown';
import type { RevenueRow } from '@/components/reports/revenue-chart';
import {
    RevenueChart,
    toRevenueColumns,
} from '@/components/reports/revenue-chart';
import { TopClients } from '@/components/reports/top-clients';
import type { TopClientRow } from '@/components/reports/top-clients';
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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatIDR, formatNumber, toNumber } from '@/lib/format';
import type { ProjectNode } from '@/types/models';

type Summary = {
    revenue_period: number | string;
    revenue_ytd: number | string;
    billed_ytd: number | string;
    outstanding: number | string;
};

type Props = {
    months: 6 | 12 | 24;
    revenue: RevenueRow[];
    aging: AgingRow[];
    topClients: TopClientRow[];
    summary: Summary;
    projects?: ProjectNode[];
};

const PERIODS = [6, 12, 24] as const;
const percentFormatter = new Intl.NumberFormat('id-ID', {
    style: 'percent',
    maximumFractionDigits: 0,
});

export default function Reports({
    months,
    revenue,
    aging,
    topClients,
    summary,
    projects = [],
}: Props) {
    const [view, setView] = useState<'chart' | 'table'>('chart');

    const changePeriod = (value: string) => {
        if (!value || Number(value) === months) {
            return;
        }

        router.get(
            '/reports',
            { months: Number(value) },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const revenueRows = toRevenueColumns(revenue);
    const revenueTotal = revenueRows.reduce((s, r) => s + r.value, 0);
    const paymentCount = revenue.reduce((s, r) => s + r.count, 0);
    const average = revenue.length > 0 ? revenueTotal / revenue.length : 0;
    const hasRevenue = revenueTotal > 0;

    const revenueYtd = toNumber(summary.revenue_ytd);
    const billedYtd = toNumber(summary.billed_ytd);
    const outstanding = toNumber(summary.outstanding);
    const overdueCount = aging
        .filter((a) => a.key !== 'current')
        .reduce((s, a) => s + a.count, 0);
    const openCount = aging.reduce((s, a) => s + a.count, 0);

    return (
        <>
            <Head title="Laporan" />
            <PageContainer size="wide">
                <PageHeader
                    title="Laporan"
                    description="Pendapatan, umur piutang, dan klien dengan tagihan terbesar."
                    actions={
                        <>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                value={String(months)}
                                onValueChange={changePeriod}
                                aria-label="Periode laporan"
                            >
                                {PERIODS.map((p) => (
                                    <ToggleGroupItem
                                        key={p}
                                        value={String(p)}
                                        className="px-3"
                                        aria-label={`${p} bulan terakhir`}
                                    >
                                        {p} bln
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                            <Button variant="outline" size="sm" asChild>
                                <a href="/invoices/export">
                                    <Download className="size-4" />
                                    Export Excel
                                </a>
                            </Button>
                        </>
                    }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label={`Pendapatan ${months} bulan`}
                        value={formatIDR(summary.revenue_period)}
                        hint={`${formatNumber(paymentCount)} pembayaran · rata-rata ${formatIDR(average)}/bln`}
                        icon={CircleDollarSign}
                        tone="success"
                    />
                    <StatCard
                        label="Pendapatan tahun ini"
                        value={formatIDR(revenueYtd)}
                        hint="Pembayaran diterima sejak 1 Januari"
                        icon={Wallet}
                    />
                    <StatCard
                        label="Ditagih tahun ini"
                        value={formatIDR(billedYtd)}
                        hint={
                            billedYtd > 0
                                ? `${percentFormatter.format(Math.min(revenueYtd / billedYtd, 9.99))} sudah tertagih`
                                : 'Belum ada tagihan tahun ini'
                        }
                        icon={FileText}
                    />
                    <StatCard
                        label="Piutang aktif"
                        value={formatIDR(outstanding)}
                        hint={
                            overdueCount > 0
                                ? `${formatNumber(openCount)} invoice · ${formatNumber(overdueCount)} terlambat`
                                : `${formatNumber(openCount)} invoice belum lunas`
                        }
                        icon={ReceiptText}
                        tone={overdueCount > 0 ? 'danger' : 'default'}
                    />
                </div>

                <Card className="gap-4">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1.5">
                            <CardTitle>Pendapatan per bulan</CardTitle>
                            <CardDescription>
                                Pembayaran sukses yang diterima, {months} bulan
                                terakhir (Rupiah).
                            </CardDescription>
                        </div>
                        {hasRevenue && (
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                value={view}
                                onValueChange={(v) =>
                                    v && setView(v as 'chart' | 'table')
                                }
                                aria-label="Tampilan data pendapatan"
                            >
                                <ToggleGroupItem value="chart" className="px-3">
                                    Grafik
                                </ToggleGroupItem>
                                <ToggleGroupItem value="table" className="px-3">
                                    Tabel
                                </ToggleGroupItem>
                            </ToggleGroup>
                        )}
                    </CardHeader>
                    <CardContent>
                        {!hasRevenue ? (
                            <EmptyState
                                icon={BarChart3}
                                title="Belum ada pendapatan"
                                description={`Tidak ada pembayaran sukses dalam ${months} bulan terakhir.`}
                                className="py-10"
                            />
                        ) : view === 'chart' ? (
                            <RevenueChart revenue={revenue} height={240} />
                        ) : (
                            <div className="-mx-6 border-t">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">
                                                Bulan
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Pembayaran
                                            </TableHead>
                                            <TableHead className="pr-6 text-right">
                                                Pendapatan
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...revenueRows].reverse().map((r) => (
                                            <TableRow key={r.key}>
                                                <TableCell className="pl-6 capitalize">
                                                    {r.fullLabel}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground tabular-nums">
                                                    {formatNumber(
                                                        revenue.find(
                                                            (x) =>
                                                                x.month ===
                                                                r.key,
                                                        )?.count ?? 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right font-medium tabular-nums">
                                                    {formatIDR(r.value)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="pl-6 font-medium">
                                                Total
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatNumber(paymentCount)}
                                            </TableCell>
                                            <TableCell className="pr-6 text-right font-semibold tabular-nums">
                                                {formatIDR(revenueTotal)}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="gap-4">
                        <CardHeader>
                            <CardTitle>Umur piutang</CardTitle>
                            <CardDescription>
                                Sisa tagihan belum lunas, dikelompokkan menurut
                                keterlambatan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {openCount === 0 ? (
                                <EmptyState
                                    icon={HandCoins}
                                    title="Tidak ada piutang"
                                    description="Semua invoice yang terkirim sudah lunas."
                                    className="py-10"
                                />
                            ) : (
                                <AgingBreakdown aging={aging} />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="gap-4">
                        <CardHeader>
                            <CardTitle>Piutang terbesar per klien</CardTitle>
                            <CardDescription>
                                Klien dengan sisa tagihan tertinggi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4">
                            {topClients.length === 0 ? (
                                <EmptyState
                                    icon={Users}
                                    title="Belum ada piutang klien"
                                    description="Klien dengan tagihan belum lunas akan muncul di sini."
                                    className="py-10"
                                />
                            ) : (
                                <TopClients clients={topClients} />
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="gap-4">
                    <CardHeader>
                        <CardTitle>Per proyek</CardTitle>
                        <CardDescription>
                            Ditagih &amp; terbayar dihitung per invoice yang
                            ditautkan ke proyek. Nilai pekerjaan = total item
                            invoice per sub-proyek, sebelum diskon &amp; pajak.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                        {projects.length === 0 ? (
                            <EmptyState
                                icon={FolderKanban}
                                title="Belum ada data proyek"
                                description="Tautkan invoice atau sesi Time Tracker ke proyek (mis. Toko Online → Aplikasi Mobile) untuk melihat ringkasan per proyek."
                                className="py-10"
                            />
                        ) : (
                            <ProjectBreakdown projects={projects} />
                        )}
                    </CardContent>
                </Card>
            </PageContainer>
        </>
    );
}
