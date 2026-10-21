import { Link } from '@inertiajs/react';
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
import { useCan } from '@/hooks/use-can';
import {
    mainNavItems,
    settingsNavItems,
    visibleNavItems,
} from '@/lib/navigation';
import { dashboard } from '@/routes';

export function AppSidebar() {
    const { role } = useCan();
    // Item ber-`roles` disembunyikan dari role lain (server tetap menolak lewat middleware).
    const main = visibleNavItems(mainNavItems, role);
    const settings = visibleNavItems(settingsNavItems, role);

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
                <NavMain items={main} label="Menu" />
                {settings.length > 0 && (
                    <NavMain items={settings} label="Pengaturan" />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
