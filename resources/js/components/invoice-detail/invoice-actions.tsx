import { Link, router } from '@inertiajs/react';
import {
    Ban,
    Copy,
    Download,
    ExternalLink,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCw,
    Send,
    Trash2,
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
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toNumber } from '@/lib/format';
import type { InvoiceDetail } from './types';
import { isOpen, remainingOf } from './types';

type Dialog = 'send' | 'resend' | 'delete' | 'cancel' | null;

/**
 * Tombol aksi di header halaman detail. Aksi utama selalu tampil; aksi sekunder
 * pindah ke menu "Lainnya" di layar kecil.
 */
export function InvoiceActions({
    invoice,
    onRecordPayment,
}: {
    invoice: InvoiceDetail;
    onRecordPayment: () => void;
}) {
    const [dialog, setDialog] = useState<Dialog>(null);
    const [reason, setReason] = useState('');
    const [duplicating, setDuplicating] = useState(false);

    const base = `/invoices/${invoice.id}`;
    const draft = invoice.status === 'draft';
    const open = isOpen(invoice.status);
    const canPay = open && remainingOf(invoice) > 0;
    const canCancel = open && toNumber(invoice.paid_amount) === 0;

    const dialogProps = (name: Exclude<Dialog, null>) => ({
        open: dialog === name,
        onOpenChange: (v: boolean) => setDialog(v ? name : null),
    });

    const duplicate = () => {
        setDuplicating(true);
        router.post(
            `${base}/duplicate`,
            {},
            { onFinish: () => setDuplicating(false) },
        );
    };

    return (
        <>
            {/* Aksi sekunder — hanya di layar ≥ sm */}
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
            {open && (
                <Button
                    variant="outline"
                    className="hidden sm:inline-flex"
                    onClick={() => setDialog('resend')}
                >
                    <RotateCw /> Kirim ulang
                </Button>
            )}
            {!draft && !canPay && (
                <Button
                    variant="outline"
                    className="hidden sm:inline-flex"
                    asChild
                >
                    <a href={`${base}/pdf`}>
                        <Download /> Download PDF
                    </a>
                </Button>
            )}

            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={duplicating}>
                        {duplicating ? <Spinner /> : <MoreHorizontal />}
                        <span>Lainnya</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {draft && (
                        <DropdownMenuItem asChild className="sm:hidden">
                            <Link href={`${base}/edit`}>
                                <Pencil /> Edit
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {open && (
                        <DropdownMenuItem
                            className="sm:hidden"
                            onSelect={() => setDialog('resend')}
                        >
                            <RotateCw /> Kirim ulang
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={duplicate}>
                        <Copy /> Duplikat
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href={`${base}/pdf/stream`}
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
                    {(draft || canCancel) && <DropdownMenuSeparator />}
                    {draft && (
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDialog('delete')}
                        >
                            <Trash2 /> Hapus draft
                        </DropdownMenuItem>
                    )}
                    {canCancel && (
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDialog('cancel')}
                        >
                            <Ban /> Batalkan invoice
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Aksi utama */}
            {draft && (
                <Button onClick={() => setDialog('send')}>
                    <Send /> Kirim ke klien
                </Button>
            )}
            {canPay && (
                <Button onClick={onRecordPayment}>
                    <Plus /> Catat pembayaran
                </Button>
            )}

            <ConfirmDialog
                {...dialogProps('send')}
                title="Kirim invoice ke klien?"
                description={
                    <>
                        Invoice beserta PDF akan dikirim via WhatsApp dan email
                        ke{' '}
                        <span className="font-medium text-foreground">
                            {invoice.client?.name ?? 'klien'}
                        </span>
                        . Setelah dikirim, invoice tidak bisa diedit lagi.
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
                title="Kirim ulang invoice?"
                description="Klien akan menerima pesan WhatsApp dan email berisi link pembayaran dan PDF invoice sekali lagi."
                confirmLabel="Kirim ulang"
                onConfirm={(done) =>
                    router.post(
                        `${base}/resend`,
                        {},
                        { preserveScroll: true, onFinish: done },
                    )
                }
            />

            <ConfirmDialog
                {...dialogProps('delete')}
                title="Hapus draft ini?"
                description={`Draft ${invoice.invoice_number} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`}
                confirmLabel="Hapus"
                destructive
                onConfirm={(done) => router.delete(base, { onFinish: done })}
            />

            <ConfirmDialog
                {...dialogProps('cancel')}
                title="Batalkan invoice?"
                description="Invoice tidak lagi dihitung sebagai piutang, link pembayaran dinonaktifkan, dan sesi Time Tracker dilepas kembali. Tindakan ini tidak bisa diurungkan."
                confirmLabel="Batalkan invoice"
                cancelLabel="Kembali"
                destructive
                onConfirm={(done) =>
                    router.post(
                        `${base}/cancel`,
                        { reason: reason.trim() || null },
                        {
                            preserveScroll: true,
                            onSuccess: () => setReason(''),
                            onFinish: done,
                        },
                    )
                }
            >
                <div className="grid gap-2">
                    <Label htmlFor="cancel-reason">
                        Alasan{' '}
                        <span className="font-normal text-muted-foreground">
                            (opsional)
                        </span>
                    </Label>
                    <Textarea
                        id="cancel-reason"
                        rows={3}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Mis. Proyek dibatalkan klien"
                    />
                </div>
            </ConfirmDialog>
        </>
    );
}
