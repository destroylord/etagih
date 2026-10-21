import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    FolderKanban,
    KanbanSquare,
    List,
    ListTodo,
    Plus,
    Search,
    UserRoundCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { MyTasksView } from '@/components/tasks/my-tasks-view';
import { TaskBoard } from '@/components/tasks/task-board';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import {
    TaskFilterControls,
    activeFilterCount,
} from '@/components/tasks/task-filters';
import type { TaskFilterPatch } from '@/components/tasks/task-filters';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { TaskListView } from '@/components/tasks/task-list-view';
import {
    readTaskQueryParam,
    setTaskQueryParam,
    startTaskTimer,
    useAuthCan,
} from '@/components/tasks/task-utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useCan } from '@/hooks/use-can';
import { useQueryFlag } from '@/hooks/use-query-flag';
import { cn } from '@/lib/utils';
import { index as tasksIndex } from '@/routes/tasks';
import type { Paginated } from '@/types/models';
import type {
    MyTaskGroups,
    Task,
    TaskBoardColumns,
    TaskFilters,
    TaskIndexProps,
    TaskStatus,
    TaskView,
} from '@/types/tasks';

/** Props yang dimuat ulang setelah setiap perubahan task. */
const RELOAD_ONLY = ['tasks', 'counts'];

const VIEWS: { value: TaskView; label: string; icon: typeof List }[] = [
    { value: 'mine', label: 'Task saya', icon: UserRoundCheck },
    { value: 'board', label: 'Board', icon: KanbanSquare },
    { value: 'list', label: 'List', icon: List },
];

function buildQuery(
    view: TaskView,
    filters: TaskFilters,
): Record<string, string> {
    const q: Record<string, string> = {};

    if (view !== 'mine') {
        q.view = view;
    }

    for (const key of [
        'project_id',
        'client_id',
        'assignee_id',
        'priority',
        'status',
        'due',
        'q',
    ] as const) {
        const value = filters[key];

        if (value !== null && value !== undefined && value !== '') {
            q[key] = String(value);
        }
    }

    return q;
}

