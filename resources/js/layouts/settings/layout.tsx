import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Invoice',
        href: '/settings/invoice',
        icon: null,
        roles: ['admin'],
    },
    {
        title: 'Pengguna',
        href: '/settings/users',
        icon: null,
        roles: ['admin'],
    },
    {
        title: 'Status sistem',
        href: '/settings/system',
        icon: null,
        roles: ['admin'],
    },
    {
        title: 'Profile',
        href: edit(),
        icon: null,
    },
    {
        title: 'Security',
        href: editSecurity(),
        icon: null,
    },
    {
        title: 'Appearance',
        href: editAppearance(),
        icon: null,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl, currentUrl } = useCurrentUrl();
    const { auth } = usePage().props;
    const role = (auth.user as { role?: string } | null)?.role ?? 'staff';
    const isAdmin = role === 'owner' || role === 'admin';
    const navItems = sidebarNavItems.filter(
        (item) =>
            !item.roles ||
            (item.roles.includes('admin')
                ? isAdmin
                : item.roles.some((r) => r === role)),
    );
    // Halaman dengan tabel / pratinjau butuh ruang lebih lebar.
    const wide = [
        '/settings/invoice',
        '/settings/users',
        '/settings/system',
    ].some((p) => currentUrl.startsWith(p));

    return (
        <div className="px-4 py-6">
            <Heading
                title="Pengaturan"
                description="Atur invoice, profil, keamanan, dan tampilan aplikasi"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav
                        className="flex flex-col space-y-1 space-x-0"
                        aria-label="Settings"
                    >
                        {navItems.map((item, index) => (
                            <Button
                                key={`${toUrl(item.href)}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted': isCurrentOrParentUrl(item.href),
                                })}
                            >
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                {/* Halaman pengaturan invoice butuh ruang lebih untuk preview template. */}
                <div
                    className={cn('flex-1', wide ? 'min-w-0' : 'md:max-w-2xl')}
                >
                    <section className={cn('space-y-12', !wide && 'max-w-xl')}>
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
