import { router, usePage } from '@inertiajs/react';
import { Fingerprint, X } from 'lucide-react';
import { useState } from 'react';
import PasskeyRegistration from '@/components/passkey-register';
import { Button } from '@/components/ui/button';

type Props = {
    canManagePasskeys?: boolean;
    passkeyCount: number;
};

function supportsPasskeys(): { supported: boolean; secure: boolean } {
    if (typeof window === 'undefined') {
        return { supported: false, secure: false };
    }

    return {
        supported: typeof window.PublicKeyCredential !== 'undefined',
        secure: window.isSecureContext,
    };
}

/**
 * Ajakan menambah passkey untuk pengguna baru (mis. setelah menerima undangan
 * → /settings/security?welcome=1). Hanya tampil bila belum punya passkey.
 */
export default function PasskeyWelcomePrompt({
    canManagePasskeys,
    passkeyCount,
}: Props) {
    const { url } = usePage();
    const [dismissed, setDismissed] = useState(false);
    const [{ supported, secure }] = useState(supportsPasskeys);

    const welcome =
        new URLSearchParams(url.split('?')[1] ?? '').get('welcome') === '1';

    if (!welcome || dismissed || !canManagePasskeys || passkeyCount > 0) {
        return null;
    }

    if (!secure) {
        return (
            <p className="text-sm text-muted-foreground">
                Passkey membutuhkan HTTPS.
            </p>
        );
    }

    if (!supported) {
        return null;
    }

    return (
        <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-8 text-muted-foreground"
                onClick={() => setDismissed(true)}
                aria-label="Tutup"
            >
                <X className="size-4" />
            </Button>

            <div className="flex items-start gap-3 pr-8">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Fingerprint className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                        Masuk lebih cepat dengan passkey
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Gunakan sidik jari, wajah, atau PIN perangkat — tanpa
                        mengetik password.
                    </p>
                </div>
            </div>

            <div className="mt-4">
                <PasskeyRegistration onSuccess={() => router.reload()} />
            </div>
        </div>
    );
}
