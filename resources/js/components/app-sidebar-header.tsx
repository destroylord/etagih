import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

const SEGMENT_LABEL: Record<string, string> = {
    dashboard: 'Dashboard',
    invoices: 'Invoice',
    clients: 'Klien',
    projects: 'Proyek',
    products: 'Produk & Layanan',
    'time-tracker': 'Time Tracker',
    tasks: 'Task',
    reports: 'Laporan',
    settings: 'Pengaturan',
    invoice: 'Invoice',
    profile: 'Profil',
    security: 'Keamanan',
    appearance: 'Tampilan',
    create: 'Buat',
    edit: 'Edit',
};

/**
 * Breadcrumb otomatis dari URL (mis. /invoices/12/edit → Invoice › #12 › Edit)
 * bila halaman tidak mengirim breadcrumbs sendiri.
 */
function useAutoBreadcrumbs(): BreadcrumbItemType[] {
    const { currentUrl } = useCurrentUrl();
    const segments = currentUrl.split('/').filter(Boolean);

    return segments.map((segment, i) => ({
        title:
            SEGMENT_LABEL[segment] ??
            (/^\d+$/.test(segment) ? `#${segment}` : segment),
        href: '/' + segments.slice(0, i + 1).join('/'),
    }));
}

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const auto = useAutoBreadcrumbs();
    const items = breadcrumbs.length > 0 ? breadcrumbs : auto;
    const current = items[items.length - 1];

    return (
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border/50 bg-background/80 px-3 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 supports-[backdrop-filter]:bg-background/60 md:h-14 md:px-4">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="-ml-1 size-9 md:size-7" />
                {/* Mobile: cukup judul halaman (item breadcrumb terakhir). */}
                {current && (
                    <span className="truncate text-sm font-medium md:hidden">
                        {current.title}
                    </span>
                )}
                <div className="hidden min-w-0 md:block">
                    <Breadcrumbs breadcrumbs={items} />
                </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
                <NotificationBell />
            </div>
        </header>
    );
}
