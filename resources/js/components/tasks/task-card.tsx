import {
    ArrowRightLeft,
    Check,
    CheckSquare,
    MessageSquare,
    MoreHorizontal,
    Play,
} from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import {
    AssigneeAvatar,
    DueText,
    PriorityDot,
} from '@/components/tasks/task-bits';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TASK_STATUSES, TASK_STATUS_LABEL } from '@/types/tasks';
import type { Task, TaskStatus } from '@/types/tasks';

/** Abaikan klik dari elemen interaktif di dalam kartu. */
function fromInteractive(e: MouseEvent): boolean {
    return !!(e.target as HTMLElement).closest(
        'button,a,input,textarea,select,[role=menuitem],[data-no-card-click]',
    );
}

/**
 * Satu tugas, dua tata letak:
 * - `row`   : baris ringkas ("Task saya"), dengan tombol Selesai di kiri.
 * - `board` : kartu kanban.
 *
 * Seluruh kartu bisa diklik untuk membuka detail; judul juga tombol
 * (aksesibel lewat keyboard).
 */
export function TaskCard({
    task,
    variant = 'row',
    onOpen,
    onToggleDone,
    onStartTimer,
    onMove,
    statusLabels = TASK_STATUS_LABEL,
    moveMenuClassName,
    className,
    dragging = false,
    extra,
}: {
    task: Task;
    variant?: 'row' | 'board';
    onOpen?: (task: Task) => void;
    /** Tampilkan tombol centang Selesai (row). */
    onToggleDone?: (task: Task, done: boolean) => void;
    onStartTimer?: (task: Task) => void;
    /** Tampilkan menu "Pindah ke…". */
    onMove?: (task: Task, status: TaskStatus) => void;
    statusLabels?: Record<TaskStatus, string>;
    /** Kelas tombol menu ⋯ (mis. 'md:hidden' agar hanya di mobile). */
    moveMenuClassName?: string;
    className?: string;
    dragging?: boolean;
    extra?: ReactNode;
}) {
    const done = task.status === 'done';
    const canToggle = !!onToggleDone && task.can.update;

    const meta = (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <DueText
                date={task.due_date}
                overdue={task.is_overdue}
                done={done}
            />
            {task.checklist_total > 0 && (
                <span
                    className={cn(
                        'inline-flex items-center gap-1 tabular-nums',
                        task.checklist_done === task.checklist_total &&
                            'text-emerald-600 dark:text-emerald-400',
                    )}
                    aria-label={`Checklist ${task.checklist_done} dari ${task.checklist_total}`}
                >
                    <CheckSquare className="size-3.5" aria-hidden />
                    {task.checklist_done}/{task.checklist_total}
                </span>
            )}
            {task.comments_count > 0 && (
                <span
                    className="inline-flex items-center gap-1 tabular-nums"
                    aria-label={`${task.comments_count} komentar`}
                >
                    <MessageSquare className="size-3.5" aria-hidden />
                    {task.comments_count}
                </span>
            )}
            {extra}
        </div>
    );

    const timerButton = onStartTimer && !done && (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'size-11 shrink-0 md:size-8',
                        task.has_running_session &&
                            'text-emerald-600 dark:text-emerald-400',
                    )}
                    aria-label={
                        task.has_running_session
                            ? 'Stopwatch sedang berjalan'
                            : 'Mulai timer'
                    }
                    onClick={() => onStartTimer(task)}
                >
                    {task.has_running_session ? (
                        <span className="relative flex size-2.5">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                        </span>
                    ) : (
                        <Play className="size-4" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {task.has_running_session
                    ? 'Stopwatch sedang berjalan'
                    : 'Mulai timer'}
            </TooltipContent>
        </Tooltip>
    );

    const moveMenu = onMove && task.can.update && (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'size-11 shrink-0 md:size-8',
                        moveMenuClassName,
                    )}
                    aria-label="Pindah ke…"
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowRightLeft className="size-3.5" /> Pindah ke…
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TASK_STATUSES.map((s) => (
                    <DropdownMenuItem
                        key={s}
                        className="min-h-11 md:min-h-8"
                        disabled={s === task.status}
                        onSelect={() => onMove(task, s)}
                    >
                        {statusLabels[s]}
                        {s === task.status && (
                            <Check className="ml-auto size-4" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const titleButton = (
        <button
            type="button"
            onClick={() => onOpen?.(task)}
            className={cn(
                'min-w-0 text-left text-sm leading-snug font-medium break-words outline-none hover:underline focus-visible:underline',
                done && 'text-muted-foreground line-through',
            )}
        >
            {task.title}
        </button>
    );

    if (variant === 'board') {
        return (
            <div
                onClick={(e) => !fromInteractive(e) && onOpen?.(task)}
                className={cn(
                    'group flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-shadow hover:shadow-md',
                    task.is_overdue && !done && 'border-l-4 border-l-red-500',
                    dragging && 'opacity-40',
                    className,
                )}
            >
                <div className="flex items-start gap-2">
                    <PriorityDot priority={task.priority} className="mt-1.5" />
                    <div className="min-w-0 flex-1">{titleButton}</div>
                    {moveMenu}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                    {task.project.full_name}
                </p>
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">{meta}</div>
                    {timerButton}
                    <AssigneeAvatar user={task.assignee} />
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={(e) => !fromInteractive(e) && onOpen?.(task)}
            className={cn(
                'flex min-h-14 cursor-pointer items-center gap-1 px-2 py-1.5 transition-colors hover:bg-muted/50 sm:gap-2 sm:px-3',
                className,
            )}
        >
            {onToggleDone && (
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={
                        done
                            ? `Tandai "${task.title}" belum selesai`
                            : `Tandai "${task.title}" selesai`
                    }
                    disabled={!canToggle}
                    onClick={() => onToggleDone(task, !done)}
                    className="group/check flex size-11 shrink-0 items-center justify-center rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50 md:size-9"
                >
                    <span
                        className={cn(
                            'flex size-5 items-center justify-center rounded-full border-2 transition-colors group-focus-visible/check:ring-2 group-focus-visible/check:ring-ring',
                            done
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-muted-foreground/40 group-hover/check:border-emerald-500 group-hover/check:text-emerald-500',
                        )}
                    >
                        <Check
                            className={cn(
                                'size-3',
                                !done &&
                                    'opacity-0 group-hover/check:opacity-100',
                            )}
                            strokeWidth={3}
                        />
                    </span>
                </button>
            )}
            <div className="min-w-0 flex-1 py-1">
                <div className="flex items-start gap-2">
                    <PriorityDot priority={task.priority} className="mt-1.5" />
                    {titleButton}
                </div>
                <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">
                    {task.project.full_name} · {task.project.client.name}
                </p>
                <div className="mt-1 pl-4">{meta}</div>
            </div>
            <AssigneeAvatar
                user={task.assignee}
                className="hidden sm:inline-flex"
            />
            {timerButton}
            {moveMenu}
        </div>
    );
}
