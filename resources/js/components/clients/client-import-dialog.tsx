import { router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    Download,
    FileSpreadsheet,
    Info,
    Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatIDR, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = '.xlsx,.csv,text/csv';
/** Batas baris yang dirender sekaligus agar dialog tetap ringan. */
const RENDER_LIMIT = 300;

type ImportAction = 'create' | 'update' | 'error';

type ImportRow = {
    line: number;
    values: {
        name: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
        hourly_rate: string | null;
    };
    errors: string[];
    action: ImportAction;
    match: { id: number; name: string; by: 'email' | 'phone' | 'name' } | null;
};

type PreviewResult = {
    token: string;
    file_name: string;
    columns: Record<string, string>;
    ignored_columns: string[];
    summary: { total: number; create: number; update: number; error: number };
    rows: ImportRow[];
};

type Filter = 'all' | ImportAction;

const MATCH_LABEL = { email: 'email', phone: 'telepon', name: 'nama' };

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

function StatusChip({
    action,
    updateExisting,
}: {
    action: ImportAction;
    updateExisting: boolean;
}) {
    const [label, tone] =
        action === 'create'
            ? [
                  'Baru',
                  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
              ]
            : action === 'error'
              ? [
                    'Error',
                    'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
                ]
              : updateExisting
                ? [
                      'Perbarui',
                      'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
                  ]
                : ['Lewati', 'bg-muted text-muted-foreground'];

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                tone,
            )}
        >
            {label}
        </span>
    );
}

function RowNote({ row }: { row: ImportRow }) {
    if (row.errors.length > 0) {
        return (
            <ul className="space-y-0.5 text-xs text-red-700 dark:text-red-400">
                {row.errors.map((e) => (
                    <li key={e}>{e}</li>
                ))}
            </ul>
        );
    }

    if (row.match) {
        return (
            <p className="text-xs text-muted-foreground">
                Sama dengan klien{' '}
                <span className="font-medium text-foreground">
                    {row.match.name}
                </span>{' '}
                ({MATCH_LABEL[row.match.by]} sama)
            </p>
        );
    }

    return null;
}

/**
 * Import klien dari file Excel / CSV dalam dua langkah: unggah → pratinjau →
 * konfirmasi. Pratinjau tidak menyimpan apa pun; data hasil urai disimpan di
 * server (token) dan baru diterapkan saat konfirmasi.
 */
