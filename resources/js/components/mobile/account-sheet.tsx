import { Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, Download, LogOut, Share } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useCan } from '@/hooks/use-can';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useInitials } from '@/hooks/use-initials';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import {
    mainNavItems,
    personalSettingsNavItems,
    ROLE_LABEL,
    settingsNavItems,
    visibleNavItems,
} from '@/lib/navigation';
import { cn, toUrl } from '@/lib/utils';
import { logout } from '@/routes';
import type { NavItem } from '@/types';

/** Klien & Proyek sudah ada di bottom nav. */
const IN_BOTTOM_NAV = ['/clients', '/projects'];

function MenuGroup({
    label,
    items,
    onNavigate,
}: {
    label: string;
    items: NavItem[];
    onNavigate: () => void;
}) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    if (items.length === 0) {
        return null;
    }

    return (
        <section className="space-y-1.5">
            <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </h3>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {items.map((item) => {
                    const active = isCurrentOrParentUrl(item.href);

                    return (
                        <li key={toUrl(item.href)}>
                            <Link
                                href={item.href}
                                prefetch
                                onClick={onNavigate}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-12 items-center gap-3 px-3 text-sm transition-colors active:bg-accent',
                                    active && 'bg-accent font-medium',
                                )}
                            >
                                {item.icon && (
                                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="flex-1 truncate">
                                    {item.title}
                                </span>
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** Sheet "Akun" di bottom nav: info pengguna + seluruh menu + keluar. */
export function AccountSheet({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { auth } = usePage().props;
    const { role } = useCan();
    const getInitials = useInitials();
    const cleanup = useMobileNavigation();
    const { canInstall, install, showIOSHint } = useInstallPrompt();

    const close = () => onOpenChange(false);
    const menu = visibleNavItems(mainNavItems, role).filter(
        (item) => !IN_BOTTOM_NAV.includes(toUrl(item.href)),
    );
    const settings = [
        ...personalSettingsNavItems,
        ...visibleNavItems(settingsNavItems, role),
    ];

    const handleLogout = () => {
        cleanup();
        close();
        router.flushAll();
    };

    const user = auth.user;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="h-[92dvh] gap-0 rounded-t-2xl"
            >
                <div aria-hidden className="flex justify-center pt-3">
                    <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                </div>
                <SheetHeader className="pb-3">
                    <SheetTitle>Akun</SheetTitle>
                    <SheetDescription className="sr-only">
                        Profil, menu, dan pengaturan
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {user && (
                        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
                            <Avatar className="size-12 overflow-hidden rounded-full">
                                <AvatarImage
                                    src={user.avatar}
                                    alt={user.name}
                                />
                                <AvatarFallback className="bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                    {getInitials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                    {user.name}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                {ROLE_LABEL[role]}
                            </span>
                        </div>
                    )}

                    <MenuGroup label="Menu" items={menu} onNavigate={close} />
                    <MenuGroup
                        label="Pengaturan"
                        items={settings}
                        onNavigate={close}
                    />

                    {(canInstall || showIOSHint) && (
                        <section className="space-y-1.5">
                            <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Aplikasi
                            </h3>
                            {canInstall ? (
                                <button
                                    type="button"
                                    onClick={() => void install()}
                                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-3 text-left text-sm active:bg-accent"
                                >
                                    <Download className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="flex-1">
                                        Pasang aplikasi
                                    </span>
                                </button>
                            ) : (
                                <p className="flex items-start gap-3 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                                    <Share className="mt-0.5 size-4 shrink-0" />
                                    <span>
                                        Pasang eTagih di layar utama: ketuk{' '}
                                        <strong>Bagikan</strong> lalu{' '}
                                        <strong>Tambah ke Layar Utama</strong>.
                                    </span>
                                </p>
                            )}
                        </section>
                    )}

                    <Link
                        href={logout()}
                        as="button"
                        onClick={handleLogout}
                        data-test="mobile-logout-button"
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium text-destructive active:bg-accent"
                    >
                        <LogOut className="size-4" />
                        Keluar
                    </Link>
                </div>
            </SheetContent>
        </Sheet>
    );
}
