import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    BarChart3,
    FileSignature,
    FolderKanban,
    LayoutGrid,
    Package,
    Receipt,
    Settings2,
    Timer,
    UserCog,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
    { title: 'Invoice', href: '/invoices', icon: Receipt },
    { title: 'Penawaran', href: '/quotes', icon: FileSignature },
    { title: 'Klien', href: '/clients', icon: Users },
    { title: 'Proyek', href: '/projects', icon: FolderKanban },
    { title: 'Time Tracker', href: '/time-tracker', icon: Timer },
    { title: 'Produk & Layanan', href: '/products', icon: Package },
    { title: 'Laporan', href: '/reports', icon: BarChart3, roles: ['admin'] },
];

const settingsNavItems: NavItem[] = [
    {
        title: 'Pengaturan Invoice',
        href: '/settings/invoice',
        icon: Settings2,
        roles: ['admin'],
    },
    {
        title: 'Pengguna',
        href: '/settings/users',
        icon: UserCog,
        roles: ['admin'],
    },
    {
        title: 'Status sistem',
        href: '/settings/system',
        icon: Activity,
        roles: ['admin'],
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const role = (auth.user as { role?: string } | null)?.role ?? 'staff';
    const isAdmin = role === 'owner' || role === 'admin';
    // Item ber-`roles` disembunyikan dari role lain (server tetap menolak lewat middleware).
    const visible = (items: NavItem[]) =>
        items.filter(
            (item) =>
                !item.roles ||
                item.roles.some(
                    (r) => r === role || (r === 'admin' && isAdmin),
                ),
        );

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={visible(mainNavItems)} label="Menu" />
                {visible(settingsNavItems).length > 0 && (
                    <NavMain
                        items={visible(settingsNavItems)}
                        label="Pengaturan"
                    />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
