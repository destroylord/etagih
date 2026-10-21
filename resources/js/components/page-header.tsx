import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Header standar setiap halaman: judul, deskripsi, tombol kembali (opsional)
 * dan area aksi di kanan. Responsive: aksi turun ke bawah di layar kecil.
 */
export function PageHeader({
    title,
    description,
    backHref,
    actions,
    meta,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    backHref?: string;
    actions?: ReactNode;
    /** Elemen kecil di samping judul, mis. badge status. */
    meta?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
                className,
            )}
        >
            <div className="flex min-w-0 items-start gap-3">
                {backHref && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 shrink-0"
                        asChild
                    >
                        <Link href={backHref} aria-label="Kembali">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                )}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                            {title}
                        </h1>
                        {meta}
                    </div>
                    {description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    {actions}
                </div>
            )}
        </div>
    );
}

/** Pembungkus konten halaman dengan padding & lebar maksimum konsisten. */
export function PageContainer({
    children,
    className,
    size = 'default',
}: {
    children: ReactNode;
    className?: string;
    size?: 'default' | 'narrow' | 'wide';
}) {
    return (
        <div
            className={cn(
                'mx-auto flex w-full flex-col gap-6 p-4 sm:p-6',
                size === 'narrow' && 'max-w-3xl',
                size === 'default' && 'max-w-6xl',
                size === 'wide' && 'max-w-7xl',
                className,
            )}
        >
            {children}
        </div>
    );
}
