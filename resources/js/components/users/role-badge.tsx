import { Crown, ShieldCheck, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@/hooks/use-can';
import { cn } from '@/lib/utils';

const STYLES: Record<
    UserRole,
    { label: string; className: string; icon: typeof User }
> = {
    owner: {
        label: 'Pemilik',
        className:
            'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400',
        icon: Crown,
    },
    admin: {
        label: 'Admin',
        className:
            'border-sky-200 text-sky-700 dark:border-sky-900 dark:text-sky-400',
        icon: ShieldCheck,
    },
    staff: {
        label: 'Staf',
        className: 'text-muted-foreground',
        icon: User,
    },
};

export function RoleBadge({ role }: { role: UserRole }) {
    const style = STYLES[role] ?? STYLES.staff;
    const Icon = style.icon;

    return (
        <Badge variant="outline" className={cn('gap-1.5', style.className)}>
            <Icon className="size-3" aria-hidden />
            {style.label}
        </Badge>
    );
}

export function ActiveBadge({ active }: { active: boolean }) {
    return active ? (
        <Badge
            variant="outline"
            className="gap-1.5 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
        >
            <span
                className="size-1.5 rounded-full bg-emerald-500"
                aria-hidden
            />
            Aktif
        </Badge>
    ) : (
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden />
            Nonaktif
        </Badge>
    );
}
