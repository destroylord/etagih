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
import type { TemporaryPassword } from './types';

/**
 * Password sementara hanya ditampilkan SEKALI setelah pengguna dibuat
 * (flash `temporaryPassword` dari server). Pola sama dengan AccessKeyDialog.
 */
export function TemporaryPasswordDialog({
    value,
}: {
    value: TemporaryPassword | null;
}) {
    const [dismissed, setDismissed] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [, copy] = useClipboard();

    const password = value?.password ?? null;

    if (!value || !password) {
        return null;
    }

    const close = () => setDismissed(password);
    const handleCopy = async () => {
        if (await copy(password)) {
            setCopied(password);
        }
    };

    return (
        <Dialog
            open={password !== dismissed}
            onOpenChange={(v) => !v && close()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <KeyRound className="size-5" />
                    </span>
                    <DialogTitle>Password sementara</DialogTitle>
                    <DialogDescription>
                        Berikan password ini ke{' '}
                        <span className="font-medium">{value.name}</span> (
                        {value.email}). Password hanya ditampilkan{' '}
                        <strong>sekali</strong> — salin sekarang. Minta pengguna
                        menggantinya di Pengaturan → Keamanan setelah masuk.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                    <code className="flex-1 font-mono text-sm break-all">
                        {password}
                    </code>
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                        {copied === password ? (
                            <Check className="size-4" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                        {copied === password ? 'Tersalin' : 'Salin'}
                    </Button>
                </div>
                <DialogFooter>
                    <Button onClick={close}>Selesai</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
