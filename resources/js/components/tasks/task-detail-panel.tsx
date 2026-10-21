import type { Method, RequestPayload } from '@inertiajs/core';
import { Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    CircleDollarSign,
    Clock,
    FolderKanban,
    History,
    ListChecks,
    MessageSquare,
    Pencil,
    Play,
    Plus,
    Receipt,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PriorityDot, TaskStatusBadge } from '@/components/tasks/task-bits';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { selectClass } from '@/components/tasks/task-form-dialog';
import {
    firstError,
    formatMinutes,
    initials,
    relativeDue,
    relativeTime,
    startTaskTimer,
} from '@/components/tasks/task-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDateTime, formatDuration, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    destroy as destroyTask,
    show as showTask,
    update as updateTask,
} from '@/routes/tasks';
import {
    destroy as destroyChecklist,
    store as storeChecklist,
    update as updateChecklist,
} from '@/routes/tasks/checklist';
import {
    destroy as destroyComment,
    store as storeComment,
} from '@/routes/tasks/comments';
import {
    TASK_PRIORITIES,
    TASK_PRIORITY_LABEL,
    TASK_STATUSES,
    TASK_STATUS_LABEL,
} from '@/types/tasks';
import type {
    TaskDetail,
    TaskProjectOption,
    TaskSession,
    TaskShowResponse,
    TaskUserOption,
} from '@/types/tasks';

const SESSION_STATUS_LABEL: Record<TaskSession['status'], string> = {
    running: 'Berjalan',
    paused: 'Dijeda',
    completed: 'Selesai',
    billed: 'Ditagih',
    cancelled: 'Dibatalkan',
};

const ACTIVITY_LABEL: Record<string, string> = {
    created: 'Dibuat',
    completed: 'Diselesaikan',
    billed: 'Ditagihkan',
};

/**
 * Panel detail tugas: Sheet kanan (±520px) di desktop, layar penuh di
 * mobile. Memuat JSON `tasks.show`; semua penulisan lewat router Inertia
 * lalu JSON dimuat ulang.
 *
 *   <TaskDetailPanel taskId={openId} onClose={() => setOpenId(null)}
 *       projects={projects} users={users} only={['tasks', 'counts']} />
 */
