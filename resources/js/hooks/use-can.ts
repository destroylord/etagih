import { usePage } from '@inertiajs/react';

export type UserRole = 'owner' | 'admin' | 'staff';

export type Can = {
    role: UserRole;
    /** Pemilik atau admin — akses pengaturan, laporan, hapus/batal, ekspor. */
    isAdmin: boolean;
    isOwner: boolean;
    /** Tambah/edit/hapus/import klien & kunci portal (admin). */
    manageClients: boolean;
    /** Tambah/edit proyek utama & hapus proyek (admin). */
    manageProjects: boolean;
    /** Atur anggota proyek (admin). */
    manageMembers: boolean;
    /** Tambah sub-proyek di proyek yang diikuti (semua pengguna). */
    createSubProjects: boolean;
    createTasks: boolean;
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
    const isAdmin = role === 'owner' || role === 'admin';
    // `auth.can` dari HandleInertiaRequests; fallback ke role bila tidak ada.
    const can = auth?.can ?? null;

    return {
        role,
        isAdmin,
        isOwner: role === 'owner',
        manageClients: can?.manageClients ?? isAdmin,
        manageProjects: can?.manageProjects ?? isAdmin,
        manageMembers: can?.manageMembers ?? isAdmin,
        createSubProjects: can?.createSubProjects ?? true,
        createTasks: can?.createTasks ?? true,
    };
}
