import { ChevronDown, PartyPopper } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { TaskCard } from '@/components/tasks/task-card';
import { firstError, moveTask } from '@/components/tasks/task-utils';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { MyTaskGroups, Task, TaskStatus } from '@/types/tasks';

type GroupKey = keyof MyTaskGroups;

const SECTIONS: {
    key: GroupKey;
    label: string;
    tone?: 'danger' | 'muted';
    defaultOpen?: boolean;
}[] = [
    { key: 'overdue', label: 'Terlambat', tone: 'danger' },
    { key: 'today', label: 'Hari ini' },
    { key: 'week', label: 'Minggu ini' },
    { key: 'later', label: 'Nanti' },
    { key: 'no_date', label: 'Tanpa tenggat' },
    {
        key: 'done_recent',
        label: 'Selesai 7 hari terakhir',
        tone: 'muted',
        defaultOpen: false,
    },
];

/**
 * "Task saya": tugas terbuka milik pengguna dikelompokkan per tenggat,
 * plus yang selesai 7 hari terakhir. Centang = pindah ke "Selesai"
 * (optimistis).
 */
export function MyTasksView({
    groups,
    onOpen,
    onStartTimer,
    only,
    emptyAction,
}: {
    groups: MyTaskGroups;
    onOpen: (task: Task) => void;
    onStartTimer: (task: Task) => void;
    only: string[];
    emptyAction?: ReactNode;
}) {
    const [overrides, setOverrides] = useState<Record<number, TaskStatus>>({});
    const [prevGroups, setPrevGroups] = useState(groups);

    if (groups !== prevGroups) {
        setPrevGroups(groups);
        setOverrides({});
    }

    const toggleDone = (task: Task, done: boolean) => {
        const status: TaskStatus = done ? 'done' : 'todo';
        setOverrides((o) => ({ ...o, [task.id]: status }));
        let ok = false;
        moveTask(task, status, null, {
            only,
            onSuccess: () => {
                ok = true;

                if (done) {
                    toast.success(`"${task.title}" selesai.`);
                }
            },
            onError: (errors) => toast.error(firstError(errors)),
            onFinish: () => {
                if (!ok) {
                    setOverrides((o) => {
                        const next = { ...o };
                        delete next[task.id];

                        return next;
                    });
                }
            },
        });
    };

    const withOverride = (t: Task): Task =>
        overrides[t.id] ? { ...t, status: overrides[t.id] } : t;

    const openCount =
        groups.overdue.length +
        groups.today.length +
        groups.week.length +
        groups.later.length +
        groups.no_date.length;

    return (
        <div className="flex flex-col gap-4">
            {openCount === 0 && (
                <Card className="py-0">
                    <EmptyState
                        icon={PartyPopper}
                        title="Tidak ada task terbuka untuk Anda"
                        description="Semua beres! Task yang ditugaskan ke Anda akan muncul di sini, dikelompokkan per tenggat."
                        action={emptyAction}
                    />
                </Card>
            )}
            {SECTIONS.map((section) => {
                const tasks = groups[section.key];

                if (tasks.length === 0) {
                    return null;
                }

                return (
                    <TaskSection
                        key={section.key}
                        label={section.label}
                        count={tasks.length}
                        tone={section.tone}
                        defaultOpen={section.defaultOpen ?? true}
                    >
                        {tasks.map((t) => (
                            <li key={t.id}>
                                <TaskCard
                                    task={withOverride(t)}
                                    onOpen={onOpen}
                                    onToggleDone={toggleDone}
                                    onStartTimer={onStartTimer}
                                />
                            </li>
                        ))}
                    </TaskSection>
                );
            })}
        </div>
    );
}

function TaskSection({
    label,
    count,
    tone,
    defaultOpen,
    children,
}: {
    label: string;
    count: number;
    tone?: 'danger' | 'muted';
    defaultOpen: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Collapsible open={open} onOpenChange={setOpen} asChild>
            <Card
                className={cn(
                    'gap-0 overflow-hidden py-0',
                    tone === 'danger' &&
                        'border-l-4 border-l-red-500 dark:border-l-red-500',
                )}
            >
                <CollapsibleTrigger className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-semibold outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                    <ChevronDown
                        className={cn(
                            'size-4 text-muted-foreground transition-transform',
                            !open && '-rotate-90',
                        )}
                        aria-hidden
                    />
                    <span
                        className={cn(
                            tone === 'danger' &&
                                'text-red-600 dark:text-red-400',
                            tone === 'muted' && 'text-muted-foreground',
                        )}
                    >
                        {label}
                    </span>
                    <span
                        className={cn(
                            'rounded-full px-2 text-xs tabular-nums',
                            tone === 'danger'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : 'bg-muted text-muted-foreground',
                        )}
                    >
                        {count}
                    </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <ul className="divide-y border-t">{children}</ul>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
