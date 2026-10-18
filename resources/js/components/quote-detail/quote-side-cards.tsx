import { Link } from '@inertiajs/react';
import {
    Check,
    Copy,
    ExternalLink,
    FileOutput,
    Link2,
    MessageSquareText,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SectionCard } from '@/components/invoice-detail/section-card';
import { StatusBadge } from '@/components/invoice-status-badge';
import { Button } from '@/components/ui/button';
import {
    daysFromToday,
    formatDate,
    formatDateTime,
    formatIDR,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { QuoteDetail } from '@/types/quotes';

function Row({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-4 text-sm',
                className,
            )}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium tabular-nums">
                {children}
            </span>
        </div>
    );
}

/** Ringkasan nilai + masa berlaku + riwayat status. */
export function QuoteSummaryCard({
    quote,
    isPastValidity,
}: {
    quote: QuoteDetail;
    isPastValidity: boolean;
}) {
    const diff = daysFromToday(quote.valid_until);
    const waiting = quote.status === 'sent' || quote.status === 'draft';

    return (
        <SectionCard title="Ringkasan" icon={Wallet}>
            <div className="space-y-2.5">
                <div>
                    <p className="text-xs text-muted-foreground">
                        Nilai penawaran
                    </p>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">
                        {formatIDR(quote.total)}
                    </p>
                    {toNumber(quote.pph_amount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Setelah PPh 23 {formatIDR(quote.pph_amount)}
                        </p>
                    )}
                </div>
                <Row label="Berlaku sampai">
                    {formatDate(quote.valid_until, 'Tidak dibatasi')}
                </Row>
                {waiting && diff !== null && (
                    <p
                        className={cn(
                            'text-xs',
                            isPastValidity
                                ? 'font-medium text-red-600 dark:text-red-400'
                                : diff <= 3
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-muted-foreground',
                        )}
                    >
                        {isPastValidity
                            ? `Lewat ${Math.abs(diff)} hari — klien tidak bisa lagi menerima.`
                            : diff === 0
                              ? 'Berakhir hari ini.'
                              : `Berakhir ${diff} hari lagi.`}
                    </p>
                )}
                <div className="space-y-1.5 border-t pt-2.5">
                    {quote.sent_at && (
                        <Row label="Dikirim">
                            {formatDateTime(quote.sent_at)}
                        </Row>
                    )}
                    {quote.accepted_at && (
                        <Row label="Diterima">
                            {formatDateTime(quote.accepted_at)}
                        </Row>
                    )}
                    {quote.declined_at && (
                        <Row label="Ditolak">
                            {formatDateTime(quote.declined_at)}
                        </Row>
                    )}
                    {!quote.sent_at &&
                        !quote.accepted_at &&
                        !quote.declined_at && (
                            <p className="text-xs text-muted-foreground">
                                Belum dikirim ke klien.
                            </p>
                        )}
                </div>
            </div>
        </SectionCard>
    );
}

/** Jawaban klien (nama, catatan, alasan tolak). */
export function QuoteResponseCard({ quote }: { quote: QuoteDetail }) {
    const accepted =
        quote.status === 'accepted' ||
        (quote.status === 'converted' && !!quote.accepted_by);
    const declined = quote.status === 'declined';

    if (
        !(accepted && (quote.accepted_by || quote.response_note)) &&
        !declined
    ) {
        return null;
    }

    return (
        <SectionCard title="Jawaban klien" icon={MessageSquareText}>
            <div className="space-y-2 text-sm">
                {accepted && quote.accepted_by && (
                    <Row label="Disetujui oleh">{quote.accepted_by}</Row>
                )}
                {accepted && quote.response_note && (
                    <p className="rounded-lg bg-muted p-3 whitespace-pre-line">
                        {quote.response_note}
                    </p>
                )}
                {declined && (
                    <p className="rounded-lg bg-muted p-3 whitespace-pre-line">
                        <span className="block text-xs text-muted-foreground">
                            Alasan
                        </span>
                        {quote.decline_reason || 'Tidak ada alasan.'}
                    </p>
                )}
            </div>
        </SectionCard>
    );
}

/** Invoice hasil konversi. */
export function ConvertedInvoiceCard({ quote }: { quote: QuoteDetail }) {
    const inv = quote.converted_invoice;

    if (!inv) {
        return null;
    }

    return (
        <SectionCard title="Invoice" icon={FileOutput}>
            <Link
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
                <span className="min-w-0">
                    <span className="block truncate font-medium">
                        {inv.invoice_number}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {formatIDR(inv.total)}
                    </span>
                </span>
                <StatusBadge status={inv.status} />
            </Link>
        </SectionCard>
    );
}

/** Link publik /q/{token} untuk dibagikan ke klien. */
export function QuoteLinkCard({
    quote,
    url,
}: {
    quote: QuoteDetail;
    url: string;
}) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success('Link penawaran disalin.');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(
                'Gagal menyalin link. Salin manual dari kolom di atas.',
            );
        }
    };

    return (
        <SectionCard title="Link penawaran" icon={Link2}>
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        readOnly
                        value={url}
                        aria-label="Link penawaran publik"
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-9 min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 font-mono text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={copy}
                        aria-label="Salin link"
                    >
                        {copied ? (
                            <Check className="text-emerald-600" />
                        ) : (
                            <Copy />
                        )}
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Buka link penawaran"
                        >
                            <ExternalLink />
                        </a>
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {quote.status === 'draft'
                        ? 'Link belum aktif — klien baru bisa membuka setelah penawaran dikirim.'
                        : quote.status === 'sent'
                          ? 'Klien bisa melihat, menerima, atau menolak penawaran dari link ini.'
                          : 'Klien masih bisa melihat penawaran dari link ini.'}
                </p>
            </div>
        </SectionCard>
    );
}
