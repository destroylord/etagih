import { Head, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    CheckCircle2,
    Clock,
    FileClock,
    FileText,
    ThumbsDown,
    ThumbsUp,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { CompanyHeader } from '@/components/pay/company-header';
import type { PayCompany } from '@/components/pay/types';
import { QuoteItemsTable } from '@/components/quote-detail/quote-paper';
import { QuoteStatusBadge } from '@/components/quote-detail/quote-status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import {
    daysFromToday,
    formatDate,
    formatDateTime,
    formatIDR,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicQuote } from '@/types/quotes';
import { quoteTerms } from '@/types/quotes';

function StateCard({
    tone,
    icon: Icon,
    title,
    children,
}: {
    tone: 'ok' | 'bad' | 'muted';
    icon: typeof CheckCircle2;
    title: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="text-center">
            <span
                className={cn(
                    'mx-auto grid size-12 place-items-center rounded-full',
                    tone === 'ok' &&
                        'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
                    tone === 'bad' &&
                        'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400',
                    tone === 'muted' && 'bg-muted text-muted-foreground',
                )}
            >
                <Icon className="size-6" />
            </span>
            <h1 className="mt-3 text-lg font-semibold">{title}</h1>
            {children && (
                <div className="mt-1 text-sm text-muted-foreground">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function PublicQuoteShow({
    quote,
    company,
    canRespond,
    isPastValidity,
}: {
    quote: PublicQuote;
    company: PayCompany;
    canRespond: boolean;
    isPastValidity: boolean;
}) {
    const base = `/q/${encodeURIComponent(quote.public_token)}`;
    const [declineOpen, setDeclineOpen] = useState(false);
    const acceptForm = useForm({ name: '', note: '' });
    const declineForm = useForm({ reason: '' });

    const status = quote.status;
    const accepted = status === 'accepted' || status === 'converted';
    const declined = status === 'declined';
    const expired =
        status === 'expired' || (status === 'sent' && isPastValidity);
    const isDraft = status === 'draft';
    const diff = daysFromToday(quote.valid_until);
    const terms = quoteTerms(quote.terms);
    const pph = toNumber(quote.pph_amount);
    const contact = company.company_name || 'penerbit penawaran';

    const accept = (e: FormEvent) => {
        e.preventDefault();
        acceptForm.post(`${base}/accept`, { preserveScroll: true });
    };

    const decline = (e: FormEvent) => {
        e.preventDefault();
        declineForm.post(`${base}/decline`, {
            preserveScroll: true,
            onSuccess: () => setDeclineOpen(false),
        });
    };

    return (
        <>
            <Head title={`Penawaran ${quote.quote_number}`} />
            <div className="min-h-screen bg-muted/40 dark:bg-background">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <CompanyHeader company={company} />
                    </div>

                    {isDraft && (
                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-dashed bg-card p-4 text-sm">
                            <FileClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <p>
                                <span className="font-medium">
                                    Pratinjau draft.
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    Penawaran ini belum dikirim sehingga belum
                                    bisa dijawab oleh klien.
                                </span>
                            </p>
                        </div>
                    )}

                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                        {/* Kolom jawaban — tampil pertama di HP */}
                        <aside className="space-y-4 lg:sticky lg:top-6 lg:order-last">
                            <Card className="gap-0 overflow-hidden py-0">
                                <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
                                    <span className="truncate text-sm font-medium">
                                        {quote.quote_number}
                                    </span>
                                    <QuoteStatusBadge
                                        status={expired ? 'expired' : status}
                                    />
                                </div>

                                <div className="p-5">
                                    {accepted ? (
                                        <StateCard
                                            tone="ok"
                                            icon={CheckCircle2}
                                            title="Penawaran disetujui"
                                        >
                                            Terima kasih
                                            {quote.accepted_by
                                                ? `, ${quote.accepted_by}`
                                                : ''}
                                            ! Penawaran senilai{' '}
                                            <span className="font-medium text-foreground tabular-nums">
                                                {formatIDR(quote.total)}
                                            </span>{' '}
                                            disetujui
                                            {quote.accepted_at &&
                                                ` pada ${formatDateTime(quote.accepted_at)}`}
                                            . {contact} akan segera menghubungi
                                            Anda untuk langkah berikutnya.
                                        </StateCard>
                                    ) : declined ? (
                                        <StateCard
                                            tone="bad"
                                            icon={XCircle}
                                            title="Penawaran ditolak"
                                        >
                                            Terima kasih atas tanggapan Anda.
                                            {quote.decline_reason && (
                                                <span className="mt-3 block rounded-lg bg-muted p-3 text-left text-foreground">
                                                    <span className="block text-xs text-muted-foreground">
                                                        Alasan
                                                    </span>
                                                    {quote.decline_reason}
                                                </span>
                                            )}
                                        </StateCard>
                                    ) : expired ? (
                                        <StateCard
                                            tone="muted"
                                            icon={Clock}
                                            title="Penawaran kedaluwarsa"
                                        >
                                            Masa berlaku penawaran ini berakhir{' '}
                                            {formatDate(quote.valid_until)}.
                                            Hubungi {contact} untuk penawaran
                                            terbaru.
                                        </StateCard>
                                    ) : (
                                        <>
                                            <p className="text-sm text-muted-foreground">
                                                Nilai penawaran
                                            </p>
                                            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                                                {formatIDR(quote.total)}
                                            </p>
                                            {quote.valid_until && (
                                                <p
                                                    className={cn(
                                                        'mt-1 flex items-center gap-1.5 text-sm',
                                                        diff !== null &&
                                                            diff <= 3
                                                            ? 'font-medium text-amber-600 dark:text-amber-400'
                                                            : 'text-muted-foreground',
                                                    )}
                                                >
                                                    <CalendarClock className="size-4" />
                                                    Berlaku sampai{' '}
                                                    {formatDate(
                                                        quote.valid_until,
                                                    )}
                                                    {diff !== null &&
                                                        diff >= 0 &&
                                                        ` · ${diff === 0 ? 'hari ini' : `${diff} hari lagi`}`}
                                                </p>
                                            )}

                                            {canRespond && (
                                                <form
                                                    onSubmit={accept}
                                                    className="mt-5 space-y-3"
                                                >
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="accept-name">
                                                            Nama Anda{' '}
                                                            <span className="font-normal text-muted-foreground">
                                                                (opsional)
                                                            </span>
                                                        </Label>
                                                        <Input
                                                            id="accept-name"
                                                            maxLength={255}
                                                            autoComplete="name"
                                                            value={
                                                                acceptForm.data
                                                                    .name
                                                            }
                                                            onChange={(e) =>
                                                                acceptForm.setData(
                                                                    'name',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Nama penanggung jawab"
                                                        />
                                                        <InputError
                                                            message={
                                                                acceptForm
                                                                    .errors.name
                                                            }
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="accept-note">
                                                            Catatan{' '}
                                                            <span className="font-normal text-muted-foreground">
                                                                (opsional)
                                                            </span>
                                                        </Label>
                                                        <Textarea
                                                            id="accept-note"
                                                            rows={2}
                                                            maxLength={2000}
                                                            value={
                                                                acceptForm.data
                                                                    .note
                                                            }
                                                            onChange={(e) =>
                                                                acceptForm.setData(
                                                                    'note',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Mis. jadwal mulai yang diinginkan"
                                                        />
                                                        <InputError
                                                            message={
                                                                acceptForm
                                                                    .errors.note
                                                            }
                                                        />
                                                    </div>
                                                    <Button
                                                        type="submit"
                                                        size="lg"
                                                        className="h-12 w-full text-base"
                                                        disabled={
                                                            acceptForm.processing
                                                        }
                                                    >
                                                        {acceptForm.processing ? (
                                                            <Spinner />
                                                        ) : (
                                                            <ThumbsUp />
                                                        )}
                                                        Terima penawaran
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="w-full text-muted-foreground"
                                                        onClick={() =>
                                                            setDeclineOpen(true)
                                                        }
                                                    >
                                                        <ThumbsDown /> Tolak
                                                    </Button>
                                                    <p className="text-center text-xs text-muted-foreground">
                                                        Dengan menerima, Anda
                                                        menyetujui harga dan
                                                        syarat pada penawaran
                                                        ini. Invoice akan
                                                        dikirim terpisah.
                                                    </p>
                                                </form>
                                            )}
                                        </>
                                    )}
                                </div>
                            </Card>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full print:hidden"
                                onClick={() => window.print()}
                            >
                                <FileText /> Cetak / simpan PDF
                            </Button>
                        </aside>

                        {/* Detail penawaran */}
                        <main className="min-w-0">
                            <Card className="gap-0 overflow-hidden bg-white py-0 text-gray-900">
                                <div className="p-5 sm:p-8">
                                    <div className="flex flex-col gap-4 border-b-2 border-gray-900 pb-5 sm:flex-row sm:justify-between">
                                        <div>
                                            <p className="text-xl font-extrabold tracking-[0.12em]">
                                                PENAWARAN HARGA
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-gray-700">
                                                {quote.quote_number}
                                            </p>
                                        </div>
                                        <dl className="space-y-0.5 text-sm text-gray-600 sm:text-right">
                                            <div className="flex gap-2 sm:justify-end">
                                                <dt className="text-gray-400">
                                                    Tanggal
                                                </dt>
                                                <dd className="font-medium">
                                                    {formatDate(
                                                        quote.issue_date,
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="flex gap-2 sm:justify-end">
                                                <dt className="text-gray-400">
                                                    Berlaku sampai
                                                </dt>
                                                <dd className="font-medium">
                                                    {formatDate(
                                                        quote.valid_until,
                                                        'Tidak dibatasi',
                                                    )}
                                                </dd>
                                            </div>
                                            {quote.project && (
                                                <div className="flex gap-2 sm:justify-end">
                                                    <dt className="text-gray-400">
                                                        Proyek
                                                    </dt>
                                                    <dd className="font-medium">
                                                        {quote.project
                                                            .full_name ??
                                                            quote.project.name}
                                                    </dd>
                                                </div>
                                            )}
                                        </dl>
                                    </div>

                                    <div className="grid gap-6 pt-5 sm:grid-cols-2">
                                        <div>
                                            <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                                                Ditujukan kepada
                                            </p>
                                            <p className="font-semibold">
                                                {quote.client.name}
                                            </p>
                                            {quote.client.address && (
                                                <p className="mt-1 text-sm whitespace-pre-line text-gray-600">
                                                    {quote.client.address}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                                                Dari
                                            </p>
                                            <p className="font-semibold">
                                                {company.company_name ||
                                                    'Penerbit'}
                                            </p>
                                            {company.company_address && (
                                                <p className="mt-1 text-sm whitespace-pre-line text-gray-600">
                                                    {company.company_address}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6">
                                        <QuoteItemsTable quote={quote} />
                                    </div>

                                    {pph > 0 && (
                                        <p className="mt-3 text-right text-xs text-gray-500">
                                            PPh 23 dipotong & disetor oleh
                                            klien; mohon kirimkan bukti potong.
                                        </p>
                                    )}

                                    {(quote.notes || terms.length > 0) && (
                                        <div className="mt-6 space-y-4 border-t border-gray-100 pt-5 text-sm text-gray-600">
                                            {quote.notes && (
                                                <div>
                                                    <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                                                        Catatan
                                                    </p>
                                                    <p className="whitespace-pre-line">
                                                        {quote.notes}
                                                    </p>
                                                </div>
                                            )}
                                            {terms.length > 0 && (
                                                <div>
                                                    <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                                                        Syarat &amp; ketentuan
                                                    </p>
                                                    <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-500">
                                                        {terms.map((t, i) => (
                                                            <li key={i}>{t}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </main>
                    </div>

                    <footer className="mt-10 space-y-2 text-center text-xs text-muted-foreground">
                        {company.invoice_footer_text && (
                            <p className="whitespace-pre-line">
                                {company.invoice_footer_text}
                            </p>
                        )}
                        <p>
                            {company.company_name || 'Penawaran'} ·{' '}
                            {quote.quote_number}
                        </p>
                    </footer>
                </div>
            </div>

            <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
                <DialogContent>
                    <form onSubmit={decline} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Tolak penawaran?</DialogTitle>
                            <DialogDescription>
                                Beri tahu {contact} alasannya agar bisa
                                menyesuaikan penawaran berikutnya.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-1.5">
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
                                value={declineForm.data.reason}
                                onChange={(e) =>
                                    declineForm.setData(
                                        'reason',
                                        e.target.value,
                                    )
                                }
                                placeholder="Mis. anggaran belum tersedia"
                            />
                            <InputError message={declineForm.errors.reason} />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDeclineOpen(false)}
                            >
                                Kembali
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={declineForm.processing}
                            >
                                {declineForm.processing && <Spinner />}
                                Tolak penawaran
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
