import { AccessKeyDialog } from '@/components/access-key-dialog';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { BottomNav } from '@/components/mobile/bottom-nav';
import { BOTTOM_NAV_PADDING } from '@/components/mobile/constants';
import { cn } from '@/lib/utils';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
                // `clip` (bukan `hidden`) agar elemen sticky tetap menempel ke viewport.
                className={cn('overflow-x-clip', BOTTOM_NAV_PADDING)}
            >
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {children}
                <AccessKeyDialog />
            </AppContent>
            <BottomNav />
        </AppShell>
    );
}
