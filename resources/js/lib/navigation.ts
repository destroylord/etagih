import {
    Activity,
    BarChart3,
    FileSignature,
    FolderKanban,
    LayoutGrid,
    ListTodo,
    Package,
    Palette,
    Receipt,
    Settings2,
    ShieldCheck,
    Timer,
    UserCog,
    UserRound,
    Users,
} from 'lucide-react';
import type { NavItem } from '@/types';

export type Role = 'owner' | 'admin' | 'staff';

/** Menu utama (sidebar desktop & sheet "Akun" di mobile). */
export const mainNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
    { title: 'Task', href: '/tasks', icon: ListTodo },
    { title: 'Invoice', href: '/invoices', icon: Receipt },
    { title: 'Penawaran', href: '/quotes', icon: FileSignature },
    { title: 'Klien', href: '/clients', icon: Users },
    { title: 'Proyek', href: '/projects', icon: FolderKanban },
    { title: 'Time Tracker', href: '/time-tracker', icon: Timer },
    { title: 'Produk & Layanan', href: '/products', icon: Package },
    { title: 'Laporan', href: '/reports', icon: BarChart3, roles: ['admin'] },
];

/** Pengaturan tingkat aplikasi (khusus admin). */
export const settingsNavItems: NavItem[] = [
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

/** Pengaturan pribadi (semua role). */
export const personalSettingsNavItems: NavItem[] = [
    { title: 'Profil', href: '/settings/profile', icon: UserRound },
    {
        title: 'Keamanan & passkey',
        href: '/settings/security',
        icon: ShieldCheck,
    },
    { title: 'Tampilan', href: '/settings/appearance', icon: Palette },
];

export const ROLE_LABEL: Record<Role, string> = {
    owner: 'Pemilik',
    admin: 'Admin',
    staff: 'Staf',
};

/** Normalisasi role mentah dari `auth.user.role`. */
export function normalizeRole(raw: unknown): Role {
    return raw === 'owner' || raw === 'admin' ? raw : 'staff';
}

/** Owner & admin dianggap admin. */
export function isAdminRole(role: Role): boolean {
    return role === 'owner' || role === 'admin';
}

/** Apakah item boleh tampil untuk role ini (`admin` mencakup owner). */
export function canSeeNavItem(item: NavItem, role: Role): boolean {
    if (!item.roles || item.roles.length === 0) {
        return true;
    }

    return item.roles.some(
        (r) => r === role || (r === 'admin' && isAdminRole(role)),
    );
}

/** Saring item navigasi sesuai role (server tetap menolak lewat middleware). */
export function visibleNavItems(items: NavItem[], role: Role): NavItem[] {
    return items.filter((item) => canSeeNavItem(item, role));
}
