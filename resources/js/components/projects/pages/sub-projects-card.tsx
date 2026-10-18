import { Link } from '@inertiajs/react';
import { FolderPlus, Layers } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ProjectStatusBadge, ShareBar, percentOf } from './project-helpers';

type Row = {
    key: string;
    id: number | null;
    name: string;
    node: ProjectNode | null;
    workValue: number;
};

/**
 * Tabel sub-proyek untuk proyek utama: statistik per sub-proyek + porsi nilai
 * pekerjaan (jumlah item invoice, sebelum diskon & pajak).
 */
export function SubProjectsCard({
    tree,
    onAddSub,
}: {
    tree: ProjectNode;
    onAddSub: () => void;
}) {
    const children = tree.children ?? [];
    const total = tree.stats.work_value;
    const childSum = children.reduce((s, c) => s + c.stats.work_value, 0);
    const direct = Math.max(0, total - childSum);

    const rows: Row[] = children.map((c) => ({
        key: String(c.id),
        id: c.id,
        name: c.name,
        node: c,
        workValue: c.stats.work_value,
    }));

    if (direct > 0.5 && children.length > 0) {
        rows.push({
            key: 'direct',
            id: null,
            name: `Langsung di ${tree.name}`,
            node: null,
            workValue: direct,
        });
    }

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Layers className="size-4 text-muted-foreground" />{' '}
                        Sub-proyek
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Nilai pekerjaan = jumlah item invoice per sub-proyek,
                        sebelum diskon &amp; pajak.
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAddSub}
                    className="shrink-0"
                >
                    <FolderPlus /> Tambah
                </Button>
            </CardHeader>

            {children.length === 0 ? (
                <EmptyState
                    icon={Layers}
                    title="Belum ada sub-proyek"
                    description={`Pecah ${tree.name} menjadi sub-proyek untuk melihat porsi tagihan & jam kerja masing-masing.`}
                    action={
                        <Button onClick={onAddSub}>
                            <FolderPlus /> Tambah sub-proyek
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
                                    <TableHead className="pl-4 sm:pl-6">
                                        Sub-proyek
                                    </TableHead>
                                    <TableHead className="w-[32%]">
                                        Nilai pekerjaan
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Ditagih
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Sisa
                                    </TableHead>
                                    <TableHead className="pr-4 text-right sm:pr-6">
                                        Jam
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r) => {
                                    const pct = percentOf(r.workValue, total);

                                    return (
                                        <TableRow key={r.key}>
                                            <TableCell className="max-w-56 pl-4 sm:pl-6">
                                                {r.node ? (
                                                    <div className="flex min-w-0 flex-col gap-1">
                                                        <Link
                                                            href={`/projects/${r.id}`}
                                                            className="truncate font-medium hover:underline"
                                                        >
                                                            {r.name}
                                                        </Link>
                                                        {r.node.status !==
                                                            'active' && (
                                                            <ProjectStatusBadge
                                                                status={
                                                                    r.node
                                                                        .status
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground italic">
                                                        {r.name}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                                                    <span>
                                                        {formatIDR(r.workValue)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {Math.round(pct)}%
                                                    </span>
                                                </div>
                                                <ShareBar
                                                    value={pct}
                                                    label={`Porsi ${r.name}`}
                                                    className="mt-1.5"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right text-sm tabular-nums">
                                                {r.node
                                                    ? formatIDR(
                                                          r.node.stats.billed,
                                                      )
                                                    : '—'}
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    'text-right text-sm tabular-nums',
                                                    r.node &&
                                                        r.node.stats
                                                            .outstanding > 0
                                                        ? 'font-medium'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {r.node
                                                    ? formatIDR(
                                                          r.node.stats
                                                              .outstanding,
                                                      )
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="pr-4 text-right text-sm tabular-nums sm:pr-6">
                                                {r.node &&
                                                r.node.stats.tracked_seconds > 0
                                                    ? formatDuration(
                                                          r.node.stats
                                                              .tracked_seconds,
                                                      )
                                                    : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile */}
                    <ul className="divide-y md:hidden">
                        {rows.map((r) => {
                            const pct = percentOf(r.workValue, total);

                            return (
                                <li key={r.key} className="space-y-2 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        {r.node ? (
                                            <Link
                                                href={`/projects/${r.id}`}
                                                className="truncate font-medium hover:underline"
                                            >
                                                {r.name}
                                            </Link>
                                        ) : (
                                            <span className="truncate text-sm text-muted-foreground italic">
                                                {r.name}
                                            </span>
                                        )}
                                        <span className="shrink-0 text-sm tabular-nums">
                                            {formatIDR(r.workValue)}{' '}
                                            <span className="text-xs text-muted-foreground">
                                                ({Math.round(pct)}%)
                                            </span>
                                        </span>
                                    </div>
                                    <ShareBar
                                        value={pct}
                                        label={`Porsi ${r.name}`}
                                    />
                                    {r.node && (
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                            Ditagih{' '}
                                            {formatIDR(r.node.stats.billed)} ·
                                            Sisa{' '}
                                            {formatIDR(
                                                r.node.stats.outstanding,
                                            )}
                                            {r.node.stats.tracked_seconds > 0 &&
                                                ` · ${formatDuration(r.node.stats.tracked_seconds)}`}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </Card>
    );
}