export function TaskDetailPanel({
    taskId,
    onClose,
    projects,
    users,
    only,
    onChanged,
}: {
    taskId: number | null;
    onClose: () => void;
    /** Opsi untuk dialog edit (boleh kosong; dialog memakai `assignable_users`). */
    projects: TaskProjectOption[];
    users: TaskUserOption[];
    /** Props Inertia halaman yang dimuat ulang setelah tiap perubahan. */
    only?: string[];
    /** Dipanggil setelah perubahan berhasil (mis. muat ulang daftar lokal). */
    onChanged?: () => void;
}) {
    const [detail, setDetail] = useState<TaskDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editKey, setEditKey] = useState(0);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const currentId = useRef<number | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const load = useCallback(async (id: number, silent = false) => {
        currentId.current = id;

        if (!silent) {
            setLoading(true);
        }

        try {
            const res = await fetch(showTask.url(id), {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (currentId.current !== id) {
                return;
            }

            if (res.status === 404 || res.status === 403) {
                toast.error(
                    'Task tidak ditemukan atau Anda tidak punya akses.',
                );
                onCloseRef.current();

                return;
            }

            if (!res.ok) {
                throw new Error(String(res.status));
            }

            const json = (await res.json()) as TaskShowResponse;
            setDetail(json.task);
        } catch {
            if (currentId.current === id) {
                toast.error('Gagal memuat task. Coba lagi.');
            }
        } finally {
            if (currentId.current === id) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (taskId === null) {
            currentId.current = null;

            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat ganti task
        setDetail((d) => (d?.id === taskId ? d : null));
        void load(taskId);
    }, [taskId, load]);

    const refresh = useCallback(() => {
        if (currentId.current !== null) {
            void load(currentId.current, true);
        }

        onChanged?.();
    }, [load, onChanged]);

    const write = (
        method: Method,
        url: string,
        data: Record<string, unknown> = {},
        opts: { onSuccess?: () => void; onError?: () => void } = {},
    ) => {
        router.visit(url, {
            method,
            data: data as RequestPayload,
            preserveScroll: true,
            preserveState: true,
            ...(only ? { only } : {}),
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
            onSuccess: () => {
                opts.onSuccess?.();
                refresh();
            },
            onError: (errors) => {
                toast.error(firstError(errors));
                opts.onError?.();
                refresh();
            },
        });
    };

    const patchTask = (data: Record<string, unknown>) => {
        if (!detail) {
            return;
        }

        setDetail({ ...detail, ...data } as TaskDetail);
        write('put', updateTask.url(detail.id), data);
    };

    const open = taskId !== null;
    const can = detail?.can;

    return (
        <>
            <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
                <SheetContent
                    side="right"
                    className="w-full gap-0 p-0 sm:max-w-[520px] [&>button:last-child]:hidden"
                >
                    <SheetTitle className="sr-only">
                        {detail?.title ?? 'Detail task'}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Detail, checklist, komentar, dan sesi waktu task.
                    </SheetDescription>

                    {/* Header */}
                    <div className="flex items-center gap-2 border-b px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                        {detail && can?.update ? (
                            <select
                                aria-label="Status"
                                className={cn(selectClass, 'w-auto')}
                                value={detail.status}
                                disabled={busy}
                                onChange={(e) =>
                                    patchTask({ status: e.target.value })
                                }
                            >
                                {TASK_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {TASK_STATUS_LABEL[s]}
                                    </option>
                                ))}
                            </select>
                        ) : detail ? (
                            <TaskStatusBadge status={detail.status} />
                        ) : (
                            <Skeleton className="h-6 w-24" />
                        )}
                        {detail?.is_billed && (
                            <Badge variant="outline" className="gap-1">
                                <Receipt className="size-3" /> Ditagih
                            </Badge>
                        )}
                        {(busy || (loading && detail)) && (
                            <Spinner className="text-muted-foreground" />
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-auto size-11 md:size-9"
                            onClick={onClose}
                            aria-label="Tutup panel"
                        >
                            <X className="size-5" />
                        </Button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                        {!detail ? (
                            <PanelSkeleton />
                        ) : (
                            <div className="flex flex-col gap-6 p-4 sm:p-5">
                                <TitleEditor
                                    key={`${detail.id}-${detail.title}`}
                                    title={detail.title}
                                    editable={!!can?.update}
                                    done={detail.status === 'done'}
                                    onSave={(title) => patchTask({ title })}
                                />

                                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
                                    <MetaLabel icon={FolderKanban}>
                                        Proyek
                                    </MetaLabel>
                                    <dd className="min-w-0">
                                        <Link
                                            href={`/projects/${detail.project.id}`}
                                            className="block truncate hover:underline"
                                        >
                                            {detail.project.full_name}
                                        </Link>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {detail.project.client.name}
                                        </span>
                                    </dd>

                                    <MetaLabel icon={UserRound}>
                                        Penanggung jawab
                                    </MetaLabel>
                                    <dd className="min-w-0">
                                        {can?.update ? (
                                            <select
                                                aria-label="Penanggung jawab"
                                                className={selectClass}
                                                value={
                                                    detail.assignee?.id ?? ''
                                                }
                                                disabled={busy}
                                                onChange={(e) => {
                                                    const id = e.target.value
                                                        ? Number(e.target.value)
                                                        : null;
                                                    const user =
                                                        detail.assignable_users.find(
                                                            (u) => u.id === id,
                                                        ) ?? null;
                                                    setDetail({
                                                        ...detail,
                                                        assignee: user,
                                                    });
                                                    write(
                                                        'put',
                                                        updateTask.url(
                                                            detail.id,
                                                        ),
                                                        { assignee_id: id },
                                                    );
                                                }}
                                            >
                                                <option value="">
                                                    Belum ditentukan
                                                </option>
                                                {detail.assignee &&
                                                    !detail.assignable_users.some(
                                                        (u) =>
                                                            u.id ===
                                                            detail.assignee?.id,
                                                    ) && (
                                                        <option
                                                            value={
                                                                detail.assignee
                                                                    .id
                                                            }
                                                        >
                                                            {
                                                                detail.assignee
                                                                    .name
                                                            }
                                                        </option>
                                                    )}
                                                {detail.assignable_users.map(
                                                    (u) => (
                                                        <option
                                                            key={u.id}
                                                            value={u.id}
                                                        >
                                                            {u.name}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        ) : (
                                            (detail.assignee?.name ?? (
                                                <span className="text-muted-foreground">
                                                    Belum ditentukan
                                                </span>
                                            ))
                                        )}
                                    </dd>

                                    <MetaLabel icon={CheckCircle2}>
                                        Prioritas
                                    </MetaLabel>
                                    <dd className="min-w-0">
                                        {can?.update ? (
                                            <select
                                                aria-label="Prioritas"
                                                className={selectClass}
                                                value={detail.priority}
                                                disabled={busy}
                                                onChange={(e) =>
                                                    patchTask({
                                                        priority:
                                                            e.target.value,
                                                    })
                                                }
                                            >
                                                {TASK_PRIORITIES.map((p) => (
                                                    <option key={p} value={p}>
                                                        {TASK_PRIORITY_LABEL[p]}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="inline-flex items-center gap-2">
                                                <PriorityDot
                                                    priority={detail.priority}
                                                />
                                                {
                                                    TASK_PRIORITY_LABEL[
                                                        detail.priority
                                                    ]
                                                }
                                            </span>
                                        )}
                                    </dd>

                                    <MetaLabel icon={CalendarDays}>
                                        Tanggal
                                    </MetaLabel>
                                    <dd className="grid min-w-0 grid-cols-2 gap-2">
                                        <DateField
                                            label="Mulai"
                                            value={detail.start_date}
                                            editable={!!can?.update}
                                            disabled={busy}
                                            onChange={(v) =>
                                                patchTask({ start_date: v })
                                            }
                                        />
                                        <DateField
                                            label="Tenggat"
                                            value={detail.due_date}
                                            min={detail.start_date}
                                            editable={!!can?.update}
                                            disabled={busy}
                                            danger={detail.is_overdue}
                                            onChange={(v) =>
                                                patchTask({ due_date: v })
                                            }
                                        />
                                    </dd>

                                    <MetaLabel icon={Clock}>Waktu</MetaLabel>
                                    <dd className="min-w-0">
                                        <TimeProgress
                                            logged={detail.logged_minutes}
                                            estimate={detail.estimate_minutes}
                                        />
                                    </dd>

                                    <MetaLabel icon={CircleDollarSign}>
                                        Tagihan
                                    </MetaLabel>
                                    <dd className="flex min-w-0 flex-wrap items-center gap-2">
                                        {detail.billable ? (
                                            <Badge variant="secondary">
                                                Bisa ditagih
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline">
                                                Tidak ditagih
                                            </Badge>
                                        )}
                                        {detail.fixed_price !== null && (
                                            <span className="tabular-nums">
                                                Harga tetap{' '}
                                                {formatIDR(detail.fixed_price)}
                                            </span>
                                        )}
                                        {detail.invoice && (
                                            <Link
                                                href={`/invoices/${detail.invoice.id}`}
                                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <Receipt className="size-3.5" />
                                                {detail.invoice.invoice_number}
                                            </Link>
                                        )}
                                    </dd>
                                </dl>

                                <DescriptionEditor
                                    key={`${detail.id}-${detail.updated_at}`}
                                    value={detail.description}
                                    editable={!!can?.update}
                                    busy={busy}
                                    onSave={(description, done) =>
                                        write(
                                            'put',
                                            updateTask.url(detail.id),
                                            {
                                                description:
                                                    description.trim() === ''
                                                        ? null
                                                        : description,
                                            },
                                            { onSuccess: done },
                                        )
                                    }
                                />

                                <ChecklistSection
                                    detail={detail}
                                    busy={busy}
                                    setDetail={setDetail}
                                    write={write}
                                />

                                <CommentsSection
                                    detail={detail}
                                    busy={busy}
                                    write={write}
                                />

                                {detail.sessions.length > 0 && (
                                    <Section
                                        icon={Clock}
                                        title="Sesi waktu"
                                        meta={`${detail.sessions.length} terakhir`}
                                    >
                                        <ul className="divide-y rounded-md border">
                                            {detail.sessions.map((s) => (
                                                <li
                                                    key={s.id}
                                                    className="flex items-start gap-3 px-3 py-2 text-sm"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate">
                                                            {s.description ||
                                                                'Tanpa keterangan'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {s.user?.name ??
                                                                'Pengguna dihapus'}{' '}
                                                            ·{' '}
                                                            {formatDateTime(
                                                                s.started_at,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                                        <span className="font-medium tabular-nums">
                                                            {formatDuration(
                                                                s.duration_seconds,
                                                            )}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                'text-xs',
                                                                s.status ===
                                                                    'running'
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : 'text-muted-foreground',
                                                            )}
                                                        >
                                                            {
                                                                SESSION_STATUS_LABEL[
                                                                    s.status
                                                                ]
                                                            }
                                                        </span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </Section>
                                )}

                                {detail.activity.length > 0 && (
                                    <Section icon={History} title="Aktivitas">
                                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                                            {detail.activity.map((a, i) => (
                                                <li key={i}>
                                                    {ACTIVITY_LABEL[a.type] ??
                                                        a.type}
                                                    {a.user && (
                                                        <>
                                                            {' '}
                                                            oleh{' '}
                                                            <span className="text-foreground">
                                                                {a.user}
                                                            </span>
                                                        </>
                                                    )}
                                                    {a.invoice_number &&
                                                        ` di ${a.invoice_number}`}{' '}
                                                    · {formatDateTime(a.at)}
                                                </li>
                                            ))}
                                        </ul>
                                    </Section>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer aksi */}
                    {detail && (
                        <div className="flex flex-wrap items-center gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                            {can?.start_timer && detail.status !== 'done' && (
                                <Button
                                    type="button"
                                    className="h-11 flex-1 sm:h-9 sm:flex-none"
                                    disabled={
                                        busy || detail.has_running_session
                                    }
                                    onClick={() =>
                                        startTaskTimer(detail, {
                                            ...(only ? { only } : {}),
                                            onSuccess: refresh,
                                        })
                                    }
                                >
                                    {detail.has_running_session ? (
                                        <>
                                            <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                                            Timer berjalan
                                        </>
                                    ) : (
                                        <>
                                            <Play /> Mulai timer
                                        </>
                                    )}
                                </Button>
                            )}
                            {can?.update && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 flex-1 sm:h-9 sm:flex-none"
                                    onClick={() => {
                                        setEditKey((k) => k + 1);
                                        setEditOpen(true);
                                    }}
                                >
                                    <Pencil /> Edit
                                </Button>
                            )}
                            {can?.delete && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span
                                            className="flex-1 sm:ml-auto sm:flex-none"
                                            tabIndex={detail.is_billed ? 0 : -1}
                                        >
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-11 w-full text-destructive sm:h-9"
                                                disabled={
                                                    busy || detail.is_billed
                                                }
                                                onClick={() =>
                                                    setDeleteOpen(true)
                                                }
                                            >
                                                <Trash2 /> Hapus
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    {detail.is_billed && (
                                        <TooltipContent>
                                            Task sudah ditagihkan di invoice dan
                                            tidak bisa dihapus.
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {detail && (
                <TaskFormDialog
                    key={editKey}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    task={detail}
                    assignableUsers={detail.assignable_users}
                    projects={projects}
                    users={users}
                    only={only}
                    onSaved={refresh}
                />
            )}

            {detail && (
                <ConfirmDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    title="Hapus task?"
                    description={
                        <>
                            <span className="font-medium text-foreground">
                                {detail.title}
                            </span>{' '}
                            beserta checklist dan komentarnya akan dihapus.
                        </>
                    }
                    confirmLabel="Hapus"
                    destructive
                    onConfirm={(done) => {
                        router.delete(destroyTask.url(detail.id), {
                            preserveScroll: true,
                            preserveState: true,
                            ...(only ? { only } : {}),
                            onSuccess: () => {
                                onClose();
                                onChanged?.();
                            },
                            onFinish: done,
                        });
                    }}
                />
            )}
        </>
    );
}

// ---- Bagian-bagian panel ------------------------------------------------------

type WriteFn = (
    method: Method,
    url: string,
    data?: Record<string, unknown>,
    opts?: { onSuccess?: () => void; onError?: () => void },
) => void;

function PanelSkeleton() {
    return (
        <div className="flex flex-col gap-5 p-5" aria-busy>
            <Skeleton className="h-7 w-3/4" />
            <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                ))}
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
        </div>
    );
}

function MetaLabel({
    icon: Icon,
    children,
}: {
    icon: typeof Clock;
    children: ReactNode;
}) {
    return (
        <dt className="flex items-center gap-2 self-start pt-2 text-xs whitespace-nowrap text-muted-foreground">
            <Icon className="size-4" aria-hidden />
            {children}
        </dt>
    );
}

function Section({
    icon: Icon,
    title,
    meta,
    children,
}: {
    icon: typeof Clock;
    title: string;
    meta?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {title}
                {meta && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                        {meta}
                    </span>
                )}
            </h3>
            {children}
        </section>
    );
}

function TitleEditor({
    title,
    editable,
    done,
    onSave,
}: {
    title: string;
    editable: boolean;
    done: boolean;
    onSave: (title: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(title);

    const commit = () => {
        setEditing(false);
        const next = value.trim();

        if (next && next !== title) {
            onSave(next);
        } else {
            setValue(title);
        }
    };

    if (editing) {
        return (
            <Input
                autoFocus
                aria-label="Judul task"
                value={value}
                maxLength={255}
                onChange={(e) => setValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                    }

                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        setValue(title);
                        setEditing(false);
                    }
                }}
                className="h-auto py-1.5 text-lg font-semibold md:text-lg"
            />
        );
    }

    const heading = (
        <h2
            className={cn(
                'text-lg leading-snug font-semibold break-words',
                done && 'text-muted-foreground line-through',
            )}
        >
            {title}
        </h2>
    );

    if (!editable) {
        return heading;
    }

    return (
        <button
            type="button"
            className="-mx-2 rounded-md px-2 py-1 text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => setEditing(true)}
            title="Klik untuk mengubah judul"
        >
            {heading}
        </button>
    );
}

function DateField({
    label,
    value,
    min,
    editable,
    disabled,
    danger = false,
    onChange,
}: {
    label: string;
    value: string | null;
    min?: string | null;
    editable: boolean;
    disabled: boolean;
    danger?: boolean;
    onChange: (value: string | null) => void;
}) {
    if (!editable) {
        return (
            <div className="min-w-0">
                <span className="block text-xs text-muted-foreground">
                    {label}
                </span>
                <span
                    className={cn(
                        danger && 'font-medium text-red-600 dark:text-red-400',
                    )}
                >
                    {value ? (relativeDue(value) ?? value) : '—'}
                </span>
            </div>
        );
    }

    return (
        <label className="grid min-w-0 gap-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Input
                type="date"
                value={value ?? ''}
                min={min ?? undefined}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value || null)}
                className={cn(
                    'h-11 min-w-0 px-2 md:h-9',
                    danger && 'border-red-500 text-red-600 dark:text-red-400',
                )}
            />
        </label>
    );
}

function TimeProgress({
    logged,
    estimate,
}: {
    logged: number;
    estimate: number | null;
}) {
    if (!estimate) {
        return (
            <span className="tabular-nums">
                {formatMinutes(logged)} tercatat
                <span className="text-muted-foreground"> · tanpa estimasi</span>
            </span>
        );
    }

    const pct = Math.min(100, Math.round((logged / estimate) * 100));
    const over = logged > estimate;

    return (
        <div className="grid gap-1.5">
            <span className="tabular-nums">
                {formatMinutes(logged)}{' '}
                <span className="text-muted-foreground">
                    dari {formatMinutes(estimate)}
                </span>
                {over && (
                    <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        (lewat {formatMinutes(logged - estimate)})
                    </span>
                )}
            </span>
            <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Waktu tercatat terhadap estimasi"
            >
                <div
                    className={cn(
                        'h-full rounded-full',
                        over ? 'bg-amber-500' : 'bg-primary',
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function DescriptionEditor({
    value,
    editable,
    busy,
    onSave,
}: {
    value: string | null;
    editable: boolean;
    busy: boolean;
    onSave: (value: string, done: () => void) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value ?? '');

    return (
        <Section
            icon={MessageSquare}
            title="Deskripsi"
            meta={
                editable &&
                !editing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => setEditing(true)}
                    >
                        <Pencil /> {value ? 'Ubah' : 'Tambah'}
                    </Button>
                )
            }
        >
            {editing ? (
                <div className="grid gap-2">
                    <Textarea
                        autoFocus
                        rows={5}
                        value={draft}
                        aria-label="Deskripsi"
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 sm:h-8"
                            onClick={() => {
                                setDraft(value ?? '');
                                setEditing(false);
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="h-11 sm:h-8"
                            disabled={busy}
                            onClick={() =>
                                onSave(draft, () => setEditing(false))
                            }
                        >
                            Simpan
                        </Button>
                    </div>
                </div>
            ) : value ? (
                <p className="text-sm break-words whitespace-pre-line">
                    {value}
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Belum ada deskripsi.
                </p>
            )}
        </Section>
    );
}

function ChecklistSection({
    detail,
    busy,
    setDetail,
    write,
}: {
    detail: TaskDetail;
    busy: boolean;
    setDetail: (d: TaskDetail) => void;
    write: WriteFn;
}) {
    const [body, setBody] = useState('');
    const editable = detail.can.update;
    const total = detail.checklist.length;
    const done = detail.checklist.filter((i) => i.is_done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    if (!editable && total === 0) {
        return null;
    }

    const add = (e: FormEvent) => {
        e.preventDefault();
        const text = body.trim();

        if (!text) {
            return;
        }

        write(
            'post',
            storeChecklist.url(detail.id),
            { body: text },
            { onSuccess: () => setBody('') },
        );
    };

    return (
        <Section
            icon={ListChecks}
            title="Checklist"
            meta={total > 0 ? `${done}/${total}` : undefined}
        >
            {total > 0 && (
                <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progres checklist"
                >
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-[width]"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
            {total > 0 && (
                <ul className="-mx-2">
                    {detail.checklist.map((item) => (
                        <li
                            key={item.id}
                            className="group flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted/50"
                        >
                            <Checkbox
                                id={`chk-${item.id}`}
                                checked={item.is_done}
                                disabled={!editable}
                                onCheckedChange={(v) => {
                                    const is_done = v === true;
                                    setDetail({
                                        ...detail,
                                        checklist: detail.checklist.map((c) =>
                                            c.id === item.id
                                                ? { ...c, is_done }
                                                : c,
                                        ),
                                    });
                                    write('put', updateChecklist.url(item.id), {
                                        is_done,
                                    });
                                }}
                            />
                            <label
                                htmlFor={`chk-${item.id}`}
                                className={cn(
                                    'min-w-0 flex-1 cursor-pointer py-2 text-sm break-words',
                                    item.is_done &&
                                        'text-muted-foreground line-through',
                                )}
                            >
                                {item.body}
                            </label>
                            {editable && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-11 shrink-0 text-muted-foreground opacity-100 hover:text-destructive md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                    aria-label={`Hapus "${item.body}"`}
                                    disabled={busy}
                                    onClick={() =>
                                        write(
                                            'delete',
                                            destroyChecklist.url(item.id),
                                        )
                                    }
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {editable && (
                <form onSubmit={add} className="flex gap-2">
                    <Input
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Tambah butir checklist…"
                        aria-label="Butir checklist baru"
                        maxLength={255}
                        className="h-11 md:h-9"
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        className="size-11 shrink-0 md:size-9"
                        disabled={busy || !body.trim()}
                        aria-label="Tambah checklist"
                    >
                        <Plus className="size-4" />
                    </Button>
                </form>
            )}
        </Section>
    );
}

function CommentsSection({
    detail,
    busy,
    write,
}: {
    detail: TaskDetail;
    busy: boolean;
    write: WriteFn;
}) {
    const [body, setBody] = useState('');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const text = body.trim();

        if (!text) {
            return;
        }

        write(
            'post',
            storeComment.url(detail.id),
            { body: text },
            { onSuccess: () => setBody('') },
        );
    };

    return (
        <Section
            icon={MessageSquare}
            title="Komentar"
            meta={
                detail.comments.length > 0
                    ? String(detail.comments.length)
                    : undefined
            }
        >
            {detail.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Belum ada komentar.
                </p>
            )}
            <ul className="flex flex-col gap-4">
                {detail.comments.map((c) => (
                    <li key={c.id} className="group flex gap-3">
                        <span
                            aria-hidden
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                        >
                            {initials(c.user?.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                    {c.user?.name ?? 'Pengguna dihapus'}
                                </span>
                                <span
                                    className="shrink-0 text-xs text-muted-foreground"
                                    title={formatDateTime(c.created_at)}
                                >
                                    {relativeTime(c.created_at)}
                                </span>
                                {c.can_delete && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="ml-auto size-11 shrink-0 text-muted-foreground hover:text-destructive md:size-7 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                        aria-label="Hapus komentar"
                                        disabled={busy}
                                        onClick={() =>
                                            write(
                                                'delete',
                                                destroyComment.url(c.id),
                                            )
                                        }
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                )}
                            </div>
                            <p className="mt-0.5 text-sm break-words whitespace-pre-line">
                                {c.body}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
            {detail.can.comment && (
                <form onSubmit={submit} className="grid gap-2">
                    <Textarea
                        rows={2}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                submit(e);
                            }
                        }}
                        placeholder="Tulis komentar…"
                        aria-label="Komentar baru"
                        maxLength={5000}
                    />
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="sm"
                            className="h-11 sm:h-8"
                            disabled={busy || !body.trim()}
                        >
                            Kirim komentar
                        </Button>
                    </div>
                </form>
            )}
        </Section>
    );
}
