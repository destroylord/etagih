import { Breadcrumbs } from '@/components/breadcrumbs';
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

    return (
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border/50 bg-background/80 px-4 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 supports-[backdrop-filter]:bg-background/60">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={items} />
            </div>
        </header>
    );
}