export function ClientImportDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [updateExisting, setUpdateExisting] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');

    const reset = () => {
        setPreview(null);
        setError(null);
        setFilter('all');
        setUpdateExisting(false);
        setDragging(false);
    };

    const handleOpenChange = (next: boolean) => {
        if (uploading || submitting) {
            return;
        }

        if (!next) {
            reset();
        }

        onOpenChange(next);
    };

    const upload = async (file: File) => {
        setError(null);

        if (!/\.(xlsx|csv|txt)$/i.test(file.name)) {
            setError('Format file harus .xlsx atau .csv.');

            return;
        }

        if (file.size > MAX_BYTES) {
            setError('Ukuran file maksimal 2 MB.');

            return;
        }

        const body = new FormData();
        body.append('file', file);
        setUploading(true);

        try {
            const response = await fetch('/clients/import/preview', {
                method: 'POST',
                body,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': xsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const first = data?.errors
                    ? (
                          Object.values(data.errors)[0] as string[] | undefined
                      )?.[0]
                    : null;

                throw new Error(
                    first ??
                        data?.message ??
                        `Gagal membaca file (${response.status}).`,
                );
            }

            setPreview(data as PreviewResult);
            setFilter('all');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal membaca file.');
        } finally {
            setUploading(false);

            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];

        if (file && !uploading) {
            void upload(file);
        }
    };

    const confirm = () => {
        if (!preview) {
            return;
        }

        router.post(
            '/clients/import',
            { token: preview.token, update_existing: updateExisting },
            {
                preserveScroll: true,
                onStart: () => setSubmitting(true),
                onFinish: () => setSubmitting(false),
                onSuccess: () => {
                    reset();
                    onOpenChange(false);
                },
            },
        );
    };

    const summary = preview?.summary;
    const toApply = summary
        ? summary.create + (updateExisting ? summary.update : 0)
        : 0;
    const toSkip = summary
        ? summary.error + (updateExisting ? 0 : summary.update)
        : 0;

    const filtered =
        preview?.rows.filter((r) => filter === 'all' || r.action === filter) ??
        [];
    const visible = filtered.slice(0, RENDER_LIMIT);

    const filters: { key: Filter; label: string; count: number }[] = summary
        ? [
              { key: 'all', label: 'Semua', count: summary.total },
              { key: 'create', label: 'Baru', count: summary.create },
              {
                  key: 'update',
                  label: 'Sudah ada',
                  count: summary.update,
              },
              { key: 'error', label: 'Error', count: summary.error },
          ]
        : [];

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(
                    'flex max-h-[92vh] flex-col gap-4',
                    preview ? 'sm:max-w-4xl' : 'sm:max-w-lg',
                )}
            >
                <DialogHeader>
                    <DialogTitle>Import klien</DialogTitle>
                    <DialogDescription>
                        {preview
                            ? 'Periksa hasil pembacaan file. Belum ada data yang disimpan sampai Anda menekan “Import”.'
                            : 'Unggah file Excel (.xlsx) atau CSV berisi daftar klien. Maksimal 2 MB / 5.000 baris.'}
                    </DialogDescription>
                </DialogHeader>

                {!preview ? (
                    <div className="space-y-4">
                        <div
                            role="button"
                            tabIndex={0}
                            aria-disabled={uploading}
                            onClick={() =>
                                !uploading && inputRef.current?.click()
                            }
                            onKeyDown={(e) => {
                                if (
                                    !uploading &&
                                    (e.key === 'Enter' || e.key === ' ')
                                ) {
                                    e.preventDefault();
                                    inputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDrop}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                dragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40',
                                uploading && 'pointer-events-none opacity-70',
                            )}
                        >
                            {uploading ? (
                                <>
                                    <Spinner className="size-6" />
                                    <p className="text-sm font-medium">
                                        Membaca file…
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Upload className="size-6 text-muted-foreground" />
                                    <p className="text-sm font-medium">
                                        Tarik & lepas file di sini, atau klik
                                        untuk memilih
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        .xlsx atau .csv (pemisah koma, titik
                                        koma, atau tab)
                                    </p>
                                </>
                            )}
                            <input
                                ref={inputRef}
                                type="file"
                                accept={ACCEPT}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];

                                    if (file) {
                                        void upload(file);
                                    }
                                }}
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <p className="font-medium">Belum punya file?</p>
                            <p className="mt-0.5 text-muted-foreground">
                                Unduh template berisi kolom{' '}
                                <code className="text-xs">
                                    nama, email, telepon, alamat, catatan,
                                    tarif_per_jam
                                </code>{' '}
                                beserta petunjuk pengisian.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <a href="/clients/import/template">
                                        <Download /> Template Excel
                                    </a>
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                    <a href="/clients/import/template?format=csv">
                                        <Download /> Template CSV
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">
                                    {preview.file_name}
                                </span>
                            </span>
                            <span className="text-muted-foreground">
                                {formatNumber(preview.summary.total)} baris
                            </span>
                        </div>

                        {preview.ignored_columns.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Kolom diabaikan:{' '}
                                {preview.ignored_columns.join(', ')}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                            {filters.map((f) => (
                                <Button
                                    key={f.key}
                                    type="button"
                                    size="sm"
                                    variant={
                                        filter === f.key ? 'default' : 'outline'
                                    }
                                    className="h-7 rounded-full px-3 text-xs"
                                    onClick={() => setFilter(f.key)}
                                >
                                    {f.label}
                                    <span className="tabular-nums opacity-70">
                                        {formatNumber(f.count)}
                                    </span>
                                </Button>
                            ))}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
                            {visible.length === 0 ? (
                                <p className="p-6 text-center text-sm text-muted-foreground">
                                    Tidak ada baris pada filter ini.
                                </p>
                            ) : (
                                <>
                                    {/* Desktop */}
                                    <Table className="hidden md:table">
                                        <TableHeader>
                                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                                <TableHead className="w-14 pl-3">
                                                    Baris
                                                </TableHead>
                                                <TableHead className="w-24">
                                                    Status
                                                </TableHead>
                                                <TableHead>Klien</TableHead>
                                                <TableHead>Telepon</TableHead>
                                                <TableHead className="text-right">
                                                    Tarif/jam
                                                </TableHead>
                                                <TableHead className="pr-3">
                                                    Keterangan
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {visible.map((r) => (
                                                <TableRow
                                                    key={r.line}
                                                    className="align-top"
                                                >
                                                    <TableCell className="pl-3 text-muted-foreground tabular-nums">
                                                        {r.line}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusChip
                                                            action={r.action}
                                                            updateExisting={
                                                                updateExisting
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="max-w-56">
                                                        <p className="truncate font-medium">
                                                            {r.values.name ??
                                                                '—'}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {r.values.email ??
                                                                'Tanpa email'}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {r.values.phone ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {r.values
                                                            .hourly_rate !==
                                                        null
                                                            ? formatIDR(
                                                                  r.values
                                                                      .hourly_rate,
                                                              )
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell className="max-w-72 pr-3 whitespace-normal">
                                                        <RowNote row={r} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {/* Mobile */}
                                    <ul className="divide-y md:hidden">
                                        {visible.map((r) => (
                                            <li
                                                key={r.line}
                                                className="space-y-1 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium">
                                                            {r.values.name ??
                                                                '—'}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            Baris {r.line}
                                                            {r.values.email &&
                                                                ` · ${r.values.email}`}
                                                            {r.values.phone &&
                                                                ` · ${r.values.phone}`}
                                                        </p>
                                                    </div>
                                                    <StatusChip
                                                        action={r.action}
                                                        updateExisting={
                                                            updateExisting
                                                        }
                                                    />
                                                </div>
                                                <RowNote row={r} />
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>

                        {filtered.length > visible.length && (
                            <p className="text-xs text-muted-foreground">
                                Menampilkan {formatNumber(visible.length)} dari{' '}
                                {formatNumber(filtered.length)} baris.
                            </p>
                        )}

                        {preview.summary.update > 0 && (
                            <div className="flex items-start gap-2.5 rounded-lg border p-3">
                                <Checkbox
                                    id="import-update-existing"
                                    checked={updateExisting}
                                    onCheckedChange={(v) =>
                                        setUpdateExisting(v === true)
                                    }
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <Label
                                        htmlFor="import-update-existing"
                                        className="cursor-pointer"
                                    >
                                        Perbarui klien yang sudah ada (
                                        {formatNumber(preview.summary.update)})
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Bila tidak dicentang, baris tersebut
                                        dilewati. Kolom yang kosong di file
                                        tidak menghapus data lama.
                                    </p>
                                </div>
                            </div>
                        )}

                        <p className="flex items-start gap-2 text-xs text-muted-foreground">
                            <Info className="mt-px size-3.5 shrink-0" />
                            Klien baru otomatis mendapat kunci akses portal,
                            tetapi kunci tidak ditampilkan. Buat kunci baru per
                            klien lewat tombol “Buat kunci akses baru” saat
                            dibutuhkan.
                        </p>
                    </div>
                )}

                {preview && (
                    <DialogFooter className="gap-2 sm:items-center sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={reset}
                            disabled={submitting}
                        >
                            <ArrowLeft /> Ganti file
                        </Button>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                            <span className="text-center text-xs text-muted-foreground sm:text-right">
                                {formatNumber(toApply)} diproses ·{' '}
                                {formatNumber(toSkip)} dilewati
                            </span>
                            <Button
                                type="button"
                                onClick={confirm}
                                disabled={submitting || toApply === 0}
                            >
                                {submitting && <Spinner />}
                                Import {formatNumber(toApply)} klien
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
