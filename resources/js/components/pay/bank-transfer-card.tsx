import { Check, Copy, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Alternatif pembayaran: transfer bank manual (teks bebas dari pengaturan). */
export function BankTransferCard({
    info,
    phone,
}: {
    info: string;
    phone: string | null;
}) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(info);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard tidak tersedia (mis. http) — abaikan */
        }
    };

    return (
        <div className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Landmark className="size-4" />
                    </span>
                    <div>
                        <p className="text-sm font-semibold">Transfer bank</p>
                        <p className="text-xs text-muted-foreground">
                            Alternatif selain QRIS
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={copy}
                    aria-label="Salin info rekening"
                >
                    {copied ? <Check className="text-emerald-600" /> : <Copy />}
                    {copied ? 'Tersalin' : 'Salin'}
                </Button>
            </div>
            <pre className="mt-3 rounded-lg bg-muted/60 p-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
                {info}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
                Setelah transfer, kirim bukti pembayaran ke{' '}
                {phone ? (
                    <a
                        href={`https://wa.me/${waNumber(phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline underline-offset-2"
                    >
                        {phone}
                    </a>
                ) : (
                    'admin'
                )}{' '}
                agar pembayaran dikonfirmasi manual.
            </p>
        </div>
    );
}

function waNumber(phone: string): string {
    let p = phone.replace(/\D/g, '');

    if (p.startsWith('0')) {
        p = '62' + p.slice(1);
    }

    if (p.startsWith('8')) {
        p = '62' + p;
    }

    return p;
}
