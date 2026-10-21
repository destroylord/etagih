import type { ReactNode } from 'react';
import { ABOVE_BOTTOM_NAV } from '@/components/mobile/constants';
import { cn } from '@/lib/utils';

/**
 * Area aksi menempel di bawah layar pada mobile (tepat di atas bottom nav),
 * mis. ringkasan total + tombol Simpan di form. Di ≥ md tampil inline
 * sebagai blok biasa kecuali `mobileOnly` (maka disembunyikan di desktop).
 *
 * Beri ruang di akhir form dengan `<MobileActionBarSpacer />` agar konten
 * terakhir tidak tertutup.
 */
export function MobileActionBar({
    children,
    className,
    mobileOnly = false,
}: {
    children: ReactNode;
    className?: string;
    /** Sembunyikan di ≥ md (dipakai bila desktop sudah punya tombol sendiri). */
    mobileOnly?: boolean;
}) {
    return (
        <div
            className={cn(
                'fixed inset-x-0 z-30 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.15)] backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden',
                ABOVE_BOTTOM_NAV,
                mobileOnly
                    ? 'md:hidden'
                    : 'md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none',
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Spacer setinggi action bar (hanya < md). */
export function MobileActionBarSpacer({ className }: { className?: string }) {
    return <div aria-hidden className={cn('h-20 md:hidden', className)} />;
}
