import { useEffect } from 'react';

/**
 * Jalankan `callback` sekali saat halaman dibuka dengan `?<param>=1`
 * (mis. `/clients?new=1` dari aksi cepat mobile), lalu hapus parameter itu
 * dari URL agar refresh/render ulang tidak memicu ulang.
 *
 *   useQueryFlag('new', () => openForm(null));
 */
export function useQueryFlag(param: string, callback: () => void): void {
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const url = new URL(window.location.href);

        if (url.searchParams.get(param) !== '1') {
            return;
        }

        url.searchParams.delete(param);
        // Pertahankan state history Inertia, cukup ganti URL-nya.
        window.history.replaceState(
            window.history.state,
            '',
            url.pathname + url.search + url.hash,
        );
        callback();
    }, [param, callback]);
}
