import { Link, usePage } from '@inertiajs/react';
import { ArrowUpCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type UpdateAvailable = {
    current: string;
    latest: string;
    url: string | null;
} | null;

const STORAGE_KEY = 'etagih:update-dismissed';

/**
 * Banner kecil di dashboard (admin) saat ada versi eTagih baru.
 * Data dari shared prop `updateAvailable` (hanya dari cache server).
 * Bisa ditutup; muncul lagi bila ada versi yang lebih baru lagi.
 */
export function UpdateBanner() {
    const update = usePage().props.updateAvailable as UpdateAvailable;
    const [dismissed, setDismissed] = useState<string | null>(() =>
        typeof window === 'undefined'
            ? null
            : window.localStorage.getItem(STORAGE_KEY),
    );

    if (!update || dismissed === update.latest) {
        return null;
    }

    const dismiss = () => {
        window.localStorage.setItem(STORAGE_KEY, update.latest);
        setDismissed(update.latest);
    };

    return (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <ArrowUpCircle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">
                eTagih <span className="font-semibold">{update.latest}</span>{' '}
                sudah tersedia (Anda memakai {update.current}).{' '}
                <Link
                    href="/settings/system"
                    className="font-medium underline underline-offset-4"
                >
                    Lihat cara update
                </Link>
            </p>
            <Button
                variant="ghost"
                size="icon"
                className="-my-1 size-7 text-current hover:bg-amber-100 dark:hover:bg-amber-500/20"
                onClick={dismiss}
                aria-label="Tutup"
            >
                <X className="size-4" />
            </Button>
        </div>
    );
}
