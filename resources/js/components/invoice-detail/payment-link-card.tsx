import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SectionCard } from './section-card';
import type { InvoiceDetail } from './types';

/** Link pembayaran publik (QRIS) untuk dibagikan ke klien. */
export function PaymentLinkCard({ invoice }: { invoice: InvoiceDetail }) {
    const [copied, setCopied] = useState(false);
    const url = `${window.location.origin}/pay/${invoice.public_token}`;
    const draft = invoice.status === 'draft';

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success('Link pembayaran disalin.');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(
                'Gagal menyalin link. Salin manual dari kolom di atas.',
            );
        }
    };

    return (
        <SectionCard title="Link pembayaran" icon={Link2}>
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        readOnly
                        value={url}
                        aria-label="Link pembayaran publik"
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
                            aria-label="Buka link pembayaran"
                        >
                            <ExternalLink />
                        </a>
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {draft
                        ? 'Link belum aktif — klien baru bisa membayar setelah invoice dikirim.'
                        : invoice.status === 'cancelled'
                          ? 'Invoice dibatalkan — link tidak lagi menerima pembayaran.'
                          : 'Klien bisa melihat invoice dan membayar via QRIS dari link ini.'}
                </p>
            </div>
        </SectionCard>
    );
}
