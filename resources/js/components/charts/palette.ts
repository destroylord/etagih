/**
 * Warna grafik (tervalidasi dengan validator palet dataviz).
 * Ditulis sebagai kelas Tailwind literal supaya ter-scan saat build,
 * dengan langkah terpisah untuk mode gelap (bukan sekadar dibalik).
 */

/** Seri tunggal / aksen (kategori slot 1 — biru). */
export const SERIES_1_BG = 'bg-[#2a78d6] dark:bg-[#3987e5]';

/**
 * Umur piutang. "current" = belum jatuh tempo (biru, netral);
 * bucket terlambat = ramp ordinal satu-hue (merah) terang → gelap sesuai keparahan.
 * Ramp lolos cek ordinal (monoton, ΔL ≥ 0.06, kontras ≥ 2:1) di mode terang & gelap.
 */
export const AGING_BG: Record<string, string> = {
    current: 'bg-[#2a78d6] dark:bg-[#3987e5]',
    '1_30': 'bg-[#f2867a] dark:bg-[#f5a39a]',
    '31_60': 'bg-[#e2574c] dark:bg-[#ec6a5e]',
    '61_90': 'bg-[#c23a30] dark:bg-[#d6453a]',
    '90_plus': 'bg-[#8f2420] dark:bg-[#ad2e25]',
};
