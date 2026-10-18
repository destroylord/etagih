import { Link } from '@inertiajs/react';
import { ChevronDown, CornerDownRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { SERIES_1_BG } from '@/components/charts/palette';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDuration, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectNode } from '@/types/models';

const pctFormatter = new Intl.NumberFormat('id-ID', {
    style: 'percent',
    maximumFractionDigits: 0,
});

type ShareRow = {
    key: string;
    id: number | null;
    name: string;
    value: number;
    node: ProjectNode | null;
};

/**
 * Pembagian nilai pekerjaan proyek ke sub-proyeknya. Sisa yang tidak
 * ditautkan ke sub-proyek mana pun tampil sebagai "Langsung di proyek".
 */
function shareRows(p: ProjectNode): ShareRow[] {
    const kids = p.children ?? [];
    const rows: ShareRow[] = kids.map((c) => ({
        key: `c${c.id}`,
        id: c.id,
        name: c.name,
        value: c.stats.work_value,
        node: c,
    }));
    const direct =
        p.stats.work_value - kids.reduce((s, c) => s + c.stats.work_value, 0);

    if (direct >= 1) {
        rows.push({
            key: 'direct',
            id: null,
            name: 'Langsung di proyek',
            value: direct,
            node: null,
        });
    }

    return rows.sort((a, b) => b.value - a.value);
}

/** Batang porsi (satu seri) + persentase sebagai label teks. */
function ShareBar({ value, total }: { value: number; total: number }) {
    const ratio = total > 0 ? value / total : 0;

    return (
        <div className="flex items-center gap-2">
            <div
                className="h-1.5 min-w-12 flex-1 rounded-full bg-muted"
                role="img"
                aria-label={`${pctFormatter.format(ratio)} dari nilai pekerjaan proyek`}
                title={`${formatIDR(value)} · ${pctFormatter.format(ratio)}`}
            >
                <div
                    className={cn('h-full rounded-full', SERIES_1_BG)}
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
            </div>
            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {pctFormatter.format(ratio)}
            </span>
        </div>
    );
}

function Outstanding({ value }: { value: number }) {
    return (
        <span
            className={cn(
                'tabular-nums',
                value > 0 ? 'font-medium' : 'text-muted-foreground',
            )}
        >
            {formatIDR(value)}
        </span>
    );
}

