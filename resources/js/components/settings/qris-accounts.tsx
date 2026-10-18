import { router } from '@inertiajs/react';
import { CheckCircle2, ImageUp, QrCode, Trash2, Upload } from 'lucide-react';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export type QrisAccountRow = {
    id: number;
    qris_id: string;
    name: string;
    provider: string | null;
    merchant_name: string | null;
    image_url: string | null;
    is_active: boolean;
    created_at: string | null;
};

const MAX_MB = 5;

/**
 * Daftar QRIS statis merchant yang sudah didaftarkan ke QRISLY + upload baru.
 * Upload → POST /settings/qris → QRISLY `upload-qris` → simpan `qris_id`.
 */
export function QrisAccounts({
    accounts,
    envFallback,
}: {
    accounts: QrisAccountRow[];
    envFallback: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setName('');
        setFile(null);
        setErrors({});

        if (preview) {
            URL.revokeObjectURL(preview);
        }

        setPreview(null);
    };

    const pick = (f: File | undefined) => {
        setErrors((e) => ({ ...e, qris_image: '' }));

        if (!f) {
            return;
        }

        if (!['image/png', 'image/jpeg'].includes(f.type)) {
            setErrors((e) => ({
                ...e,
                qris_image: 'Format harus PNG atau JPG.',
            }));

            return;
        }

        if (f.size > MAX_MB * 1024 * 1024) {
            setErrors((e) => ({
                ...e,
                qris_image: `Ukuran maksimal ${MAX_MB} MB.`,
            }));

            return;
        }

        if (preview) {
            URL.revokeObjectURL(preview);
        }

        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // Dialog di-portal, tapi event React tetap naik ke <form> pengaturan → hentikan.
        e.stopPropagation();

        if (!file) {
            setErrors({ qris_image: 'Pilih gambar QRIS terlebih dulu.' });

            return;
        }

        router.post(
            '/settings/qris',
            { name, qris_image: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                // Penolakan dari QRISLY juga datang sebagai error `qris_image`.
                onError: (errs) => setErrors(errs),
                onSuccess: () => {
                    setOpen(false);
                    reset();
                },
            },
        );
    };

    const activate = (id: number) =>
        router.post(
            `/settings/qris/${id}/activate`,
            {},
            {
                preserveScroll: true,
                onStart: () => setBusyId(id),
                onFinish: () => setBusyId(null),
            },
        );

    return (
        <div className="space-y-3">
            {accounts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
                    <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                        <QrCode className="size-5" />
                    </span>
                    <p className="text-sm font-medium">
                        Belum ada QRIS yang di-upload
                    </p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                        Upload gambar QRIS statis toko Anda (dari aplikasi
                        merchant DANA, GoPay, ShopeePay, bank, dll). QRISLY akan
                        membuat QRIS dinamis per pembayaran dari QRIS ini.
                        {envFallback &&
                            ' Saat ini pembayaran memakai QRISLY_MERCHANT_ID dari .env.'}
                    </p>
                </div>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {accounts.map((q) => (
                        <li
                            key={q.id}
                            className={cn(
                                'flex flex-wrap items-center gap-3 p-3',
                                q.is_active && 'bg-primary/5',
                            )}
                        >
                            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border bg-white">
                                {q.image_url ? (
                                    <img
                                        src={q.image_url}
                                        alt={`QRIS ${q.name}`}
                                        className="size-full object-contain"
                                    />
                                ) : (
                                    <QrCode className="size-6 text-muted-foreground" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-medium">
                                        {q.name}
                                    </p>
                                    {q.is_active && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                                            <CheckCircle2 className="size-3" />{' '}
                                            Aktif
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                    {[q.merchant_name, q.provider]
                                        .filter(Boolean)
                                        .join(' · ') || 'Merchant'}{' '}
                                    · ID{' '}
                                    {q.qris_id.length > 14
                                        ? `${q.qris_id.slice(0, 8)}…`
                                        : q.qris_id}
                                    {q.created_at &&
                                        ` · ${formatDate(q.created_at)}`}
                                </p>
                            </div>
                            <div className="flex gap-1.5">
                                {!q.is_active && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => activate(q.id)}
                                        disabled={busyId === q.id}
                                    >
                                        {busyId === q.id && <Spinner />}
                                        Jadikan aktif
                                    </Button>
                                )}
                                <ConfirmDialog
                                    trigger={
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="size-8 text-red-600 dark:text-red-400"
                                            aria-label={`Hapus QRIS ${q.name}`}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    }
                                    title="Hapus QRIS ini?"
                                    description={
                                        q.is_active
                                            ? 'QRIS ini sedang aktif. QRIS lain (bila ada) akan otomatis dijadikan aktif. QRIS tetap terdaftar di akun QRISLY Anda.'
                                            : 'QRIS dihapus dari aplikasi. QRIS tetap terdaftar di akun QRISLY Anda.'
                                    }
                                    confirmLabel="Hapus"
                                    destructive
                                    onConfirm={(done) =>
                                        router.delete(
                                            `/settings/qris/${q.id}`,
                                            {
                                                preserveScroll: true,
                                                onFinish: done,
                                            },
                                        )
                                    }
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
            >
                <Upload /> Upload QRIS
            </Button>

            <Dialog
                open={open}
                onOpenChange={(v) => {
                    if (processing) {
                        return;
                    }

                    setOpen(v);

                    if (!v) {
                        reset();
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={submit} className="space-y-4" noValidate>
                        <DialogHeader>
                            <DialogTitle>Upload QRIS</DialogTitle>
                            <DialogDescription>
                                Gambar QRIS statis akan didaftarkan ke QRISLY.
                                Pastikan QR terlihat jelas dan tidak terpotong.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-2">
                            <Label htmlFor="qris_name">Nama QRIS</Label>
                            <Input
                                id="qris_name"
                                value={name}
                                maxLength={100}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="mis. QRIS Toko Utama"
                                autoFocus
                            />
                            {errors.name && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>Gambar QRIS</Label>
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="grid h-48 place-items-center overflow-hidden rounded-lg border border-dashed bg-muted/40 transition-colors hover:bg-muted/60"
                            >
                                {preview ? (
                                    <img
                                        src={preview}
                                        alt="Pratinjau QRIS"
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : (
                                    <span className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
                                        <ImageUp className="size-6" />
                                        Klik untuk memilih gambar
                                        <span className="text-xs">
                                            PNG/JPG, maks. {MAX_MB} MB
                                        </span>
                                    </span>
                                )}
                            </button>
                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/png,image/jpeg"
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden
                                onChange={(e) => pick(e.target.files?.[0])}
                            />
                            {file && (
                                <p className="text-xs text-muted-foreground">
                                    {file.name} ·{' '}
                                    {(file.size / 1024).toFixed(0)} KB
                                </p>
                            )}
                            {errors.qris_image && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    {errors.qris_image}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={processing}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing || !name.trim() || !file}
                            >
                                {processing && <Spinner />}
                                Upload ke QRISLY
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
