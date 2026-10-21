import { Link, usePage } from '@inertiajs/react';
import { KanbanSquare, ListTodo, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import {
    readTaskQueryParam,
    setTaskQueryParam,
    startTaskTimer,
    useAuthCan,
} from '@/components/tasks/task-utils';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { index as tasksIndex } from '@/routes/tasks';
import type { Paginated } from '@/types/models';
import { TASK_STATUS_LABEL } from '@/types/tasks';
import type {
    Task,
    TaskProjectOption,
    TaskStatus,
    TaskSummary,
    TaskUserOption,
} from '@/types/tasks';

const SHOWN = 8;
const RELOAD_ONLY = ['taskSummary', 'sessions', 'stats'];

type Loaded = {
    tasks: Task[];
    total: number;
    projects: TaskProjectOption[];
    users: TaskUserOption[];
};

/**
 * Ringkasan & daftar task proyek di halaman detail proyek. Data daftar
 * diambil lewat partial reload Inertia dari halaman `tasks/index`
 * (view=list, difilter proyek) agar tidak menambah beban halaman proyek.
 */
export function ProjectTasksCard({
    project,
    summary,
    archived = false,
}: {
    project: { id: number; full_name: string };
    summary: TaskSummary;
    archived?: boolean;
}) {
    const { version } = usePage();
    const authCan = useAuthCan();
    const [data, setData] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [openTaskId, setOpenTaskId] = useState<number | null>(() =>
        readTaskQueryParam(),
    );
    const [form, setForm] = useState({ open: false, key: 0 });
    const latest = useRef(0);

    const load = useCallback(async () => {
        const req = ++latest.current;

        try {
            const res = await fetch(
                tasksIndex.url({
                    query: { view: 'list', project_id: project.id },
                }),
                {
                    headers: {
                        Accept: 'text/html, application/xhtml+xml',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-Inertia': 'true',
                        ...(version ? { 'X-Inertia-Version': version } : {}),
                        'X-Inertia-Partial-Component': 'tasks/index',
                        'X-Inertia-Partial-Data': 'tasks,projects,users',
                    },
                    credentials: 'same-origin',
                },
            );

            if (!res.ok) {
                throw new Error(String(res.status));
            }

            const page = (await res.json()) as {
                props: {
                    tasks: Paginated<Task>;
                    projects: TaskProjectOption[];
                    users: TaskUserOption[];
                };
            };

            if (req === latest.current) {
                setData({
                    tasks: page.props.tasks.data,
                    total: page.props.tasks.total,
                    projects: page.props.projects ?? [],
                    users: page.props.users ?? [],
                });
                setFailed(false);
            }
        } catch {
            if (req === latest.current) {
                setFailed(true);
            }
        } finally {
            if (req === latest.current) {
                setRefreshing(false);
            }
        }
    }, [project.id, version]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- setState hanya setelah fetch (async)
        void load();
    }, [load]);

    const reload = useCallback(() => {
        setRefreshing(true);
        void load();
    }, [load]);

    useEffect(() => {
        setTaskQueryParam(openTaskId);
    }, [openTaskId]);

    const projectOption = data?.projects.find((p) => p.id === project.id);
    const canCreate =
        !archived && (authCan?.createTasks ?? true) && !!projectOption;
    const boardHref = tasksIndex.url({
        query: { view: 'board', project_id: project.id },
    });
    const shown = data?.tasks.slice(0, SHOWN) ?? [];
    const more = (data?.total ?? 0) - shown.length;

    const chips: { key: TaskStatus | 'overdue'; label: string; n: number }[] = [
        { key: 'todo', label: TASK_STATUS_LABEL.todo, n: summary.todo },
        {
            key: 'in_progress',
            label: TASK_STATUS_LABEL.in_progress,
            n: summary.in_progress,
        },
        {
            key: 'review',
            label: TASK_STATUS_LABEL.review,
            n: summary.review,
        },
        { key: 'done', label: TASK_STATUS_LABEL.done, n: summary.done },
    ];

    return (
        <Card className="gap-0 pb-0">
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
                <div className="grid min-w-0 gap-1.5">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ListTodo className="size-4 text-muted-foreground" />
                        Task
                        {refreshing && data && (
                            <RefreshCw
                                className="size-3.5 animate-spin text-muted-foreground"
                                aria-label="Memuat ulang"
                            />
                        )}
                    </CardTitle>
                    <CardDescription>
                        {summary.total === 0
                            ? 'Belum ada task di proyek ini.'
                            : `${summary.open} terbuka dari ${summary.total} task`}
                        {summary.overdue > 0 && (
                            <span className="font-medium text-red-600 dark:text-red-400">
                                {' '}
                                · {summary.overdue} terlambat
                            </span>
                        )}
                    </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="hidden h-9 sm:inline-flex"
                        asChild
                    >
                        <Link href={boardHref}>
                            <KanbanSquare /> Lihat board proyek
                        </Link>
                    </Button>
                    {canCreate && (
                        <Button
                            size="sm"
                            className="h-9"
                            onClick={() =>
                                setForm((f) => ({ open: true, key: f.key + 1 }))
                            }
                        >
                            <Plus /> Task baru
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 px-0">
                {summary.total > 0 && (
                    <div className="grid grid-cols-4 gap-2 px-6">
                        {chips.map((c) => (
                            <div
                                key={c.key}
                                className="rounded-lg border bg-muted/30 px-2 py-2 text-center"
                            >
                                <p className="text-lg font-semibold tabular-nums">
                                    {c.n}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {c.label}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {!data && !failed && (
                    <div className="grid gap-2 px-6 pb-6">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                )}

                {failed && !data && (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">
                        Daftar task tidak bisa dimuat.{' '}
                        <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={reload}
                        >
                            Coba lagi
                        </button>{' '}
                        atau{' '}
                        <Link href={boardHref} className="hover:underline">
                            buka board proyek
                        </Link>
                        .
                    </p>
                )}

                {data && data.tasks.length === 0 && (
                    <EmptyState
                        icon={ListTodo}
                        title="Belum ada task"
                        description="Pecah pekerjaan proyek ini menjadi task dan tugaskan ke anggota tim."
                        className="py-8"
                    />
                )}

                {shown.length > 0 && (
                    <ul className="divide-y border-t">
                        {shown.map((t) => (
                            <li key={t.id}>
                                <TaskCard
                                    task={t}
                                    onOpen={(task) => setOpenTaskId(task.id)}
                                    onStartTimer={(task) =>
                                        startTaskTimer(task, {
                                            only: RELOAD_ONLY,
                                            onSuccess: reload,
                                        })
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                )}

                {data && (more > 0 || data.tasks.length > 0) && (
                    <div
                        className={cn(
                            'flex items-center justify-between gap-2 border-t px-6 py-3 text-sm',
                        )}
                    >
                        <span className="text-muted-foreground">
                            {more > 0
                                ? `+${more} task lainnya`
                                : 'Semua task ditampilkan'}
                        </span>
                        <Link
                            href={boardHref}
                            className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline sm:min-h-0"
                        >
                            <KanbanSquare className="size-4" /> Lihat board
                            proyek
                        </Link>
                    </div>
                )}
            </CardContent>

            {data && (
                <TaskFormDialog
                    key={form.key}
                    open={form.open}
                    onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
                    projects={data.projects}
                    users={data.users}
                    defaultProjectId={project.id}
                    lockProject
                    only={RELOAD_ONLY}
                    onSaved={reload}
                />
            )}

            <TaskDetailPanel
                taskId={openTaskId}
                onClose={() => setOpenTaskId(null)}
                projects={data?.projects ?? []}
                users={data?.users ?? []}
                only={RELOAD_ONLY}
                onChanged={reload}
            />
        </Card>
    );
}
