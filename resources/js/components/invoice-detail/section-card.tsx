import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Kartu samping dengan judul kecil + aksi opsional di kanan. */
export function SectionCard({
    title,
    icon: Icon,
    action,
    children,
    className,
    bodyClassName,
}: {
    title: string;
    icon?: LucideIcon;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <Card className={cn('gap-0 overflow-hidden py-0', className)}>
            <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                    {Icon && <Icon className="size-4 text-muted-foreground" />}
                    {title}
                </h2>
                {action}
            </div>
            <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
        </Card>
    );
}
