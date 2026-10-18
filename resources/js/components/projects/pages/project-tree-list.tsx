import { Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    ChevronDown,
    CornerDownRight,
    FolderPlus,
    Pencil,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { IconAction } from '@/components/clients/client-actions';
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
import { ProjectStatusBadge } from './project-helpers';

type Handlers = {
    onEdit: (node: ProjectNode) => void;
    onAddSub: (node: ProjectNode) => void;
};

function OpenAction({ node }: { node: ProjectNode }) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            asChild
        >
            <Link
                href={`/projects/${node.id}`}
                aria-label={`Buka ${node.name}`}
                title="Buka detail"
            >
                <ArrowUpRight className="size-4" />
            </Link>
        </Button>
    );
}

function RowActions({
    node,
    onEdit,
    onAddSub,
}: Handlers & { node: ProjectNode }) {
    const isSub = node.parent_id !== null;

    return (
        <div className="flex items-center justify-end gap-0.5">
            {!isSub && (
                <IconAction
                    label="Tambah sub-proyek"
                    icon={FolderPlus}
                    onClick={() => onAddSub(node)}
                />
            )}
            <IconAction
                label={isSub ? 'Edit sub-proyek' : 'Edit proyek'}
                icon={Pencil}
                onClick={() => onEdit(node)}
            />
            <OpenAction node={node} />
        </div>
    );
}

function Money({ value, strong }: { value: number; strong?: boolean }) {
    return (
        <span
            className={cn(
                'tabular-nums',
                value === 0 && 'text-muted-foreground',
                strong && value > 0 && 'font-medium',
            )}
        >
            {formatIDR(value)}
        </span>
    );
}

function Hours({ seconds }: { seconds: number }) {
    return (
        <span
            className={cn(
                'tabular-nums',
                seconds === 0 && 'text-muted-foreground',
            )}
        >
            {seconds > 0 ? formatDuration(seconds) : '—'}
        </span>
    );
}

/**
 * Daftar proyek sebagai pohon yang bisa dibuka-tutup: tabel di desktop,
 * kartu di mobile. Proyek utama sudah membawa statistik gabungan sub-proyek.
 */
