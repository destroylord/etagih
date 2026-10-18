import { Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    CornerDownRight,
    FolderKanban,
    FolderPlus,
    MoreHorizontal,
    Pencil,
    Plus,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDuration, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PROJECT_STATUS_LABEL } from '@/types/models';
import type { ProjectNode, ProjectStatus } from '@/types/models';

const STATUS_CLASS: Record<ProjectStatus, string> = {
    active: 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400',
    completed:
        'border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-400',
    archived: 'text-muted-foreground',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
    return (
        <Badge variant="outline" className={STATUS_CLASS[status]}>
            {PROJECT_STATUS_LABEL[status]}
        </Badge>
    );
}

type DialogState =
    | { mode: 'create'; parentId: number | null }
    | { mode: 'edit'; project: ProjectNode };

/** Ringkasan angka satu proyek (ditagih · sisa · jam). */
function StatsLine({ node }: { node: ProjectNode }) {
    const s = node.stats;

    return (
        <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
            <div className="flex gap-1">
                <dt>Ditagih</dt>
                <dd className="font-medium text-foreground">
                    {formatIDR(s.billed)}
                </dd>
            </div>
            <div className="flex gap-1">
                <dt>Sisa</dt>
                <dd
                    className={cn(
                        s.outstanding > 0
                            ? 'font-medium text-amber-700 dark:text-amber-400'
                            : '',
                    )}
                >
                    {formatIDR(s.outstanding)}
                </dd>
            </div>
            <div className="flex gap-1">
                <dt>Jam</dt>
                <dd>{formatDuration(s.tracked_seconds)}</dd>
            </div>
        </dl>
    );
}

function RowActions({
    node,
    onEdit,
    onAddChild,
}: {
    node: ProjectNode;
    onEdit: () => void;
    onAddChild?: () => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={`Aksi untuk ${node.name}`}
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={`/projects/${node.id}`}>
                        <ArrowUpRight /> Buka
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onEdit}>
                    <Pencil /> Edit
                </DropdownMenuItem>
                {onAddChild && (
                    <DropdownMenuItem onSelect={onAddChild}>
                        <FolderPlus /> Tambah sub-proyek
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Daftar proyek klien dalam bentuk pohon: Proyek → Sub-proyek.
 * Angka proyek utama sudah termasuk sub-proyeknya.
 */
export function ClientProjects({
    clientId,
    clientName,
    projects,
}: {
    clientId: number;
    clientName: string;
    projects: ProjectNode[];
}) {
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [open, setOpen] = useState(false);
    const [dialogKey, setDialogKey] = useState(0);

    const show = (state: DialogState) => {
        setDialog(state);
        setDialogKey((k) => k + 1);
        setOpen(true);
    };

    const parentOptions = projects.map((p) => ({
        id: p.id,
        name: p.name,
        client_id: p.client_id,
    }));
    const subCount = projects.reduce(
        (n, p) => n + (p.children?.length ?? 0),
        0,
    );

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-base">
                    <FolderKanban className="size-4 text-muted-foreground" />{' '}
                    Proyek
                    {projects.length > 0 && (
                        <Badge variant="secondary" className="tabular-nums">
                            {projects.length}
                            {subCount > 0 ? ` · ${subCount} sub` : ''}
                        </Badge>
                    )}
                </CardTitle>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => show({ mode: 'create', parentId: null })}
                >
                    <Plus /> Tambah proyek
                </Button>
            </CardHeader>

            {projects.length === 0 ? (
                <EmptyState
                    icon={FolderKanban}
                    title="Belum ada proyek"
                    description={
                        <>
                            Kelompokkan invoice & jam kerja {clientName} per
                            proyek, lalu pecah jadi sub-proyek bila perlu — mis.{' '}
                            <span className="font-medium text-foreground">
                                Gym → Allstar, Buildy
                            </span>
                            .
                        </>
                    }
                    action={
                        <Button
                            onClick={() =>
                                show({ mode: 'create', parentId: null })
                            }
                        >
                            <Plus /> Tambah proyek
                        </Button>
                    }
                />
            ) : (
                <ul className="divide-y">
                    {projects.map((p) => (
                        <li key={p.id} className="px-4 py-3 sm:px-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/projects/${p.id}`}
                                            className="font-medium break-words hover:underline"
                                        >
                                            {p.name}
                                        </Link>
                                        <ProjectStatusBadge status={p.status} />
                                    </div>
                                    <StatsLine node={p} />
                                </div>
                                <RowActions
                                    node={p}
                                    onEdit={() =>
                                        show({ mode: 'edit', project: p })
                                    }
                                    onAddChild={() =>
                                        show({
                                            mode: 'create',
                                            parentId: p.id,
                                        })
                                    }
                                />
                            </div>

                            {(p.children?.length ?? 0) > 0 && (
                                <ul
                                    className="mt-3 space-y-2 border-l pl-3 sm:ml-1 sm:pl-4"
                                    aria-label={`Sub-proyek ${p.name}`}
                                >
                                    {p.children?.map((c) => (
                                        <li
                                            key={c.id}
                                            className="flex items-start justify-between gap-3"
                                        >
                                            <div className="flex min-w-0 gap-2">
                                                <CornerDownRight
                                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                                    aria-hidden
                                                />
                                                <div className="min-w-0 space-y-0.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link
                                                            href={`/projects/${c.id}`}
                                                            className="text-sm font-medium break-words hover:underline"
                                                        >
                                                            {c.name}
                                                        </Link>
                                                        {c.status !==
                                                            'active' && (
                                                            <ProjectStatusBadge
                                                                status={
                                                                    c.status
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                    <StatsLine node={c} />
                                                </div>
                                            </div>
                                            <RowActions
                                                node={c}
                                                onEdit={() =>
                                                    show({
                                                        mode: 'edit',
                                                        project: c,
                                                    })
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {dialog && (
                <ProjectFormDialog
                    key={dialogKey}
                    open={open}
                    onOpenChange={setOpen}
                    clientId={clientId}
                    project={dialog.mode === 'edit' ? dialog.project : null}
                    parentId={dialog.mode === 'create' ? dialog.parentId : null}
                    parentOptions={parentOptions}
                />
            )}
        </Card>
    );
}
