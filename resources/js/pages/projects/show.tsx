import { Head, Link, router } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    ChevronRight,
    FileDown,
    FilePlus2,
    FolderPlus,
    MoreHorizontal,
    Pencil,
    Play,
    Receipt,
    StickyNote,
    Timer,
    Trash2,
    Wallet,
    Clock,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageContainer, PageHeader } from '@/components/page-header';
import { ProjectStatusBadge } from '@/components/projects/pages/project-helpers';
import { ProjectInvoicesCard } from '@/components/projects/pages/project-invoices-card';
import { ProjectSessionsCard } from '@/components/projects/pages/project-sessions-card';
import { SiblingNavCard } from '@/components/projects/pages/sibling-nav-card';
import { SubProjectsCard } from '@/components/projects/pages/sub-projects-card';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { StatCard } from '@/components/stat-card';
import { ProjectMembersCard } from '@/components/tasks/project-members-card';
import { ProjectTasksCard } from '@/components/tasks/project-tasks-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCan } from '@/hooks/use-can';
import {
    formatDuration,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import type {
    Invoice,
    Paginated,
    Project,
    ProjectNode,
    ProjectStats,
    ProjectStatus,
    WorkSession,
} from '@/types/models';
import type { ProjectMember, TaskSummary } from '@/types/tasks';

type ShowProject = Project & {
    full_name: string;
    description: string | null;
    client: { id: number; name: string };
    parent: { id: number; name: string } | null;
};

type Props = {
    project: ShowProject;
    tree: ProjectNode;
    stats: ProjectStats;
    invoices: Paginated<Invoice>;
    sessions: WorkSession[];
    members: ProjectMember[];
    assignableUsers: ProjectMember[];
    canManageMembers: boolean;
    taskSummary: TaskSummary;
};

type FormState = { mode: 'edit' } | { mode: 'sub' };

export default function ProjectsShow({
    project,
    tree,
    stats,
    invoices,
    sessions,
    members = [],
    assignableUsers = [],
    canManageMembers = false,
    taskSummary,
}: Props) {
    const isSub = project.parent_id !== null;
    // Staf: hanya sub-proyek yang boleh diubah; hapus & export khusus admin.
    const { manageProjects, isAdmin, createSubProjects } = useCan();
    const canEdit = isSub || manageProjects;
    const [formOpen, setFormOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [formState, setFormState] = useState<FormState>({ mode: 'edit' });
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [statusBusy, setStatusBusy] = useState(false);

    const openForm = (state: FormState) => {
        setFormState(state);
        setFormKey((k) => k + 1);
        setFormOpen(true);
    };

    const setStatus = (status: ProjectStatus) => {
        router.put(
            `/projects/${project.id}`,
            {
                name: project.name,
                parent_id: project.parent_id ?? '',
                description: project.description ?? '',
                status,
                hourly_rate:
                    project.hourly_rate !== null
                        ? String(toNumber(project.hourly_rate))
                        : '',
            },
            {
                preserveScroll: true,
                onStart: () => setStatusBusy(true),
                onFinish: () => setStatusBusy(false),
            },
        );
    };

    const query = `client_id=${project.client_id}&project_id=${project.id}`;
    const createInvoiceHref = `/invoices/create?${query}`;
    const timerHref = `/time-tracker?${query}`;
    const exportHref = `/invoices/export?project_id=${project.id}`;
    const archived = project.status === 'archived';
    const childCount = tree.children?.length ?? 0;

    const unbilled = stats.unbilled_seconds;

    const trail = (
        // PageHeader membungkus deskripsi dalam <p>, jadi pakai elemen inline.
        <span className="inline-flex flex-wrap items-center gap-1">
            <span className="sr-only">Lokasi: </span>
            <Link
                href={`/clients/${project.client.id}`}
                className="hover:text-foreground hover:underline"
            >
                {project.client.name}
            </Link>
            {project.parent && (
                <>
                    <ChevronRight className="size-3.5" aria-hidden />
                    <Link
                        href={`/projects/${project.parent.id}`}
                        className="hover:text-foreground hover:underline"
                    >
                        {project.parent.name}
                    </Link>
                </>
            )}
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page" className="text-foreground">
                {project.name}
            </span>
        </span>
    );

    return (
        <>
            <Head title={`Proyek · ${project.full_name}`} />
            <PageContainer>
                <PageHeader
                    title={project.name}
                    description={trail}
                    backHref={
                        project.parent
                            ? `/projects/${project.parent.id}`
                            : '/projects'
                    }
                    meta={
                        <>
                            <ProjectStatusBadge status={project.status} />
                            {isSub && (
                                <Badge variant="outline">Sub-proyek</Badge>
                            )}
                        </>
                    }
                    actions={
                        <>
                            {/* Mobile: aksi sekunder dipindah ke menu ⋯. */}
                            {canEdit && (
                                <Button
                                    variant="outline"
                                    className="hidden sm:inline-flex"
                                    onClick={() => openForm({ mode: 'edit' })}
                                >
                                    <Pencil /> Edit
                                </Button>
                            )}
                            {!isSub && createSubProjects && (
                                <Button
                                    variant="outline"
                                    className="hidden sm:inline-flex"
                                    onClick={() => openForm({ mode: 'sub' })}
                                >
                                    <FolderPlus /> Tambah sub-proyek
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="hidden sm:inline-flex"
                                asChild
                            >
                                <Link href={timerHref}>
                                    <Play /> Mulai timer
                                </Link>
                            </Button>
                            <Button asChild className="flex-1 sm:flex-none">
                                <Link href={createInvoiceHref}>
                                    <FilePlus2 /> Buat invoice
                                </Link>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 shrink-0"
                                        aria-label="Aksi lainnya"
                                        disabled={statusBusy}
                                    >
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-52"
                                >
                                    {canEdit && (
                                        <DropdownMenuItem
                                            className="sm:hidden"
                                            onSelect={() =>
                                                openForm({ mode: 'edit' })
                                            }
                                        >
                                            <Pencil /> Edit
                                        </DropdownMenuItem>
                                    )}
                                    {!isSub && createSubProjects && (
                                        <DropdownMenuItem
                                            className="sm:hidden"
                                            onSelect={() =>
                                                openForm({ mode: 'sub' })
                                            }
                                        >
                                            <FolderPlus /> Tambah sub-proyek
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        className="sm:hidden"
                                        asChild
                                    >
                                        <Link href={timerHref}>
                                            <Play /> Mulai timer
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="sm:hidden" />
                                    {isAdmin && (
                                        <DropdownMenuItem asChild>
                                            <a href={exportHref}>
                                                <FileDown /> Export Excel
                                            </a>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href={`/invoices?project_id=${project.id}`}
                                        >
                                            <Receipt /> Lihat semua invoice
                                        </Link>
                                    </DropdownMenuItem>
                                    {canEdit && <DropdownMenuSeparator />}
                                    {!canEdit ? null : archived ? (
                                        <DropdownMenuItem
                                            onSelect={() => setStatus('active')}
                                        >
                                            <ArchiveRestore /> Aktifkan kembali
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                setStatus('archived')
                                            }
                                        >
                                            <Archive /> Arsipkan
                                        </DropdownMenuItem>
                                    )}
                                    {manageProjects && (
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onSelect={() => setDeleteOpen(true)}
                                        >
                                            <Trash2 /> Hapus
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <StatCard
                        label="Ditagih"
                        value={formatIDR(stats.billed)}
                        icon={Receipt}
                        hint={
                            isSub && stats.work_value > 0
                                ? `Nilai pekerjaan ${formatIDR(stats.work_value)}`
                                : `${formatNumber(stats.invoice_count)} invoice${!isSub && childCount > 0 ? ', termasuk sub-proyek' : ''}`
                        }
                    />
                    <StatCard
                        label="Terbayar"
                        value={formatIDR(stats.paid)}
                        icon={Wallet}
                        tone="success"
                    />
                    <StatCard
                        label="Sisa"
                        value={formatIDR(stats.outstanding)}
                        icon={Timer}
                        tone={stats.outstanding > 0 ? 'warning' : 'default'}
                        hint={
                            stats.outstanding > 0
                                ? 'Belum dibayar klien'
                                : stats.billed > 0
                                  ? 'Semua tagihan lunas'
                                  : undefined
                        }
                    />
                    <StatCard
                        label="Jam tercatat"
                        value={formatDuration(stats.tracked_seconds)}
                        icon={Clock}
                        hint={
                            unbilled > 0
                                ? `${formatDuration(unbilled)} belum ditagih`
                                : stats.tracked_seconds > 0
                                  ? 'Semua jam sudah ditagih'
                                  : 'Belum ada sesi kerja'
                        }
                    />
                </div>
                {isSub && (
                    <p className="-mt-2 text-xs text-muted-foreground">
                        Ditagih/terbayar dihitung dari invoice yang ditautkan
                        langsung ke sub-proyek ini. Item di invoice{' '}
                        {project.parent?.name} yang ditandai untuk{' '}
                        {project.name} masuk ke nilai pekerjaan.
                    </p>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <ProjectTasksCard
                            project={project}
                            summary={taskSummary}
                            archived={project.status === 'archived'}
                        />
                        {!isSub && (
                            <SubProjectsCard
                                tree={tree}
                                onAddSub={() => openForm({ mode: 'sub' })}
                            />
                        )}
                        <ProjectInvoicesCard
                            invoices={invoices}
                            projectId={project.id}
                            createHref={createInvoiceHref}
                        />
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        {project.description && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <StickyNote className="size-4 text-muted-foreground" />{' '}
                                        Catatan
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm break-words whitespace-pre-line">
                                        {project.description}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {isSub && (
                            <SiblingNavCard
                                tree={tree}
                                currentId={project.id}
                            />
                        )}
                        <Card>
                            <CardContent>
                                <dl className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            Klien
                                        </dt>
                                        <dd className="truncate">
                                            <Link
                                                href={`/clients/${project.client.id}`}
                                                className="hover:underline"
                                            >
                                                {project.client.name}
                                            </Link>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            Tarif per jam
                                        </dt>
                                        <dd className="tabular-nums">
                                            {project.hourly_rate !== null ? (
                                                formatIDR(project.hourly_rate)
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {isSub
                                                        ? 'Ikut proyek / klien'
                                                        : 'Ikut tarif klien'}
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>
                        <ProjectMembersCard
                            projectId={project.id}
                            members={members}
                            assignableUsers={assignableUsers}
                            canManage={canManageMembers}
                            parent={project.parent}
                        />
                        <ProjectSessionsCard
                            sessions={sessions}
                            timerHref={timerHref}
                        />
                    </div>
                </div>
            </PageContainer>

            <ProjectFormDialog
                key={formKey}
                open={formOpen}
                onOpenChange={setFormOpen}
                project={formState.mode === 'edit' ? project : null}
                clientId={formState.mode === 'sub' ? project.client_id : null}
                parentId={formState.mode === 'sub' ? project.id : null}
            />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={isSub ? 'Hapus sub-proyek?' : 'Hapus proyek?'}
                description={
                    <>
                        <span className="font-medium text-foreground">
                            {project.full_name}
                        </span>{' '}
                        akan dihapus permanen
                        {!isSub && childCount > 0
                            ? ` beserta ${childCount} sub-proyeknya`
                            : ''}
                        . Proyek yang sudah dipakai invoice atau Time Tracker
                        tidak bisa dihapus — arsipkan saja agar riwayatnya tetap
                        tersimpan.
                    </>
                }
                confirmLabel="Hapus"
                destructive
                onConfirm={(done) => {
                    router.delete(`/projects/${project.id}`, {
                        preserveScroll: true,
                        onFinish: done,
                    });
                }}
            />
        </>
    );
}

ProjectsShow.layout = {
    breadcrumbs: [
        { title: 'Proyek', href: '/projects' },
        { title: 'Detail proyek', href: '#' },
    ],
};