export function ProjectTreeList({
    projects,
    expandByDefault,
    onEdit,
    onAddSub,
}: Handlers & { projects: ProjectNode[]; expandByDefault: boolean }) {
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const isOpen = (id: number) => expanded[id] ?? expandByDefault;
    const toggle = (id: number) =>
        setExpanded((o) => ({ ...o, [id]: !(o[id] ?? expandByDefault) }));

    return (
        <>
            {/* Desktop */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="w-10 pl-4">
                                <span className="sr-only">Sub-proyek</span>
                            </TableHead>
                            <TableHead>Proyek</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                                Ditagih
                            </TableHead>
                            <TableHead className="text-right">
                                Terbayar
                            </TableHead>
                            <TableHead className="text-right">Sisa</TableHead>
                            <TableHead className="text-right">Jam</TableHead>
                            <TableHead className="w-28 pr-4 text-right">
                                <span className="sr-only">Aksi</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.map((p) => {
                            const children = p.children ?? [];
                            const open = isOpen(p.id) && children.length > 0;

                            return (
                                <Fragment key={p.id}>
                                    <TableRow
                                        data-state={
                                            open ? 'selected' : undefined
                                        }
                                    >
                                        <TableCell className="pl-4">
                                            {children.length > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    onClick={() => toggle(p.id)}
                                                    aria-expanded={open}
                                                    aria-label={
                                                        open
                                                            ? `Sembunyikan sub-proyek ${p.name}`
                                                            : `Tampilkan sub-proyek ${p.name}`
                                                    }
                                                >
                                                    <ChevronDown
                                                        className={cn(
                                                            'size-4 transition-transform',
                                                            !open &&
                                                                '-rotate-90',
                                                        )}
                                                    />
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-72">
                                            <Link
                                                href={`/projects/${p.id}`}
                                                className="block truncate font-medium hover:underline"
                                            >
                                                {p.name}
                                            </Link>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {p.client?.name ?? '—'}
                                                {' · '}
                                                {children.length > 0
                                                    ? `${children.length} sub-proyek`
                                                    : 'Tanpa sub-proyek'}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <ProjectStatusBadge
                                                status={p.status}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Money value={p.stats.billed} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Money value={p.stats.paid} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Money
                                                value={p.stats.outstanding}
                                                strong
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Hours
                                                seconds={
                                                    p.stats.tracked_seconds
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="pr-4">
                                            <RowActions
                                                node={p}
                                                onEdit={onEdit}
                                                onAddSub={onAddSub}
                                            />
                                        </TableCell>
                                    </TableRow>
                                    {open &&
                                        children.map((c) => (
                                            <TableRow
                                                key={c.id}
                                                className="bg-muted/20"
                                            >
                                                <TableCell className="pl-4" />
                                                <TableCell className="max-w-72">
                                                    <div className="flex min-w-0 items-center gap-2 pl-1">
                                                        <CornerDownRight
                                                            className="size-3.5 shrink-0 text-muted-foreground"
                                                            aria-hidden
                                                        />
                                                        <Link
                                                            href={`/projects/${c.id}`}
                                                            className="truncate text-sm hover:underline"
                                                        >
                                                            {c.name}
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <ProjectStatusBadge
                                                        status={c.status}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    <Money
                                                        value={c.stats.billed}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    <Money
                                                        value={c.stats.paid}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    <Money
                                                        value={
                                                            c.stats.outstanding
                                                        }
                                                        strong
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    <Hours
                                                        seconds={
                                                            c.stats
                                                                .tracked_seconds
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell className="pr-4">
                                                    <RowActions
                                                        node={c}
                                                        onEdit={onEdit}
                                                        onAddSub={onAddSub}
                                                    />
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
                    const children = p.children ?? [];
                    const open = isOpen(p.id) && children.length > 0;

                    return (
                        <li key={p.id} className="flex flex-col gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link
                                        href={`/projects/${p.id}`}
                                        className="block truncate font-medium hover:underline"
                                    >
                                        {p.name}
                                    </Link>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {p.client?.name ?? '—'}
                                    </p>
                                </div>
                                <ProjectStatusBadge status={p.status} />
                            </div>

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Ditagih
                                    </dt>
                                    <dd>
                                        <Money value={p.stats.billed} />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Sisa
                                    </dt>
                                    <dd>
                                        <Money
                                            value={p.stats.outstanding}
                                            strong
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Terbayar
                                    </dt>
                                    <dd>
                                        <Money value={p.stats.paid} />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Jam tercatat
                                    </dt>
                                    <dd>
                                        <Hours
                                            seconds={p.stats.tracked_seconds}
                                        />
                                    </dd>
                                </div>
                            </dl>

                            <div className="flex items-center justify-between gap-2">
                                {children.length > 0 ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-2"
                                        onClick={() => toggle(p.id)}
                                        aria-expanded={open}
                                    >
                                        {children.length} sub-proyek
                                        <ChevronDown
                                            className={cn(
                                                'size-4 transition-transform',
                                                open && 'rotate-180',
                                            )}
                                        />
                                    </Button>
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        Tanpa sub-proyek
                                    </span>
                                )}
                                <RowActions
                                    node={p}
                                    onEdit={onEdit}
                                    onAddSub={onAddSub}
                                />
                            </div>

                            {open && (
                                <ul className="divide-y rounded-lg border bg-muted/20">
                                    {children.map((c) => (
                                        <li
                                            key={c.id}
                                            className="flex items-center justify-between gap-3 px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/projects/${c.id}`}
                                                        className="truncate text-sm font-medium hover:underline"
                                                    >
                                                        {c.name}
                                                    </Link>
                                                    {c.status !== 'active' && (
                                                        <ProjectStatusBadge
                                                            status={c.status}
                                                        />
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground tabular-nums">
                                                    Sisa{' '}
                                                    {formatIDR(
                                                        c.stats.outstanding,
                                                    )}
                                                    {c.stats.tracked_seconds >
                                                        0 &&
                                                        ` · ${formatDuration(c.stats.tracked_seconds)}`}
                                                </p>
                                            </div>
                                            <RowActions
                                                node={c}
                                                onEdit={onEdit}
                                                onAddSub={onAddSub}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