export default function TasksIndex(props: TaskIndexProps) {
    const {
        view,
        filters,
        projects,
        users,
        statusLabels,
        priorityLabels,
        counts,
    } = props;
    const { isAdmin } = useCan();
    const authCan = useAuthCan();
    const { url } = usePage();

    const [search, setSearch] = useState(filters.q ?? '');
    const [loading, setLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const [openTaskId, setOpenTaskId] = useState<number | null>(() =>
        readTaskQueryParam(),
    );
    const [form, setForm] = useState<{
        open: boolean;
        key: number;
        status?: TaskStatus;
    }>({ open: false, key: 0 });

    const canCreate = (authCan?.createTasks ?? true) && projects.length > 0;
    const hasFilters = activeFilterCount(filters, view) > 0 || !!filters.q;

    const visit = (nextView: TaskView, nextFilters: TaskFilters) => {
        router.get(tasksIndex.url(), buildQuery(nextView, nextFilters), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

    const apply = (patch: TaskFilterPatch) =>
        visit(view, { ...filters, ...patch });

    const resetFilters = () => {
        clearTimeout(searchTimer.current);
        setSearch('');
        visit(view, {
            project_id: null,
            client_id: null,
            assignee_id: null,
            priority: null,
            status: null,
            due: null,
            q: null,
        });
    };

    useEffect(() => () => clearTimeout(searchTimer.current), []);

    const onSearchChange = (value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            if (value.trim() !== (filters.q ?? '')) {
                apply({ q: value.trim() || null });
            }
        }, 350);
    };

    // URL `?task=` mengikuti panel yang terbuka (juga setelah kunjungan Inertia).
    useEffect(() => {
        setTaskQueryParam(openTaskId);
    }, [openTaskId, url]);

    const openTask = useCallback((task: Pick<Task, 'id'>) => {
        setOpenTaskId(task.id);
    }, []);

    const closeTask = useCallback(() => setOpenTaskId(null), []);

    const openCreate = useCallback((status?: TaskStatus) => {
        setForm((f) => ({ open: true, key: f.key + 1, status }));
    }, []);

    const openCreateFromQuery = useCallback(() => openCreate(), [openCreate]);
    useQueryFlag('new', openCreateFromQuery);

    const onStartTimer = (task: Task) =>
        startTaskTimer(task, { only: RELOAD_ONLY });

    const quickAddProjectId =
        filters.project_id && projects.some((p) => p.id === filters.project_id)
            ? filters.project_id
            : null;

    const createButton = canCreate && (
        <Button onClick={() => openCreate()}>
            <Plus /> Task baru
        </Button>
    );

    const filteredEmpty = (
        <EmptyState
            icon={Search}
            title="Tidak ada task yang cocok"
            description="Coba ubah kata kunci atau filter yang dipakai."
            action={
                <Button variant="outline" onClick={resetFilters}>
                    Reset filter
                </Button>
            }
        />
    );

    const noProjects = projects.length === 0;

    let content: ReactNode;

    if (noProjects) {
        content = (
            <Card className="py-0">
                {isAdmin ? (
                    <EmptyState
                        icon={FolderKanban}
                        title="Belum ada proyek aktif"
                        description="Task selalu menempel ke proyek klien. Buat proyek dulu, lalu tambahkan task di sana."
                        action={
                            <Button asChild>
                                <Link href="/projects">
                                    <FolderKanban /> Buka Proyek
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={FolderKanban}
                        title="Belum ada proyek"
                        description="Anda belum menjadi anggota proyek mana pun. Minta admin menambahkan Anda."
                    />
                )}
            </Card>
        );
    } else if (props.view === 'mine') {
        content = (
            <MyTasksView
                groups={props.tasks as MyTaskGroups}
                onOpen={openTask}
                onStartTimer={onStartTimer}
                only={RELOAD_ONLY}
                emptyAction={
                    hasFilters ? (
                        <Button variant="outline" onClick={resetFilters}>
                            Reset filter
                        </Button>
                    ) : (
                        <Button variant="outline" asChild>
                            <Link
                                href={tasksIndex.url({
                                    query: { view: 'board' },
                                })}
                            >
                                <KanbanSquare /> Lihat board tim
                            </Link>
                        </Button>
                    )
                }
            />
        );
    } else if (props.view === 'board') {
        content = (
            <TaskBoard
                columns={props.tasks as TaskBoardColumns}
                statusLabels={statusLabels}
                onOpen={openTask}
                onStartTimer={onStartTimer}
                onCreate={openCreate}
                quickAddProjectId={quickAddProjectId}
                canCreate={canCreate}
                only={RELOAD_ONLY}
            />
        );
    } else {
        content = (
            <TaskListView
                tasks={props.tasks as Paginated<Task>}
                onOpen={openTask}
                empty={
                    hasFilters ? (
                        filteredEmpty
                    ) : (
                        <EmptyState
                            icon={ListTodo}
                            title="Belum ada task"
                            description="Pecah pekerjaan proyek menjadi task, tugaskan ke tim, lalu tagihkan saat selesai."
                            action={createButton || undefined}
                        />
                    )
                }
            />
        );
    }

    const viewCount: Record<TaskView, number> = {
        mine: counts.mine_open,
        board: counts.todo + counts.in_progress + counts.review,
        list: counts.todo + counts.in_progress + counts.review + counts.done,
    };

    return (
        <>
            <Head title="Task" />
            <PageContainer size={view === 'board' ? 'wide' : 'default'}>
                <PageHeader
                    title="Task"
                    description={
                        counts.mine_overdue > 0 ? (
                            <>
                                {counts.mine_open} task terbuka untuk Anda,{' '}
                                <span className="font-medium text-red-600 dark:text-red-400">
                                    {counts.mine_overdue} terlambat
                                </span>
                                .
                            </>
                        ) : (
                            'Rencanakan, kerjakan, dan tagihkan pekerjaan proyek bersama tim.'
                        )
                    }
                    actions={
                        createButton && (
                            <div className="flex w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                                {createButton}
                            </div>
                        )
                    }
                />

                {!noProjects && (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        {/* Pengalih tampilan */}
                        <div
                            role="tablist"
                            aria-label="Tampilan task"
                            className="grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:inline-grid"
                        >
                            {VIEWS.map((v) => {
                                const active = v.value === view;

                                return (
                                    <button
                                        key={v.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() =>
                                            !active && visit(v.value, filters)
                                        }
                                        className={cn(
                                            'flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-8',
                                            active
                                                ? 'bg-background text-foreground shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        <v.icon
                                            className="hidden size-4 sm:block"
                                            aria-hidden
                                        />
                                        {v.label}
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 text-[11px] leading-4 tabular-nums',
                                                v.value === 'mine' &&
                                                    counts.mine_overdue > 0
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                    : 'bg-muted-foreground/10',
                                            )}
                                        >
                                            {viewCount[v.value]}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex min-w-0 flex-1 gap-2 lg:items-center">
                            <div className="relative min-w-0 flex-1 lg:max-w-xs">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Cari judul task…"
                                    aria-label="Cari task"
                                    value={search}
                                    onChange={(e) =>
                                        onSearchChange(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            clearTimeout(searchTimer.current);
                                            apply({
                                                q: search.trim() || null,
                                            });
                                        }
                                    }}
                                    className="h-10 pr-9 pl-9 md:h-9"
                                />
                                {loading && (
                                    <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                                )}
                            </div>
                            <TaskFilterControls
                                view={view}
                                filters={filters}
                                projects={projects}
                                users={users}
                                priorityLabels={priorityLabels}
                                onApply={apply}
                                onReset={resetFilters}
                            />
                        </div>
                    </div>
                )}

                <div
                    className={cn(
                        'min-w-0 transition-opacity',
                        loading && 'opacity-60',
                    )}
                >
                    {content}
                </div>
            </PageContainer>

            <TaskFormDialog
                key={form.key}
                open={form.open}
                onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
                projects={projects}
                users={users}
                defaultProjectId={quickAddProjectId}
                defaultStatus={form.status}
                only={RELOAD_ONLY}
            />

            <TaskDetailPanel
                taskId={openTaskId}
                onClose={closeTask}
                projects={projects}
                users={users}
                only={RELOAD_ONLY}
            />
        </>
    );
}

TasksIndex.layout = {
    breadcrumbs: [{ title: 'Task', href: '/tasks' }],
};
