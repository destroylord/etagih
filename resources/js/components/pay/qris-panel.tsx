import { AlertTriangle, Download, RefreshCw, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { parseExpiry } from './types';
import type { QrResult } from './types';

function fmtRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;

    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Panel QRIS: QR + nominal + hitung mundur masa berlaku + status live
 * "menunggu pembayaran". Mode testing menampilkan countdown simulasi.
 */
export function QrisPanel({
    qr,
    amount,
    label,
    invoiceNumber,
    isTesting,
    countdown,
    simulating,
    regenerating,
    onSimulate,
    onRegenerate,
    onClose,
}: {
    qr: QrResult;
    amount: number;
    label: string;
    invoiceNumber: string;
    isTesting: boolean;
    countdown: number;
    simulating: boolean;
    regenerating: boolean;
    onSimulate: () => void;
    onRegenerate: () => void;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const expiresAt = parseExpiry(qr.expiry_time);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (expiresAt === null) {
            return;
        }

        const id = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(id);
    }, [expiresAt]);

    // Di HP panel muncul di bawah tombol — gulir supaya QR langsung terlihat.
    useEffect(() => {
        containerRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [qr.qris_string]);

    const msLeft = expiresAt !== null ? expiresAt - now : null;
    const expired = msLeft !== null && msLeft <= 0;
    const urgent = msLeft !== null && msLeft > 0 && msLeft < 60_000;

    const svgUri = qr.qris_svg
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.qris_svg)}`
        : null;

    const saveDataUrl = (url: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `QRIS-${invoiceNumber}.png`;
        a.click();
    };

    const downloadQr = () => {
        // Kartu bergaya: gambar SVG ke canvas 2x supaya PNG tajam.
        if (svgUri) {
            const img = new Image();
            img.onload = () => {
                const scale = 2;
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth * scale;
                canvas.height = img.naturalHeight * scale;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    return;
                }

                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);
                saveDataUrl(canvas.toDataURL('image/png'));
            };
            img.src = svgUri;

            return;
        }

        const canvas = canvasRef.current;

        if (canvas) {
            saveDataUrl(canvas.toDataURL('image/png'));
        }
    };

    return (
        <div
            ref={containerRef}
            className="scroll-mt-4 rounded-xl border bg-card p-4 sm:p-5"
            aria-live="polite"
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold">Bayar dengan QRIS</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="-mt-1 -mr-2 size-8"
                    onClick={onClose}
                    aria-label="Tutup QRIS"
                >
                    <X className="size-4" />
                </Button>
            </div>

            <div className="mt-4 flex flex-col items-center">
                {svgUri ? (
                    <img
                        src={svgUri}
                        alt="Kode QRIS"
                        className={cn(
                            'w-full max-w-[300px] drop-shadow-sm',
                            expired && 'opacity-30 blur-[2px]',
                        )}
                    />
                ) : (
                    <div
                        className={cn(
                            'relative rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5',
                            expired && 'opacity-30 blur-[2px]',
                        )}
                    >
                        <QRCodeCanvas
                            ref={canvasRef}
                            value={qr.qris_string}
                            size={512}
                            marginSize={2}
                            style={{ width: 232, height: 232 }}
                            aria-label="Kode QRIS"
                            role="img"
                        />
                    </div>
                )}

                <p className="mt-4 text-xs text-muted-foreground">
                    Total dibayar
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {formatIDR(qr.final_amount ?? amount)}
                </p>

                {expired ? (
                    <div className="mt-4 w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        <p className="flex items-center justify-center gap-1.5 font-medium">
                            <AlertTriangle className="size-4" /> QRIS sudah
                            kedaluwarsa
                        </p>
                        <p className="mt-0.5 text-xs">
                            Buat kode baru untuk melanjutkan pembayaran.
                        </p>
                        <Button
                            size="sm"
                            className="mt-3"
                            onClick={onRegenerate}
                            disabled={regenerating}
                        >
                            {regenerating ? <Spinner /> : <RefreshCw />} Buat
                            QRIS baru
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                            <span className="relative flex size-2" aria-hidden>
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                                <span className="relative inline-flex size-2 rounded-full bg-primary" />
                            </span>
                            Menunggu pembayaran…
                        </div>
                        {msLeft !== null && (
                            <p
                                className={cn(
                                    'mt-2 text-xs text-muted-foreground',
                                    urgent &&
                                        'font-medium text-red-600 dark:text-red-400',
                                )}
                            >
                                Berlaku{' '}
                                <span className="font-mono tabular-nums">
                                    {fmtRemaining(msLeft)}
                                </span>{' '}
                                lagi
                            </p>
                        )}
                    </>
                )}
            </div>

            {!expired && (
                <>
                    <ol className="mt-5 space-y-1.5 text-xs text-muted-foreground">
                        <li>
                            1. Buka aplikasi m-banking atau e-wallet (GoPay,
                            OVO, DANA, ShopeePay, dll).
                        </li>
                        <li>
                            2. Pilih menu Scan/QRIS lalu pindai kode di atas.
                        </li>
                        <li>
                            3. Pastikan nominal sesuai, lalu konfirmasi
                            pembayaran.
                        </li>
                    </ol>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Membuka dari HP? Simpan gambar QR lalu unggah dari
                        galeri di aplikasi pembayaran Anda.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={downloadQr}
                    >
                        <Download /> Simpan gambar QR
                    </Button>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                        Halaman ini diperbarui otomatis setelah pembayaran
                        terkonfirmasi.
                    </p>
                </>
            )}

            {isTesting && !expired && (
                <div className="mt-4 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                        Mode testing: konfirmasi ke gateway dicek otomatis saat
                        hitungan selesai. Jika gateway/listener belum
                        mengonfirmasi, transaksi dianggap gagal.
                    </p>
                    {countdown > 0 && !simulating ? (
                        <p className="mt-2 text-3xl font-semibold text-amber-700 tabular-nums dark:text-amber-300">
                            {countdown}
                        </p>
                    ) : (
                        <Button
                            size="sm"
                            className="mt-2"
                            onClick={onSimulate}
                            disabled={simulating}
                        >
                            {simulating && <Spinner />}
                            {simulating
                                ? 'Memverifikasi pembayaran…'
                                : 'Cek & konfirmasi pembayaran'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
