import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Pratinjau PDF invoice dari isian form yang BELUM disimpan.
 * `buildFormData` dipanggil setiap kali pratinjau dimuat, jadi hasilnya
 * selalu mengikuti isian terbaru (termasuk logo / tanda tangan yang baru dipilih).
 */
export function PdfPreviewDialog({
    buildFormData,
    url = '/settings/invoice/pdf-preview',
}: {
    buildFormData: () => FormData;
    url?: string;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const lastUrl = useRef<string | null>(null);

    // Bersihkan object URL lama saat diganti / komponen dilepas.
    useEffect(() => {
        return () => {
            if (lastUrl.current) {
                URL.revokeObjectURL(lastUrl.current);
            }
        };
    }, []);

    const load = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: buildFormData(),
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/pdf, application/json',
                    'X-XSRF-TOKEN': xsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const first = body?.errors
                    ? (
                          Object.values(body.errors)[0] as string[] | undefined
                      )?.[0]
                    : null;

                throw new Error(
                    first ??
                        body?.message ??
                        `Gagal membuat pratinjau (${response.status}).`,
                );
            }

            const blob = await response.blob();
            const next = URL.createObjectURL(blob);

            if (lastUrl.current) {
                URL.revokeObjectURL(lastUrl.current);
            }

            lastUrl.current = next;
            setPdfUrl(next);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Gagal membuat pratinjau.',
            );
        } finally {
            setLoading(false);
        }
    };

    const openPreview = () => {
        setOpen(true);
        void load();
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openPreview}
            >
                <FileText /> Pratinjau PDF
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-3 p-4 sm:max-w-5xl sm:p-5">
                    <DialogHeader className="flex-row items-start justify-between gap-3 space-y-0 pr-8">
                        <div className="space-y-1">
                            <DialogTitle>Pratinjau invoice PDF</DialogTitle>
                            <DialogDescription>
                                Memakai isian form saat ini — belum disimpan.
                                Klik “Simpan” agar perubahan berlaku untuk semua
                                invoice.
                            </DialogDescription>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void load()}
                                disabled={loading}
                            >
                                {loading ? <Spinner /> : <RefreshCw />}
                                Muat ulang
                            </Button>
                            {pdfUrl && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                >
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <ExternalLink /> Tab baru
                                    </a>
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
                        {error ? (
                            <div className="grid h-full place-items-center p-6 text-center text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        ) : (
                            pdfUrl && (
                                <iframe
                                    key={pdfUrl}
                                    src={pdfUrl}
                                    title="Pratinjau invoice PDF"
                                    className="size-full bg-white"
                                />
                            )
                        )}
                        {loading && (
                            <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Spinner /> Membuat pratinjau…
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
