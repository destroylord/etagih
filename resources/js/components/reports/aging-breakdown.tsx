import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { AGING_BG } from '@/components/charts/palette';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatIDR, formatNumber, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type AgingRow = {
    key: 'current' | '1_30' | '31_60' | '61_90' | '90_plus' | string;
    label: string;
    amount: number | string;
    count: number;
};

const percentFormatter = new Intl.NumberFormat('id-ID', {
    style: 'percent',
    maximumFractionDigits: 0,
});

/**
 * Umur piutang: satu batang bertumpuk (bagian dari total piutang) + daftar rincian.
 * Warna = keparahan (ramp ordinal); identitas tetap dibawa label teks di setiap baris.
 */
export function AgingBreakdown({ aging }: { aging: AgingRow[] }) {
    const rows = aging.map((a) => ({ ...a, value: toNumber(a.amount) }));
    const total = rows.reduce((s, r) => s + r.value, 0);
    const overdueTotal = rows
        .filter((r) => r.key !== 'current')
        .reduce((s, r) => s + r.value, 0);

    return (
        <TooltipProvider delayDuration={0}>
            <div className="space-y-5">
                <div>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                            Total piutang
                        </span>
                        <span className="font-semibold tabular-nums">
                            {formatIDR(total)}
                        </span>
                    </div>
                    {total > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {percentFormatter.format(overdueTotal / total)}{' '}
                            sudah melewati jatuh tempo (
                            {formatIDR(overdueTotal)})
                        </p>
                    )}

                    {/* Batang bertumpuk — celah 2px antar segmen */}
                    <div
                        className={cn(
                            'mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full',
                            total === 0 && 'bg-muted',
                        )}
                        role="group"
                        aria-label="Komposisi umur piutang (rincian di daftar bawah)"
                    >
                        {total > 0 &&
                            rows
                                .filter((r) => r.value > 0)
                                .map((r) => (
                                    <Tooltip key={r.key}>
                                        <TooltipTrigger asChild>
                                            <div
                                                aria-hidden
                                                className={cn(
                                                    'h-full min-w-1',
                                                    AGING_BG[r.key] ??
                                                        'bg-muted-foreground',
                                                )}
                                                style={{
                                                    width: `${(r.value / total) * 100}%`,
                                                }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p className="font-medium">
                                                {r.label}
                                            </p>
                                            <p className="tabular-nums">
                                                {formatIDR(r.value)} ·{' '}
                                                {percentFormatter.format(
                                                    r.value / total,
                                                )}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                    </div>
                </div>

                <ul className="divide-y rounded-lg border">
                    {rows.map((r) => {
                        const overdue = r.key !== 'current';
                        const linkable = overdue && r.count > 0;
                        const content = (
                            <>
                                <span
                                    className={cn(
                                        'size-2.5 shrink-0 rounded-[3px]',
                                        AGING_BG[r.key] ??
                                            'bg-muted-foreground',
                                    )}
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {r.label}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        {formatNumber(r.count)} invoice
                                        {total > 0 && r.value > 0
                                            ? ` · ${percentFormatter.format(r.value / total)}`
                                            : ''}
                                    </span>
                                </span>
                                <span
                                    className={cn(
                                        'text-sm tabular-nums',
                                        r.value > 0
                                            ? 'font-medium'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {formatIDR(r.value)}
                                </span>
                                {linkable ? (
                                    <ChevronRight
                                        className="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                ) : (
                                    <span
                                        className="size-4 shrink-0"
                                        aria-hidden
                                    />
                                )}
                            </>
                        );

                        return (
                            <li key={r.key}>
                                {linkable ? (
                                    <Link
                                        href="/invoices?status=overdue"
                                        className="flex items-center gap-3 px-3 py-2.5 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={`${r.label}: ${formatIDR(r.value)}, ${r.count} invoice — lihat invoice terlambat`}
                                    >
                                        {content}
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                        {content}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </TooltipProvider>
    );
}
