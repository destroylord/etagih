import { useMemo } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SERIES_1_BG } from './palette';

export type ColumnDatum = {
    key: string;
    /** Label sumbu X (pendek). */
    label: string;
    /** Label lengkap untuk tooltip / tabel. */
    fullLabel?: string;
    value: number;
    /** Baris tambahan di tooltip, mis. "3 pembayaran". */
    detail?: string;
};

/** Pembulatan maksimum sumbu ke angka "bersih" (1, 2, 2.5, 5, 10 × 10^n). */
function niceMax(value: number): number {
    if (value <= 0) {
        return 1;
    }

    const exp = Math.floor(Math.log10(value));
    const base = 10 ** exp;
    const f = value / base;
    const step = [1, 2, 2.5, 5, 10].find((s) => f <= s) ?? 10;

    return step * base;
}

/**
 * Grafik kolom satu seri, ringan (HTML/CSS), responsif & aksesibel:
 * - kolom tipis (≤ 24px) berujung bulat 4px, tumbuh dari satu baseline;
 * - tooltip berisi nilai persis saat hover / fokus keyboard;
 * - tabel tersembunyi (sr-only) sebagai alternatif teks.
 */
export function ColumnChart({
    data,
    formatValue,
    formatAxis,
    ariaLabel,
    height = 200,
    highlightLast = false,
    className,
}: {
    data: ColumnDatum[];
    formatValue: (v: number) => string;
    formatAxis: (v: number) => string;
    ariaLabel: string;
    height?: number;
    /** Tandai kolom terakhir (mis. bulan berjalan) dengan label nilai. */
    highlightLast?: boolean;
    className?: string;
}) {
    const max = useMemo(
        () => niceMax(Math.max(0, ...data.map((d) => d.value))),
        [data],
    );
    const ticks = [max, max / 2, 0];
    const peakIndex = useMemo(() => {
        let idx = -1;
        let best = 0;
        data.forEach((d, i) => {
            if (d.value > best) {
                best = d.value;
                idx = i;
            }
        });

        return idx;
    }, [data]);
    // Label sumbu X dijarangkan bila kolom banyak, supaya tidak bertabrakan di layar sempit.
    const labelEvery = data.length > 12 ? 3 : data.length > 6 ? 2 : 1;
    const labelIndex = highlightLast ? data.length - 1 : peakIndex;

    return (
        <TooltipProvider delayDuration={0}>
            <figure className={cn('w-full', className)} aria-label={ariaLabel}>
                <div className="flex gap-2">
                    {/* Sumbu Y */}
                    <div
                        className="relative w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums"
                        style={{ height }}
                        aria-hidden
                    >
                        {ticks.map((t, i) => (
                            <span
                                key={t}
                                className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                                style={{
                                    top: `${(i / (ticks.length - 1)) * 100}%`,
                                }}
                            >
                                {t === 0 ? '0' : formatAxis(t)}
                            </span>
                        ))}
                    </div>

                    <div className="min-w-0 flex-1">
                        {/* Area plot */}
                        <div className="relative" style={{ height }}>
                            {ticks.map((t, i) => (
                                <div
                                    key={t}
                                    aria-hidden
                                    className={cn(
                                        'absolute inset-x-0 h-px',
                                        t === 0 ? 'bg-border' : 'bg-border/60',
                                    )}
                                    style={{
                                        top: `${(i / (ticks.length - 1)) * 100}%`,
                                    }}
                                />
                            ))}

                            <div
                                className="absolute inset-0 flex items-end gap-0.5"
                                role="list"
                            >
                                {data.map((d, i) => {
                                    const pct =
                                        max > 0 ? (d.value / max) * 100 : 0;
                                    const showLabel =
                                        i === labelIndex && d.value > 0;

                                    return (
                                        <Tooltip key={d.key}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    role="listitem"
                                                    tabIndex={0}
                                                    aria-label={`${d.fullLabel ?? d.label}: ${formatValue(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
                                                    className="group relative flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end rounded-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    {showLabel && (
                                                        <span className="pointer-events-none mb-1 hidden text-[11px] font-medium whitespace-nowrap text-foreground tabular-nums sm:block">
                                                            {formatAxis(
                                                                d.value,
                                                            )}
                                                        </span>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            'w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-85',
                                                            SERIES_1_BG,
                                                            d.value > 0 &&
                                                                'min-h-[2px]',
                                                        )}
                                                        style={{
                                                            height: `${pct}%`,
                                                        }}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side="top"
                                                className="text-left"
                                            >
                                                <p className="font-medium">
                                                    {d.fullLabel ?? d.label}
                                                </p>
                                                <p className="tabular-nums">
                                                    {formatValue(d.value)}
                                                </p>
                                                {d.detail && (
                                                    <p className="opacity-80">
                                                        {d.detail}
                                                    </p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sumbu X */}
                        <div
                            className="mt-2 flex gap-0.5 text-[11px] text-muted-foreground"
                            aria-hidden
                        >
                            {data.map((d, i) => (
                                <span
                                    key={d.key}
                                    className="min-w-0 flex-1 truncate text-center"
                                >
                                    {(data.length - 1 - i) % labelEvery === 0
                                        ? d.label
                                        : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Alternatif teks untuk pembaca layar */}
                <table className="sr-only">
                    <caption>{ariaLabel}</caption>
                    <thead>
                        <tr>
                            <th scope="col">Periode</th>
                            <th scope="col">Nilai</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((d) => (
                            <tr key={d.key}>
                                <th scope="row">{d.fullLabel ?? d.label}</th>
                                <td>
                                    {formatValue(d.value)}
                                    {d.detail ? ` (${d.detail})` : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </figure>
        </TooltipProvider>
    );
}
