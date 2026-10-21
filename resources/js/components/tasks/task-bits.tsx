import { CalendarClock } from 'lucide-react';
import {
    PRIORITY_DOT,
    STATUS_BADGE,
    initials,
    relativeDue,
} from '@/components/tasks/task-utils';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from '@/types/tasks';
import type { TaskPriority, TaskStatus, UserRef } from '@/types/tasks';

export function PriorityDot({
    priority,
    className,
}: {
    priority: TaskPriority;
    className?: string;
}) {
    const label = `Prioritas ${TASK_PRIORITY_LABEL[priority].toLowerCase()}`;

    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={cn(
                'inline-block size-2 shrink-0 rounded-full',
                PRIORITY_DOT[priority],
                className,
            )}
        />
    );
}

export function PriorityLabel({ priority }: { priority: TaskPriority }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-sm">
            <PriorityDot priority={priority} />
            {TASK_PRIORITY_LABEL[priority]}
        </span>
    );
}

export function TaskStatusBadge({
    status,
    className,
}: {
    status: TaskStatus;
    className?: string;
}) {
    return (
        <Badge className={cn(STATUS_BADGE[status], className)}>
            {TASK_STATUS_LABEL[status]}
        </Badge>
    );
}

export function AssigneeAvatar({
    user,
    className,
}: {
    user: UserRef | null;
    className?: string;
}) {
    const label = user ? user.name : 'Belum ada penanggung jawab';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    role="img"
                    aria-label={label}
                    className={cn(
                        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold select-none',
                        user
                            ? 'bg-primary/10 text-primary dark:bg-primary/20'
                            : 'border border-dashed text-muted-foreground',
                        className,
                    )}
                >
                    {user ? initials(user.name) : '?'}
                </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function DueText({
    date,
    overdue,
    done = false,
    className,
}: {
    date: string | null;
    overdue: boolean;
    done?: boolean;
    className?: string;
}) {
    const label = relativeDue(date);

    if (!label) {
        return null;
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap',
                overdue && !done
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
                className,
            )}
            title={date ?? undefined}
        >
            <CalendarClock className="size-3.5" aria-hidden />
            {label}
        </span>
    );
}
