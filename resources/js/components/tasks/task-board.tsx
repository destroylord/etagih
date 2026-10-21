import type {
    Announcements,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    UniqueIdentifier,
} from '@dnd-kit/core';
import {
    closestCorners,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { TaskCard } from '@/components/tasks/task-card';
import {
    STATUS_ACCENT,
    firstError,
    moveTask,
} from '@/components/tasks/task-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { store } from '@/routes/tasks';
import { TASK_STATUSES } from '@/types/tasks';
import type { Task, TaskBoardColumns, TaskStatus } from '@/types/tasks';

const COL_PREFIX = 'col:';

function columnId(status: TaskStatus): string {
    return `${COL_PREFIX}${status}`;
}

function findStatus(
    columns: TaskBoardColumns,
    id: UniqueIdentifier,
): TaskStatus | null {
    if (typeof id === 'string' && id.startsWith(COL_PREFIX)) {
        return id.slice(COL_PREFIX.length) as TaskStatus;
    }

    return (
        TASK_STATUSES.find((s) => columns[s].some((t) => t.id === id)) ?? null
    );
}

function findTask(columns: TaskBoardColumns, id: UniqueIdentifier) {
    for (const s of TASK_STATUSES) {
        const t = columns[s].find((x) => x.id === id);

        if (t) {
            return t;
        }
    }

    return null;
}

/**
 * Papan kanban 4 kolom. Desktop: drag & drop (pointer/keyboard) antar &
 * dalam kolom. Mobile: kolom scroll-snap satu per layar + tab kolom +
 * menu "Pindah ke…" di tiap kartu (drag sentuh tetap bisa: tahan 250ms).
 * Perubahan dioptimistiskan lalu dikirim ke `tasks.move` (dibatalkan bila gagal).
 */
export function TaskBoard({
    columns: serverColumns,
    statusLabels,
    onOpen,
    onStartTimer,
    onCreate,
    quickAddProjectId,
    canCreate,
    only,
}: {
    columns: TaskBoardColumns;
    statusLabels: Record<TaskStatus, string>;
    onOpen: (task: Task) => void;
    onStartTimer: (task: Task) => void;
    /** Buka dialog lengkap untuk status ini. */
    onCreate: (status: TaskStatus) => void;
    /** Bila diisi, "+ Tambah" langsung membuat task (judul saja) di proyek ini. */
    quickAddProjectId: number | null;
    canCreate: boolean;
    only: string[];
}) {
    const [columns, setColumns] = useState(serverColumns);
    const [prevServer, setPrevServer] = useState(serverColumns);
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const [activeCol, setActiveCol] = useState(0);
    const snapshot = useRef<TaskBoardColumns | null>(null);
    const scroller = useRef<HTMLDivElement>(null);

    // Sinkronkan dengan data server setiap kali props berubah.
    if (serverColumns !== prevServer) {
        setPrevServer(serverColumns);
        setColumns(serverColumns);
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const send = (
        task: Task,
        status: TaskStatus,
        beforeId: number | null,
        revertTo: TaskBoardColumns,
    ) => {
        let ok = false;
        moveTask(task, status, beforeId, {
            only,
            onSuccess: () => {
                ok = true;
            },
            onError: (errors) => {
                toast.error(firstError(errors));
            },
            onFinish: () => {
                if (!ok) {
                    setColumns(revertTo);
                }
            },
        });
    };

    const onDragStart = ({ active }: DragStartEvent) => {
        snapshot.current = columns;
        setActiveId(active.id);
    };

    const onDragOver = ({ active, over }: DragOverEvent) => {
        if (!over) {
            return;
        }

        const from = findStatus(columns, active.id);
        const to = findStatus(columns, over.id);

        if (!from || !to || from === to) {
            return;
        }

        setColumns((prev) => {
            const source = prev[from];
            const target = prev[to];
            const index = source.findIndex((t) => t.id === active.id);

            if (index < 0) {
                return prev;
            }

            const moving = { ...source[index], status: to };
            const overIndex = target.findIndex((t) => t.id === over.id);
            const insertAt = overIndex >= 0 ? overIndex : target.length;

            return {
                ...prev,
                [from]: source.filter((t) => t.id !== active.id),
                [to]: [
                    ...target.slice(0, insertAt),
                    moving,
                    ...target.slice(insertAt),
                ],
            };
        });
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        const original = snapshot.current ?? columns;
        snapshot.current = null;
        setActiveId(null);

        const status = findStatus(columns, active.id);

        if (!over || !status) {
            setColumns(original);

            return;
        }

        let list = columns[status];
        const from = list.findIndex((t) => t.id === active.id);
        const overIndex = list.findIndex((t) => t.id === over.id);

        if (overIndex >= 0 && from !== overIndex) {
            list = arrayMove(list, from, overIndex);
        }

        const next = { ...columns, [status]: list };
        setColumns(next);

        const newIndex = list.findIndex((t) => t.id === active.id);
        const originalStatus = findStatus(original, active.id);
        const originalIndex = originalStatus
            ? original[originalStatus].findIndex((t) => t.id === active.id)
            : -1;

        if (originalStatus === status && originalIndex === newIndex) {
            return;
        }

        const task = list[newIndex];
        const beforeId = list[newIndex + 1]?.id ?? null;
        send(task, status, beforeId, original);
    };

    const onDragCancel = () => {
        if (snapshot.current) {
            setColumns(snapshot.current);
        }

        snapshot.current = null;
        setActiveId(null);
    };

    /** "Pindah ke…" (mobile & keyboard): taruh di akhir kolom tujuan. */
    const moveViaMenu = (task: Task, status: TaskStatus) => {
        const from = findStatus(columns, task.id);

        if (!from || from === status) {
            return;
        }

        const original = columns;
        setColumns({
            ...columns,
            [from]: columns[from].filter((t) => t.id !== task.id),
            [status]: [...columns[status], { ...task, status }],
        });
        send(task, status, null, original);
    };

    const jumpTo = (index: number) => {
        const el = scroller.current?.children[index] as HTMLElement | undefined;
        el?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    };

    const onScroll = () => {
        const el = scroller.current;

        if (!el || el.children.length === 0) {
            return;
        }

        const width = (el.children[0] as HTMLElement).offsetWidth || 1;
        setActiveCol(
            Math.max(
                0,
                Math.min(
                    TASK_STATUSES.length - 1,
                    Math.round(el.scrollLeft / width),
                ),
            ),
        );
    };

    const activeTask = activeId !== null ? findTask(columns, activeId) : null;

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            `Mengambil task ${findTask(columns, active.id)?.title ?? ''}.`,
        onDragOver: ({ over }) => {
            const s = over ? findStatus(columns, over.id) : null;

            return s ? `Di atas kolom ${statusLabels[s]}.` : undefined;
        },
        onDragEnd: ({ over }) => {
            const s = over ? findStatus(columns, over.id) : null;

            return s ? `Task dipindah ke ${statusLabels[s]}.` : 'Task dilepas.';
        },
        onDragCancel: () => 'Pemindahan dibatalkan.',
    };

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {/* Tab kolom (mobile) */}
            <nav
                className="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 md:hidden"
                aria-label="Kolom papan"
            >
                {TASK_STATUSES.map((s, i) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => jumpTo(i)}
                        aria-current={activeCol === i ? 'true' : undefined}
                        className={cn(
                            'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors',
                            activeCol === i
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground',
                        )}
                    >
                        <span
                            className={cn(
                                'size-2 rounded-full',
                                STATUS_ACCENT[s],
                            )}
                        />
                        {statusLabels[s]}
                        <span className="tabular-nums opacity-80">
                            {columns[s].length}
                        </span>
                    </button>
                ))}
            </nav>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
                accessibility={{
                    announcements,
                    screenReaderInstructions: {
                        draggable:
                            'Tekan spasi atau Enter untuk mengambil task, panah untuk memindah, spasi/Enter lagi untuk melepas, Escape untuk batal.',
                    },
                }}
            >
                <div
                    ref={scroller}
                    onScroll={onScroll}
                    className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-4 md:overflow-visible md:px-0"
                >
                    {TASK_STATUSES.map((s) => (
                        <BoardColumn
                            key={s}
                            status={s}
                            label={statusLabels[s]}
                            tasks={columns[s]}
                            statusLabels={statusLabels}
                            onOpen={onOpen}
                            onStartTimer={onStartTimer}
                            onMove={moveViaMenu}
                            onCreate={onCreate}
                            quickAddProjectId={quickAddProjectId}
                            canCreate={canCreate}
                            only={only}
                        />
                    ))}
                </div>
                <DragOverlay>
                    {activeTask && (
                        <TaskCard
                            task={activeTask}
                            variant="board"
                            className="rotate-1 cursor-grabbing shadow-lg"
                        />
                    )}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

