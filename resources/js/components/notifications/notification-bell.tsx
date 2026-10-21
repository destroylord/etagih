import { router, usePage } from '@inertiajs/react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { getJson, postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    index as notificationsIndex,
    read as notificationsRead,
    readAll as notificationsReadAll,
} from '@/routes/notifications';
import type { AppNotification, NotificationsResponse } from '@/types/tasks';

const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

/** "5 menit yang lalu", "kemarin", … */
export function relativeTime(iso: string | null): string {
    if (!iso) {
        return '';
    }

    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);

    if (abs < 45) {
        return 'baru saja';
    }

    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['minute', 60],
        ['hour', 3600],
        ['day', 86_400],
        ['week', 604_800],
        ['month', 2_629_800],
        ['year', 31_557_600],
    ];
    let unit: Intl.RelativeTimeFormatUnit = 'minute';
    let size = 60;

    for (const [u, s] of units) {
        if (abs >= s) {
            unit = u;
            size = s;
        }
    }

    return rtf.format(Math.round(diff / size), unit);
}

/** Daftar notifikasi (dipakai di dropdown desktop & sheet mobile). */
function NotificationList({
    items,
    loading,
    error,
    unread,
    onOpenItem,
    onReadAll,
    markingAll,
    asMenu = false,
}: {
    items: AppNotification[] | null;
    loading: boolean;
    error: string | null;
    unread: number;
    onOpenItem: (n: AppNotification) => void;
    onReadAll: () => void;
    markingAll: boolean;
    /** Dirender di DropdownMenu (desktop): baris jadi menu item agar bisa dinavigasi keyboard. */
    asMenu?: boolean;
}) {
    const rowClass =
        'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none';
    const renderRow = (
        n: AppNotification,
        className: string | undefined,
        children: ReactNode,
    ) =>
        asMenu ? (
            <DropdownMenuItem
                onSelect={() => onOpenItem(n)}
                className={cn(
                    rowClass,
                    'cursor-pointer rounded-none',
                    className,
                )}
            >
                {children}
            </DropdownMenuItem>
        ) : (
            <button
                type="button"
                onClick={() => onOpenItem(n)}
                className={cn(rowClass, className)}
            >
                {children}
            </button>
        );

    return (
        <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <span className="text-xs text-muted-foreground">
                    {unread > 0
                        ? `${unread} belum dibaca`
                        : 'Semua sudah dibaca'}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={unread === 0 || markingAll}
                    onClick={onReadAll}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    {markingAll ? (
                        <Spinner className="size-3.5" />
                    ) : (
                        <CheckCheck className="size-3.5" />
                    )}
                    Tandai semua dibaca
                </Button>
            </div>

            {loading && items === null ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Spinner /> Memuat…
                </div>
            ) : error ? (
                <p className="px-4 py-8 text-center text-sm text-destructive">
                    {error}
                </p>
            ) : !items || items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                    <BellOff className="size-6" />
                    Belum ada notifikasi
                </div>
            ) : (
                <ul className="max-h-[60vh] divide-y overflow-y-auto md:max-h-96">
                    {items.map((n) => {
                        const isUnread = n.read_at === null;

                        return (
                            <li key={n.id}>
                                {renderRow(
                                    n,
                                    cn(isUnread && 'bg-primary/5'),
                                    <>
                                        <span
                                            className={cn(
                                                'mt-1.5 size-2 shrink-0 rounded-full',
                                                isUnread
                                                    ? 'bg-primary'
                                                    : 'bg-transparent',
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 space-y-0.5">
                                            <span
                                                className={cn(
                                                    'block text-sm leading-snug',
                                                    isUnread
                                                        ? 'font-semibold'
                                                        : 'font-medium',
                                                )}
                                            >
                                                {n.title}
                                                {isUnread && (
                                                    <span className="sr-only">
                                                        {' '}
                                                        (belum dibaca)
                                                    </span>
                                                )}
                                            </span>
                                            {n.body && (
                                                <span className="line-clamp-2 block text-xs text-muted-foreground">
                                                    {n.body}
                                                </span>
                                            )}
                                            <span className="block text-[11px] text-muted-foreground">
                                                {relativeTime(n.created_at)}
                                            </span>
                                        </span>
                                    </>,
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Lonceng notifikasi di header. Jumlah belum dibaca dari shared prop
 * `auth.unreadNotifications` (diperbarui tiap navigasi Inertia — tanpa
 * polling). Daftar diambil dari `notifications.index` saat dibuka.
 */
export function NotificationBell({ className }: { className?: string }) {
    const { auth } = usePage().props;
    const shared = auth?.unreadNotifications ?? 0;
    const isMobile = useIsMobile();

    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<AppNotification[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    /**
     * Jumlah lokal setelah fetch/tandai dibaca. Hanya berlaku selama shared
     * prop belum berubah (navigasi berikutnya membawa angka baru dari server).
     */
    const [local, setLocal] = useState<{ base: number; value: number } | null>(
        null,
    );
    const abortRef = useRef<AbortController | null>(null);

    const unread = local && local.base === shared ? local.value : shared;
    const setLocalUnread = (value: number) => setLocal({ base: shared, value });

    const load = () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        getJson<NotificationsResponse>(
            notificationsIndex.url(),
            controller.signal,
        )
            .then((res) => {
                setItems(res.notifications);
                setLocalUnread(res.unread_count);
            })
            .catch((e: Error) => {
                if (e.name !== 'AbortError') {
                    setError('Gagal memuat notifikasi.');
                }
            })
            .finally(() => setLoading(false));
    };

    const onOpenChange = (next: boolean) => {
        setOpen(next);

        if (next) {
            load();
        } else {
            abortRef.current?.abort();
        }
    };

    const openItem = async (n: AppNotification) => {
        setOpen(false);

        if (n.read_at === null) {
            setItems(
                (prev) =>
                    prev?.map((x) =>
                        x.id === n.id
                            ? { ...x, read_at: new Date().toISOString() }
                            : x,
                    ) ?? prev,
            );
            setLocalUnread(Math.max(0, unread - 1));

            try {
                await postJson(notificationsRead.url(n.id));
            } catch {
                // Abaikan — tetap buka tujuan notifikasi.
            }
        }

        if (n.url) {
            router.visit(n.url);
        } else {
            router.reload({ only: ['auth'] });
        }
    };

    const readAll = async () => {
        setMarkingAll(true);

        try {
            await postJson(notificationsReadAll.url());
            const now = new Date().toISOString();
            setItems(
                (prev) =>
                    prev?.map((x) => ({ ...x, read_at: x.read_at ?? now })) ??
                    prev,
            );
            setLocalUnread(0);
        } catch {
            setError('Gagal menandai notifikasi.');
        } finally {
            setMarkingAll(false);
        }
    };

    const label =
        unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi';

    const trigger = (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('relative size-9', className)}
            aria-label={label}
            title="Notifikasi"
            onClick={isMobile ? () => onOpenChange(true) : undefined}
        >
            <Bell className="size-5" />
            {unread > 0 && (
                <span
                    className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
                    aria-hidden
                >
                    {unread > 99 ? '99+' : unread}
                </span>
            )}
        </Button>
    );

    const list = (
        <NotificationList
            items={items}
            loading={loading}
            error={error}
            unread={unread}
            onOpenItem={(n) => void openItem(n)}
            onReadAll={() => void readAll()}
            markingAll={markingAll}
            asMenu={!isMobile}
        />
    );

    if (isMobile) {
        return (
            <>
                {trigger}
                <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
                    <ResponsiveDialogContent className="gap-0 p-0">
                        <ResponsiveDialogHeader className="px-4 pt-4 pb-2">
                            <ResponsiveDialogTitle>
                                Notifikasi
                            </ResponsiveDialogTitle>
                            <ResponsiveDialogDescription className="sr-only">
                                Pemberitahuan tugas terbaru untuk Anda.
                            </ResponsiveDialogDescription>
                        </ResponsiveDialogHeader>
                        {list}
                    </ResponsiveDialogContent>
                </ResponsiveDialog>
            </>
        );
    }

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 p-0">
                <div className="px-3 pt-3 pb-1 text-sm font-semibold">
                    Notifikasi
                </div>
                {list}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
