import type { ReactNode } from 'react';
import { DataCard, DataList } from '@/components/data-list';
import { DataPagination } from '@/components/data-pagination';
import {
    AssigneeAvatar,
    DueText,
    PriorityLabel,
    PriorityDot,
    TaskStatusBadge,
} from '@/components/tasks/task-bits';
import { formatMinutes } from '@/components/tasks/task-utils';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types/models';
import type { Task } from '@/types/tasks';

function TimeCell({ task }: { task: Task }) {
    const over =
        task.estimate_minutes !== null &&
        task.logged_minutes > task.estimate_minutes;

    return (
        <span
            className={cn(
                'tabular-nums',
                over && 'text-amber-600 dark:text-amber-400',
            )}
        >
            {formatMinutes(task.logged_minutes)}
            <span className="text-muted-foreground">
                {' / '}
                {formatMinutes(task.estimate_minutes)}
            </span>
        </span>
    );
}

/** Tampilan "List": tabel di desktop, kartu di mobile, dengan paginasi. */
export function TaskListView({
    tasks,
    onOpen,
    empty,
}: {
    tasks: Paginated<Task>;
    onOpen: (task: Task) => void;
    empty: ReactNode;
}) {
    if (tasks.data.length === 0) {
        return <Card className="py-0">{empty}</Card>;
    }

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <DataList
                items={tasks.data}
                getKey={(t) => t.id}
                onRowClick={onOpen}
                rowClassName={(t) =>
                    t.is_overdue && t.status !== 'done'
                        ? 'border-l-2 border-l-red-500'
                        : undefined
                }
                columns={[
                    {
                        key: 'title',
                        header: 'Task',
                        className: 'max-w-80',
                        cell: (t) => (
                            <span
                                className={cn(
                                    'line-clamp-2 font-medium whitespace-normal',
                                    t.status === 'done' &&
                                        'text-muted-foreground line-through',
                                )}
                            >
                                {t.title}
                            </span>
                        ),
                    },
                    {
                        key: 'project',
                        header: 'Proyek',
                        className: 'max-w-56',
                        cell: (t) => (
                            <div className="min-w-0">
                                <p className="truncate">
                                    {t.project.full_name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {t.project.client.name}
                                </p>
                            </div>
                        ),
                    },
                    {
                        key: 'assignee',
                        header: 'Penanggung jawab',
                        cell: (t) => (
                            <span className="flex items-center gap-2">
                                <AssigneeAvatar user={t.assignee} />
                                <span className="truncate">
                                    {t.assignee?.name ?? (
                                        <span className="text-muted-foreground">
                                            —
                                        </span>
                                    )}
                                </span>
                            </span>
                        ),
                    },
                    {
                        key: 'status',
                        header: 'Status',
                        cell: (t) => <TaskStatusBadge status={t.status} />,
                    },
                    {
                        key: 'priority',
                        header: 'Prioritas',
                        cell: (t) => <PriorityLabel priority={t.priority} />,
                    },
                    {
                        key: 'due',
                        header: 'Tenggat',
                        cell: (t) =>
                            t.due_date ? (
                                <DueText
                                    date={t.due_date}
                                    overdue={t.is_overdue}
                                    done={t.status === 'done'}
                                    className="text-sm"
                                />
                            ) : (
                                <span className="text-muted-foreground">—</span>
                            ),
                    },
                    {
                        key: 'time',
                        header: 'Waktu',
                        className: 'text-right',
                        cell: (t) => <TimeCell task={t} />,
                    },
                ]}
                renderCard={(t) => (
                    <DataCard
                        title={
                            <span className="flex items-center gap-2">
                                <PriorityDot priority={t.priority} />
                                <span
                                    className={cn(
                                        'truncate',
                                        t.status === 'done' &&
                                            'text-muted-foreground line-through',
                                    )}
                                >
                                    {t.title}
                                </span>
                            </span>
                        }
                        subtitle={`${t.project.full_name} · ${t.project.client.name}`}
                        badge={<TaskStatusBadge status={t.status} />}
                        meta={
                            <>
                                <DueText
                                    date={t.due_date}
                                    overdue={t.is_overdue}
                                    done={t.status === 'done'}
                                />
                                <TimeCell task={t} />
                                {t.assignee && (
                                    <span className="truncate">
                                        {t.assignee.name}
                                    </span>
                                )}
                            </>
                        }
                    />
                )}
            />
            <DataPagination paginator={tasks} noun="task" />
        </Card>
    );
}
