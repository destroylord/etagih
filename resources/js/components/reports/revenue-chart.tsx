import { useMemo } from 'react';
import { ColumnChart } from '@/components/charts/column-chart';
import type { ColumnDatum } from '@/components/charts/column-chart';
import {
    formatIDR,
    formatIDRCompact,
    formatNumber,
    toNumber,
} from '@/lib/format';

export type RevenueRow = {
    month: string;
    label: string;
    amount: number | string;
    count: number;
};

const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
});

function parseMonth(key: string): Date | null {
    const [y, m] = key.split('-').map(Number);

    return y && m ? new Date(y, m - 1, 1) : null;
}

export function toRevenueColumns(revenue: RevenueRow[]): ColumnDatum[] {
    return revenue.map((r, i) => {
        const d = parseMonth(r.month);
        const short = d ? monthShort.format(d).replace('.', '') : r.label;
        // Tahun ditampilkan di kolom pertama & setiap Januari supaya pergantian tahun jelas.
        const withYear =
            d && (i === 0 || d.getMonth() === 0)
                ? `${short} ’${String(d.getFullYear()).slice(2)}`
                : short;

        return {
            key: r.month,
            label: withYear,
            fullLabel: d ? monthLong.format(d) : r.label,
            value: toNumber(r.amount),
            detail: `${formatNumber(r.count)} pembayaran`,
        };
    });
}

/** Grafik pendapatan per bulan (pembayaran sukses). */
export function RevenueChart({
    revenue,
    height,
}: {
    revenue: RevenueRow[];
    height?: number;
}) {
    const data = useMemo(() => toRevenueColumns(revenue), [revenue]);

    return (
        <ColumnChart
            data={data}
            height={height}
            highlightLast={false}
            formatValue={formatIDR}
            formatAxis={(v) => formatIDRCompact(v).replace('Rp ', '')}
            ariaLabel={`Pendapatan per bulan, ${revenue.length} bulan terakhir`}
        />
    );
}