function BoardColumn({
    status,
    label,
    tasks,
    statusLabels,
    onOpen,
    onStartTimer,
    onMove,
    onCreate,
    quickAddProjectId,
    canCreate,
    only,
}: {
    status: TaskStatus;
    label: string;
    tasks: Task[];
    statusLabels: Record<TaskStatus, string>;
    onOpen: (task: Task) => void;
    onStartTimer: (task: Task) => void;
    onMove: (task: Task, status: TaskStatus) => void;
    onCreate: (status: TaskStatus) => void;
    quickAddProjectId: number | null;
    canCreate: boolean;
    only: string[];
}) {
    const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    const startAdd = () => {
        if (quickAddProjectId === null) {
            onCreate(status);

            return;
        }

        setAdding(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const text = title.trim();

        if (!text || quickAddProjectId === null) {
            return;
        }

        router.post(
            store.url(),
            { project_id: quickAddProjectId, title: text, status },
            {
                preserveScroll: true,
                preserveState: true,
                only,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setTitle(''),
                onError: (errors) => toast.error(firstError(errors)),
            },
        );
    };

    return (
        <section
            aria-label={`Kolom ${label}`}
            className="flex w-[85vw] max-w-sm shrink-0 snap-center flex-col rounded-xl border bg-muted/40 md:w-auto md:max-w-none md:min-w-0"
        >
            <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span
                    className={cn(
                        'size-2.5 rounded-full',
                        STATUS_ACCENT[status],
                    )}
                    aria-hidden
                />
                <h2 className="text-sm font-semibold">{label}</h2>
                <span className="rounded-full bg-background px-2 text-xs text-muted-foreground tabular-nums">
                    {tasks.length}
                </span>
                {canCreate && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-11 md:size-7"
                        aria-label={`Tambah task di ${label}`}
                        onClick={startAdd}
                    >
                        <Plus className="size-4" />
                    </Button>
                )}
            </header>

            <SortableContext
                id={columnId(status)}
                items={tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
            >
                <div
                    ref={setNodeRef}
                    className={cn(
                        'flex min-h-24 flex-1 flex-col gap-2 rounded-lg px-2 pb-2 transition-colors',
                        isOver && 'bg-primary/5',
                    )}
                >
                    {tasks.map((task) => (
                        <SortableTaskCard
                            key={task.id}
                            task={task}
                            statusLabels={statusLabels}
                            onOpen={onOpen}
                            onStartTimer={onStartTimer}
                            onMove={onMove}
                        />
                    ))}
                    {tasks.length === 0 && !adding && (
                        <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                            Belum ada task. Seret ke sini atau tambah baru.
                        </p>
                    )}
                </div>
            </SortableContext>

            {canCreate && (
                <div className="px-2 pb-2">
                    {adding ? (
                        <form onSubmit={submit} className="grid gap-2">
                            <Input
                                autoFocus
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setAdding(false);
                                        setTitle('');
                                    }
                                }}
                                placeholder="Judul task…"
                                aria-label={`Judul task baru di ${label}`}
                                maxLength={255}
                                className="h-11 bg-background md:h-9"
                                disabled={saving}
                            />
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-11 flex-1 md:h-8"
                                    disabled={saving || !title.trim()}
                                >
                                    Tambah
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-11 md:h-8"
                                    onClick={() => {
                                        setAdding(false);
                                        setTitle('');
                                    }}
                                >
                                    Batal
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11 w-full justify-start text-muted-foreground md:h-8"
                            onClick={startAdd}
                        >
                            <Plus /> Tambah
                        </Button>
                    )}
                </div>
            )}
        </section>
    );
}

function SortableTaskCard({
    task,
    statusLabels,
    onOpen,
    onStartTimer,
    onMove,
}: {
    task: Task;
    statusLabels: Record<TaskStatus, string>;
    onOpen: (task: Task) => void;
    onStartTimer: (task: Task) => void;
    onMove: (task: Task, status: TaskStatus) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, disabled: !task.can.update });

    return (
        <div
            ref={(node) => {
                setNodeRef(node);
                // Keyboard hanya aktif bila fokus di kartu itu sendiri, bukan tombol di dalamnya.
                setActivatorNodeRef(node);
            }}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
            }}
            {...attributes}
            {...listeners}
            aria-roledescription="task yang bisa dipindah"
            className="touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <TaskCard
                task={task}
                variant="board"
                dragging={isDragging}
                statusLabels={statusLabels}
                onOpen={onOpen}
                onStartTimer={onStartTimer}
                onMove={onMove}
                moveMenuClassName="md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
            />
        </div>
    );
}