/** Ringkasan per proyek (desktop: tabel; HP: kartu), bisa dibuka ke sub-proyek. */
export function ProjectBreakdown({ projects }: { projects: ProjectNode[] }) {
    const [open, setOpen] = useState<Record<number, boolean>>({});
    const toggle = (id: number) => setOpen((o) => ({ ...o, [id]: !o[id] }));

    const expandable = (p: ProjectNode) => (p.children?.length ?? 0) > 0;

    return (
        <>
            {/* Desktop */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10 pl-6">
                                <span className="sr-only">Sub-proyek</span>
                            </TableHead>
                            <TableHead>Proyek</TableHead>
                            <TableHead className="text-right">
                                Ditagih
                            </TableHead>
                            <TableHead className="text-right">
                                Terbayar
                            </TableHead>
                            <TableHead className="text-right">Sisa</TableHead>
                            <TableHead className="text-right">
                                Nilai pekerjaan
                            </TableHead>
                            <TableHead className="pr-6 text-right">
                                Jam
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.map((p) => {
                            const isOpen = !!open[p.id];

                            return (
                                <Fragment key={p.id}>
                                    <TableRow
                                        data-state={
                                            isOpen ? 'selected' : undefined
                                        }
                                    >
                                        <TableCell className="pl-6">
                                            {expandable(p) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    onClick={() => toggle(p.id)}
                                                    aria-expanded={isOpen}
                                                    aria-label={
                                                        isOpen
                                                            ? `Sembunyikan sub-proyek ${p.name}`
                                                            : `Tampilkan sub-proyek ${p.name}`
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
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-64 whitespace-normal">
                                            <Link
                                                href={`/projects/${p.id}`}
                                                className="font-medium break-words hover:underline"
                                            >
                                                {p.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {p.client?.name ?? '—'}
                                                {expandable(p) &&
                                                    ` · ${p.children?.length} sub-proyek`}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatIDR(p.stats.billed)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatIDR(p.stats.paid)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Outstanding
                                                value={p.stats.outstanding}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatIDR(p.stats.work_value)}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right text-muted-foreground tabular-nums">
                                            {formatDuration(
                                                p.stats.tracked_seconds,
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {isOpen &&
                                        shareRows(p).map((r) => (
                                            <TableRow
                                                key={r.key}
                                                className="bg-muted/30 hover:bg-muted/30"
                                            >
                                                <TableCell className="pl-6" />
                                                <TableCell className="whitespace-normal">
                                                    <div className="flex items-start gap-1.5">
                                                        <CornerDownRight
                                                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                                                            aria-hidden
                                                        />
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            {r.id ? (
                                                                <Link
                                                                    href={`/projects/${r.id}`}
                                                                    className="text-sm break-words hover:underline"
                                                                >
                                                                    {r.name}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-sm text-muted-foreground">
                                                                    {r.name}
                                                                </span>
                                                            )}
                                                            <ShareBar
                                                                value={r.value}
                                                                total={
                                                                    p.stats
                                                                        .work_value
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">
                                                    {r.node
                                                        ? formatIDR(
                                                              r.node.stats
                                                                  .billed,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">
                                                    {r.node
                                                        ? formatIDR(
                                                              r.node.stats.paid,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {r.node ? (
                                                        <Outstanding
                                                            value={
                                                                r.node.stats
                                                                    .outstanding
                                                            }
                                                        />
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">
                                                    {formatIDR(r.value)}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right text-sm text-muted-foreground tabular-nums">
                                                    {r.node
                                                        ? formatDuration(
                                                              r.node.stats
                                                                  .tracked_seconds,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile */}
            <ul className="divide-y md:hidden">
                {projects.map((p) => {
                    const isOpen = !!open[p.id];

                    return (
                        <li key={p.id} className="space-y-3 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link
                                        href={`/projects/${p.id}`}
                                        className="font-medium break-words hover:underline"
                                    >
                                        {p.name}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {p.client?.name ?? '—'} ·{' '}
                                        {formatDuration(
                                            p.stats.tracked_seconds,
                                        )}
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold tabular-nums">
                                    {formatIDR(p.stats.billed)}
                                </span>
                            </div>
                            <dl className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                    <dt className="text-muted-foreground">
                                        Terbayar
                                    </dt>
                                    <dd className="tabular-nums">
                                        {formatIDR(p.stats.paid)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Sisa
                                    </dt>
                                    <dd>
                                        <Outstanding
                                            value={p.stats.outstanding}
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Nilai kerja
                                    </dt>
                                    <dd className="tabular-nums">
                                        {formatIDR(p.stats.work_value)}
                                    </dd>
                                </div>
                            </dl>
                            {expandable(p) && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-2 h-8"
                                        onClick={() => toggle(p.id)}
                                        aria-expanded={isOpen}
                                    >
                                        {p.children?.length} sub-proyek
                                        <ChevronDown
                                            className={cn(
                                                'size-4 transition-transform',
                                                isOpen && 'rotate-180',
                                            )}
                                        />
                                    </Button>
                                    {isOpen && (
                                        <ul className="space-y-2.5 border-l pl-3">
                                            {shareRows(p).map((r) => (
                                                <li
                                                    key={r.key}
                                                    className="space-y-1"
                                                >
                                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                                        {r.id ? (
                                                            <Link
                                                                href={`/projects/${r.id}`}
                                                                className="min-w-0 truncate hover:underline"
                                                            >
                                                                {r.name}
                                                            </Link>
                                                        ) : (
                                                            <span className="min-w-0 truncate text-muted-foreground">
                                                                {r.name}
                                                            </span>
                                                        )}
                                                        <span className="shrink-0 tabular-nums">
                                                            {formatIDR(r.value)}
                                                        </span>
                                                    </div>
                                                    <ShareBar
                                                        value={r.value}
                                                        total={
                                                            p.stats.work_value
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
