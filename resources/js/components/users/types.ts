import type { UserRole } from '@/hooks/use-can';

export type ManagedUser = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    two_factor_enabled: boolean;
    created_at: string | null;
    is_self: boolean;
    can: {
        edit: boolean;
        change_role: boolean;
        deactivate: boolean;
        delete: boolean;
        reset_password: boolean;
        transfer_ownership: boolean;
    };
};

export type TemporaryPassword = {
    user_id: number;
    name: string;
    email: string;
    password: string;
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    owner: 'Akses penuh, termasuk mengelola admin dan mengalihkan kepemilikan.',
    admin: 'Akses penuh: pengaturan, laporan, pengguna staf, hapus & batal.',
    staff: 'Operasional harian: invoice, pembayaran, klien, proyek, time tracker.',
};
