import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, Clock, Info, XCircle } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/page-header';
import { QuoteActions } from '@/components/quote-detail/quote-actions';
import { QuotePaper } from '@/components/quote-detail/quote-paper';
import {
    ConvertedInvoiceCard,
    QuoteLinkCard,
    QuoteResponseCard,
    QuoteSummaryCard,
} from '@/components/quote-detail/quote-side-cards';
import { QuoteStatusBadge } from '@/components/quote-detail/quote-status-badge';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import type { QuoteDetail, QuoteSettings } from '@/types/quotes';

function Banner({
    tone,
    icon: Icon,
    children,
}: {
    tone: 'muted' | 'ok' | 'bad' | 'warn';
    icon: typeof Info;
    children: React.ReactNode;
}) {
    const style = {
        muted: 'border bg-muted/50 text-muted-foreground',
        ok: 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
        bad: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
        warn: 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
    }[tone];

    return (
        <div
            role="status"
            className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${style}`}
        >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

export default function QuotesShow({
    quote,
    settings,
    publicUrl,
    isPastValidity = false,
}: {
    quote: QuoteDetail;
    settings?: QuoteSettings;
    publicUrl: string;
    isPastValidity?: boolean;
}) {
    return (
        <>
            <Head title={`Penawaran ${quote.quote_number}`} />
            <PageContainer>
                <PageHeader
                    backHref="/quotes"
                    title={quote.quote_number}
                    meta={<QuoteStatusBadge status={quote.status} />}
                    description={
                        <>
                            {quote.client ? (
                                <Link
                                    href={`/clients/${quote.client.id}`}
                                    className="font-medium text-foreground hover:underline"
                                >
                                    {quote.client.name}
                                </Link>
                            ) : (
                                'Tanpa klien'
                            )}
                            {quote.project && (
                                <>
                                    {' · '}
                                    <Link
                                        href={`/projects/${quote.project.id}`}
                                        className="hover:underline"
                                    >
                                        {quote.project.parent
                                            ? `${quote.project.parent.name} › ${quote.project.name}`
                                            : quote.project.name}
                                    </Link>
                                </>
                            )}
                            {' · '}
                            <span className="tabular-nums">
                                {formatIDR(quote.total)}
                            </span>
                            {' · '}
                            {formatDate(quote.issue_date)}
                        </>
                    }
                    actions={
                        <QuoteActions
                            quote={quote}
                            isPastValidity={isPastValidity}
                        />
                    }
                />

                {quote.status === 'draft' && (
                    <Banner tone="muted" icon={Info}>
                        <p>
                            Ini masih{' '}
                            <span className="font-medium text-foreground">
                                draft
                            </span>{' '}
                            — klien belum menerima apa pun. Periksa isinya lalu
                            klik{' '}
                            <span className="font-medium text-foreground">
                                Kirim ke klien
                            </span>
                            .
                        </p>
                    </Banner>
                )}
                {quote.status === 'sent' && isPastValidity && (
                    <Banner tone="warn" icon={Clock}>
                        <p className="font-semibold">
                            Masa berlaku sudah lewat (
                            {formatDate(quote.valid_until)})
                        </p>
                        <p>
                            Klien tidak bisa lagi menerima secara online. Tandai
                            diterima manual bila klien tetap setuju, atau
                            duplikat untuk penawaran baru.
                        </p>
                    </Banner>
                )}
                {quote.status === 'accepted' && (
                    <Banner tone="ok" icon={CheckCircle2}>
                        <p className="font-semibold">
                            Penawaran diterima
                            {quote.accepted_at &&
                                ` pada ${formatDateTime(quote.accepted_at)}`}
                            {quote.accepted_by && ` oleh ${quote.accepted_by}`}
                        </p>
                        <p>
                            Lanjutkan dengan{' '}
                            <span className="font-medium">
                                Ubah jadi invoice
                            </span>{' '}
                            untuk menagih klien.
                        </p>
                    </Banner>
                )}
                {quote.status === 'declined' && (
                    <Banner tone="bad" icon={XCircle}>
                        <p className="font-semibold">
                            Penawaran ditolak
                            {quote.declined_at &&
                                ` pada ${formatDateTime(quote.declined_at)}`}
                        </p>
                        <p>
                            {quote.decline_reason
                                ? `Alasan: ${quote.decline_reason}`
                                : 'Tidak ada alasan yang dicatat.'}
                        </p>
                    </Banner>
                )}
                {quote.status === 'expired' && (
                    <Banner tone="muted" icon={Clock}>
                        <p>
                            Penawaran kedaluwarsa pada{' '}
                            {formatDate(quote.valid_until)} tanpa jawaban klien.
                            Duplikat untuk mengirim penawaran baru.
                        </p>
                    </Banner>
                )}

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="min-w-0">
                        <QuotePaper quote={quote} settings={settings} />
                    </div>

                    <aside className="grid gap-4">
                        <QuoteSummaryCard
                            quote={quote}
                            isPastValidity={isPastValidity}
                        />
                        <ConvertedInvoiceCard quote={quote} />
                        <QuoteResponseCard quote={quote} />
                        <QuoteLinkCard quote={quote} url={publicUrl} />
                    </aside>
                </div>
            </PageContainer>
        </>
    );
}
