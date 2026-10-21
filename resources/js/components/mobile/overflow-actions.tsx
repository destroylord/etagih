import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type OverflowAction = {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    /** Tautan Inertia. */
    href?: string;
    /** Tautan biasa (unduhan/ekspor) — bukan kunjungan Inertia. */
    external?: boolean;
    target?: string;
    destructive?: boolean;
    disabled?: boolean;
    /** Sembunyikan aksi ini. */
    hidden?: boolean;
};

/**
 * Aksi sekunder di header halaman: tampil sebagai tombol outline di ≥ sm,
 * di mobile diringkas menjadi satu tombol ⋯ (menu dropdown). Letakkan aksi
 * utama di luar komponen ini agar tetap terlihat.
 *
 *   actions={<>
 *       <OverflowActions items={[{ label: 'Edit', icon: Pencil, onClick }]} />
 *       <Button>Buat invoice</Button>
 *   </>}
 */
export function OverflowActions({
    items,
    className,
    label = 'Aksi lainnya',
}: {
    items: OverflowAction[];
    className?: string;
    label?: string;
}) {
    const visible = items.filter((a) => !a.hidden);

    if (visible.length === 0) {
        return null;
    }

    return (
        <>
            {visible.map((a) => (
                <Button
                    key={a.label}
                    variant="outline"
                    className={cn(
                        'hidden sm:inline-flex',
                        a.destructive && 'text-destructive',
                        className,
                    )}
                    disabled={a.disabled}
                    onClick={a.href ? undefined : a.onClick}
                    asChild={!!a.href && !a.disabled}
                >
                    {a.href && !a.disabled ? (
                        a.external ? (
                            <a href={a.href} target={a.target}>
                                {a.icon && <a.icon />} {a.label}
                            </a>
                        ) : (
                            <Link href={a.href}>
                                {a.icon && <a.icon />} {a.label}
                            </Link>
                        )
                    ) : (
                        <>
                            {a.icon && <a.icon />} {a.label}
                        </>
                    )}
                </Button>
            ))}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-10 sm:hidden"
                        aria-label={label}
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                    {visible.map((a) => (
                        <DropdownMenuItem
                            key={a.label}
                            disabled={a.disabled}
                            variant={a.destructive ? 'destructive' : undefined}
                            className="min-h-11"
                            onSelect={a.href ? undefined : a.onClick}
                            asChild={!!a.href}
                        >
                            {a.href ? (
                                a.external ? (
                                    <a href={a.href} target={a.target}>
                                        {a.icon && <a.icon />} {a.label}
                                    </a>
                                ) : (
                                    <Link href={a.href}>
                                        {a.icon && <a.icon />} {a.label}
                                    </Link>
                                )
                            ) : (
                                <>
                                    {a.icon && <a.icon />} {a.label}
                                </>
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
