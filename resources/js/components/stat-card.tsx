import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Kartu angka ringkas (KPI). `tone` memberi aksen warna pada ikon. */
export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone = 'default',
    className,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    tone?: 'default' | 'success' | 'warning' | 'danger';
    className?: string;
}) {
    return (
        <Card className={cn('min-w-0 gap-0 p-4 sm:p-5', className)}>
            <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-xs font-medium text-muted-foreground sm:text-sm">
                    {label}
                </p>
                {Icon && (
                    <span
                        className={cn(
                            'hidden size-8 shrink-0 items-center justify-center rounded-lg min-[400px]:flex',
                            tone === 'default' &&
                                'bg-muted text-muted-foreground',
                            tone === 'success' &&
                                'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
                            tone === 'warning' &&
                                'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
                            tone === 'danger' &&
                                'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
                        )}
                    >
                        <Icon className="size-4" />
                    </span>
                )}
            </div>
            <div className="mt-1 text-base font-semibold tracking-tight break-words tabular-nums sm:mt-2 sm:text-2xl">
                {value}
            </div>
            {hint && (
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            )}
        </Card>
    );
}
