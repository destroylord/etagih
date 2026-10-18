import { usePage } from '@inertiajs/react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useClipboard } from '@/hooks/use-clipboard';

type NewKey = { client_id: number; key: string } | null;

/**
 * Kunci portal klien hanya disimpan dalam bentuk hash, jadi plaintext-nya
 * ditampilkan SEKALI setelah dibuat (flash `newAccessKey` dari server).
 * Dipasang global di layout aplikasi.
 */
export function AccessKeyDialog() {
    const { newAccessKey } = usePage<{ newAccessKey?: NewKey }>().props;
    // State diikat ke kunci: kunci baru otomatis membuka dialog lagi,
    // kunci yang sudah ditutup tidak muncul ulang.
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [, copy] = useClipboard();
    const portalUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

    const key = newAccessKey?.key ?? null;

    if (!key) {
        return null;
    }

    const open = key !== dismissedKey;
    const copied = key === copiedKey;
    const close = () => setDismissedKey(key);

    const handleCopy = async () => {
        if (await copy(key)) {
            setCopiedKey(key);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <KeyRound className="size-5" />
                    </span>
                    <DialogTitle>Kunci akses portal klien</DialogTitle>
                    <DialogDescription>
                        Bagikan kunci ini ke klien untuk masuk ke portal di{' '}
                        <span className="font-medium">{portalUrl}</span>. Kunci
                        hanya ditampilkan <strong>sekali</strong> — salin
                        sekarang. Jika hilang, buat kunci baru.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                    <code className="flex-1 font-mono text-sm break-all">
                        {key}
                    </code>
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                        {copied ? (
                            <Check className="size-4" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                        {copied ? 'Tersalin' : 'Salin'}
                    </Button>
                </div>
                <DialogFooter>
                    <Button onClick={close}>Selesai</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
