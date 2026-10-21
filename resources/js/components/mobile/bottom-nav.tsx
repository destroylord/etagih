import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CheckSquare,
    CircleUserRound,
    FolderKanban,
    Plus,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { AccountSheet } from '@/components/mobile/account-sheet';
import { QuickActionSheet } from '@/components/mobile/quick-action-sheet';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';

type Tab = { title: string; href: string; icon: LucideIcon };

const LEFT_TABS: Tab[] = [
    { title: 'Task', href: '/tasks', icon: CheckSquare },
    { title: 'Klien', href: '/clients', icon: Users },
];

const RIGHT_TABS: Tab[] = [
    { title: 'Proyek', href: '/projects', icon: FolderKanban },
];

const itemClass =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors';

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
    return (
        <Link
            href={tab.href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
                itemClass,
                active ? 'text-primary' : 'text-muted-foreground',
            )}
        >
            <tab.icon
                className={cn('size-5', active && 'stroke-[2.5]')}
                aria-hidden
            />
            <span>{tab.title}</span>
        </Link>
    );
}

/**
 * Navigasi bawah untuk layar < md: Task · Klien · (+) · Proyek · Akun.
 * Konten halaman diberi padding bawah lewat `BOTTOM_NAV_PADDING`.
 */
export function BottomNav() {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const [quickOpen, setQuickOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const accountActive = accountOpen || isCurrentOrParentUrl('/settings');

    return (
        <>
            <nav
                aria-label="Navigasi utama"
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden print:hidden"
            >
                <div className="mx-auto flex h-16 max-w-lg items-stretch px-1">
                    {LEFT_TABS.map((tab) => (
                        <TabLink
                            key={tab.href}
                            tab={tab}
                            active={isCurrentOrParentUrl(tab.href)}
                        />
                    ))}
                    <div className="flex flex-1 items-start justify-center">
                        <button
                            type="button"
                            onClick={() => setQuickOpen(true)}
                            aria-label="Buat baru"
                            aria-haspopup="dialog"
                            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
                        >
                            <Plus className="size-6" />
                        </button>
                    </div>
                    {RIGHT_TABS.map((tab) => (
                        <TabLink
                            key={tab.href}
                            tab={tab}
                            active={isCurrentOrParentUrl(tab.href)}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => setAccountOpen(true)}
                        aria-haspopup="dialog"
                        className={cn(
                            itemClass,
                            accountActive
                                ? 'text-primary'
                                : 'text-muted-foreground',
                        )}
                    >
                        <CircleUserRound
                            className={cn(
                                'size-5',
                                accountActive && 'stroke-[2.5]',
                            )}
                            aria-hidden
                        />
                        <span>Akun</span>
                    </button>
                </div>
            </nav>
            <QuickActionSheet open={quickOpen} onOpenChange={setQuickOpen} />
            <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
        </>
    );
}
