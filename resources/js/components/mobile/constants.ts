/**
 * Ukuran bottom nav mobile (h-16 + safe area iOS). Kelas ditulis utuh agar
 * terdeteksi Tailwind.
 */

/** Padding bawah konten agar tidak tertutup bottom nav (hanya < md). */
export const BOTTOM_NAV_PADDING =
    'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0';

/** Posisi elemen fixed tepat di atas bottom nav (hanya < md). */
export const ABOVE_BOTTOM_NAV =
    'bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0';
