import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

/** Kartu satu kelompok pengaturan dengan judul, deskripsi & ikon. */
export function SettingsSection({
    id,
    icon: Icon,
    title,
    description,
    children,
}: {
    id: string;
    icon: LucideIcon;
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card
            id={id}
            className="scroll-mt-20 gap-0 py-0"
            aria-labelledby={`${id}-title`}
        >
            <div className="flex items-start gap-3 border-b px-5 py-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                    <h2 id={`${id}-title`} className="text-sm font-semibold">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            <div className="space-y-5 p-5">{children}</div>
        </Card>
    );
}

/** Label + kontrol + hint + error dalam satu grup. */
export function Field({
    label,
    htmlFor,
    hint,
    error,
    children,
    className,
}: {
    label: ReactNode;
    htmlFor?: string;
    hint?: ReactNode;
    error?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={className ? `grid gap-2 ${className}` : 'grid gap-2'}>
            <label
                htmlFor={htmlFor}
                className="text-sm leading-none font-medium"
            >
                {label}
            </label>
            {children}
            {error ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            ) : (
                hint && <p className="text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}
