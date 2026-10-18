import { toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PROJECT_STATUS_LABEL } from '@/types/models';
import type { Invoice, Project, ProjectStatus } from '@/types/models';

const STATUS_STYLE: Record<ProjectStatus, { badge: string; dot: string }> = {
    active: {
        badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
        dot: 'bg-emerald-500',
    },
    completed: {
        badge: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900',
        dot: 'bg-blue-500',
    },
    archived: {
        badge: 'bg-muted text-muted-foreground ring-border',
        dot: 'bg-muted-foreground/60',
    },
};

/** Badge status proyek (Aktif / Selesai / Diarsipkan). */
export function ProjectStatusBadge({
    status,
    className,
}: {
    status: ProjectStatus;
    className?: string;
}) {
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.active;

    return (
        <span
            className={cn(
                'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                style.badge,
                className,
            )}
        >
            <span
                className={cn('size-1.5 rounded-full', style.dot)}
                aria-hidden
            />
            {PROJECT_STATUS_LABEL[status] ?? status}
        </span>
    );
}

/** "Toko Online › Aplikasi Mobile" dari relasi project.parent. */
export function projectPath(
    project: Pick<Project, 'name' | 'full_name' | 'parent'> | null | undefined,
): string | null {
    if (!project) {
        return null;
    }

    if (project.full_name) {
        return project.full_name;
    }

    return project.parent
        ? `${project.parent.name} › ${project.name}`
        : project.name;
}

/** Sisa tagihan invoice (0 bila dibatalkan). */
export function invoiceRemaining(inv: Invoice): number {
    return inv.status === 'cancelled'
        ? 0
        : Math.max(0, toNumber(inv.total) - toNumber(inv.paid_amount));
}

/** Persentase aman (0–100). */
export function percentOf(part: number, whole: number): number {
    if (whole <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, (part / whole) * 100));
}

/** Bar porsi satu seri (warna primer di atas track netral). */
export function ShareBar({
    value,
    label,
    className,
}: {
    /** 0–100 */
    value: number;
    label: string;
    className?: string;
}) {
    const rounded = Math.round(value);

    return (
        <div
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rounded}
            title={`${label}: ${rounded}%`}
            className={cn(
                'h-1.5 w-full overflow-hidden rounded-full bg-muted',
                className,
            )}
        >
            <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${value > 0 ? Math.max(value, 2) : 0}%` }}
            />
        </div>
    );
}
