import { usePage } from '@inertiajs/react';

export type UserRole = 'owner' | 'admin' | 'staff';

export type Can = {
    role: UserRole;
    /** Pemilik atau admin — akses pengaturan, laporan, hapus/batal, ekspor. */
    isAdmin: boolean;
    isOwner: boolean;
};

/**
 * Hak akses pengguna yang sedang login, dari `auth.user.role`.
 * Dipakai untuk menyembunyikan tombol khusus admin — server tetap
 * menolak lewat middleware `role:admin`.
 *
 *   const { isAdmin } = useCan();
 *   {isAdmin && <Button>Hapus</Button>}
 */
export function useCan(): Can {
    const { auth } = usePage().props;
    const raw = (auth?.user as { role?: string } | null | undefined)?.role;
    const role: UserRole = raw === 'owner' || raw === 'admin' ? raw : 'staff';

    return {
        role,
        isAdmin: role === 'owner' || role === 'admin',
        isOwner: role === 'owner',
    };
}
