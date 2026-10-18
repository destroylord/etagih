import { Link, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FileOutput,
    MoreHorizontal,
    Pencil,
    RotateCw,
    Send,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { QuoteDetail } from '@/types/quotes';

type Dialog =
    'send' | 'resend' | 'delete' | 'convert' | 'accept' | 'decline' | null;

/** Bisa diubah jadi invoice (cermin Quote::canConvert). */
export function canConvertQuote(
    quote: Pick<QuoteDetail, 'status' | 'converted_invoice_id'>,
): boolean {
    return (
        quote.status === 'sent' ||
        quote.status === 'accepted' ||
        (quote.status === 'converted' && quote.converted_invoice_id === null)
    );
}

/**
 * Tombol aksi di header detail penawaran. Aksi sekunder pindah ke menu
 * "Lainnya" di layar kecil.
 */
export function QuoteActions({
    quote,
    isPastValidity,
}: {
    quote: QuoteDetail;
    isPastValidity: boolean;
}) {
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState('');
    const [acceptName, setAcceptName] = useState('');

    const base = `/quotes/${quote.id}`;
    const draft = quote.status === 'draft';
    const waiting = quote.status === 'sent';
    const canResend = waiting && !isPastValidity;
    const canConvert = canConvertQuote(quote);
    const canMark = ['sent', 'accepted', 'declined', 'expired'].includes(
        quote.status,
    );

    const dialogProps = (name: Exclude<Dialog, null>) => ({
        open: dialog === name,
        onOpenChange: (v: boolean) => setDialog(v ? name : null),
    });

    const duplicate = () => {
        setBusy(true);
        router.post(
            `${base}/duplicate`,
            {},
            { onFinish: () => setBusy(false) },
        );
    };

    const mark = (
        markAs: 'accepted' | 'declined',
        payload: Record<string, string | null>,
        done: () => void,
    ) =>
        router.put(
            base,
            { mark_as: markAs, ...payload },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReason('');
                    setAcceptName('');
                },
                onFinish: done,
            },
        );

    return (
        <>
            {draft && (
                <Button
                    variant="outline"
                    className="hidden sm:inline-flex"
                    asChild
                >
                    <Link href={`${base}/edit`}>
                        <Pencil /> Edit
                    </Link>
                </Button>
            )}
            {canResend && (
                <Button
                    variant="outline"
                    className="hidden sm:inline-flex"
                    onClick={() => setDialog('resend')}
                >
                    <RotateCw /> Kirim ulang
                </Button>
            )}
            {quote.status === 'converted' && quote.converted_invoice && (
                <Button variant="outline" asChild>
                    <Link href={`/invoices/${quote.converted_invoice.id}`}>
                        <FileOutput /> Lihat invoice
                    </Link>
                </Button>
            )}

            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={busy}>
                        {busy ? <Spinner /> : <MoreHorizontal />}
                        <span>Lainnya</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {draft && (
                        <DropdownMenuItem asChild className="sm:hidden">
                            <Link href={`${base}/edit`}>
                                <Pencil /> Edit
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {canResend && (
                        <DropdownMenuItem
                            className="sm:hidden"
                            onSelect={() => setDialog('resend')}
                        >
                            <RotateCw /> Kirim ulang
                        </DropdownMenuItem>
                    )}
                    {canMark && quote.status !== 'accepted' && (
                        <DropdownMenuItem onSelect={() => setDialog('accept')}>
                            <CheckCircle2 /> Tandai diterima
                        </DropdownMenuItem>
                    )}
                    {canMark && quote.status !== 'declined' && (
                        <DropdownMenuItem onSelect={() => setDialog('decline')}>
                            <XCircle /> Tandai ditolak
                        </DropdownMenuItem>
                    )}
                    {canMark && <DropdownMenuSeparator />}
                    <DropdownMenuItem onSelect={duplicate}>
                        <Copy /> Duplikat
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href={`${base}/pdf?inline=1`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <ExternalLink /> Lihat PDF
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a href={`${base}/pdf`}>
                            <Download /> Download PDF
                        </a>
                    </DropdownMenuItem>
                    {draft && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDialog('delete')}
                            >
                                <Trash2 /> Hapus draft
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {draft && (
                <Button onClick={() => setDialog('send')}>
                    <Send /> Kirim ke klien
                </Button>
            )}
            {canConvert && (
                <Button onClick={() => setDialog('convert')}>
                    <FileOutput /> Ubah jadi invoice
                </Button>
            )}

            <ConfirmDialog
                {...dialogProps('send')}
                title="Kirim penawaran ke klien?"
                description={
                    <>
                        Penawaran beserta PDF dikirim via WhatsApp dan email ke{' '}
                        <span className="font-medium text-foreground">
                            {quote.client?.name ?? 'klien'}
                        </span>
                        . Klien bisa menerima atau menolak lewat link. Setelah
                        dikirim, penawaran tidak bisa diedit lagi.
                    </>
                }
                confirmLabel="Kirim sekarang"
                onConfirm={(done) =>
                    router.post(
                        `${base}/send`,
                        {},
                        { preserveScroll: true, onFinish: done },
                    )
                }
            />

            <ConfirmDialog
                {...dialogProps('resend')}
                title="Kirim ulang penawaran?"
                description="Klien akan menerima pesan WhatsApp dan email berisi link penawaran dan PDF sekali lagi."
                confirmLabel="Kirim ulang"
                onConfirm={(done) =>
                    router.post(
                        `${base}/send`,
                        {},
                        { preserveScroll: true, onFinish: done },
                    )
                }
            />

            <ConfirmDialog
                {...dialogProps('convert')}
                title="Ubah penawaran jadi invoice?"
                description={
                    <>
                        Invoice <span className="font-medium">draft</span>{' '}
                        dibuat dengan item, proyek, diskon, PPN & PPh yang sama.
                        Penawaran ini ditandai{' '}
                        <span className="font-medium">jadi invoice</span>. Anda
                        bisa memeriksa invoice sebelum mengirimnya.
                    </>
                }
                confirmLabel="Buat invoice"
                onConfirm={(done) =>
                    router.post(`${base}/convert`, {}, { onFinish: done })
                }
            />

            <ConfirmDialog
                {...dialogProps('accept')}
                title="Tandai penawaran diterima?"
                description="Gunakan bila klien menyetujui di luar aplikasi (mis. lewat telepon atau chat)."
                confirmLabel="Tandai diterima"
                onConfirm={(done) =>
                    mark('accepted', { name: acceptName.trim() || null }, done)
                }
            >
                <div className="grid gap-2">
                    <Label htmlFor="accept-name">
                        Disetujui oleh{' '}
                        <span className="font-normal text-muted-foreground">
                            (opsional)
                        </span>
                    </Label>
                    <Input
                        id="accept-name"
                        maxLength={255}
                        value={acceptName}
                        onChange={(e) => setAcceptName(e.target.value)}
                        placeholder="Nama penanggung jawab klien"
                    />
                </div>
            </ConfirmDialog>

            <ConfirmDialog
                {...dialogProps('decline')}
                title="Tandai penawaran ditolak?"
                confirmLabel="Tandai ditolak"
                destructive
                onConfirm={(done) =>
                    mark('declined', { reason: reason.trim() || null }, done)
                }
            >
                <div className="grid gap-2">
                    <Label htmlFor="decline-reason">
                        Alasan{' '}
                        <span className="font-normal text-muted-foreground">
                            (opsional)
                        </span>
                    </Label>
                    <Textarea
                        id="decline-reason"
                        rows={3}
                        maxLength={2000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Mis. Anggaran klien belum tersedia"
                    />
                </div>
            </ConfirmDialog>

            <ConfirmDialog
                {...dialogProps('delete')}
                title="Hapus draft ini?"
                description={`Draft ${quote.quote_number} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`}
                confirmLabel="Hapus"
                destructive
                onConfirm={(done) => router.delete(base, { onFinish: done })}
            />
        </>
    );
}
