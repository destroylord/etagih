import { Link } from '@inertiajs/react';
import { SERIES_1_BG } from '@/components/charts/palette';
import { formatIDR, formatNumber, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type TopClientRow = {
    id: number;
    name: string;
    outstanding: number | string;
    invoice_count: number;
};

/** Klien dengan piutang terbesar — batang relatif terhadap klien teratas. */
export function TopClients({ clients }: { clients: TopClientRow[] }) {
    const max = Math.max(0, ...clients.map((c) => toNumber(c.outstanding)));

    return (
        <ol className="space-y-1">
            {clients.map((c, i) => {
                const value = toNumber(c.outstanding);
                const pct = max > 0 ? (value / max) * 100 : 0;

                return (
                    <li key={c.id}>
                        <Link
                            href={`/clients/${c.id}`}
                            className="block rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <div className="flex items-baseline gap-3">
                                <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                                    {i + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {c.name}
                                </span>
                                <span className="text-sm font-medium tabular-nums">
                                    {formatIDR(value)}
                                </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-3 pl-7">
                                <div
                                    className="h-1.5 flex-1 rounded-full bg-muted"
                                    aria-hidden
                                >
                                    <div
                                        className={cn(
                                            'h-full rounded-full',
                                            SERIES_1_BG,
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                    {formatNumber(c.invoice_count)} invoice
                                </span>
                            </div>
                        </Link>
                    </li>
                );
            })}
        </ol>
    );
}
