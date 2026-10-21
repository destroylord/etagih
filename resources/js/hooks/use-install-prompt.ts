import { useCallback, useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/*
 * Event `beforeinstallprompt` hanya dikirim sekali (sering sebelum komponen
 * apa pun ter-mount), jadi ditangkap di level modul lalu dibagikan lewat
 * useSyncExternalStore.
 */
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e as BeforeInstallPromptEvent;
        emit();
    });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        emit();
    });
}

function subscribe(cb: () => void) {
    listeners.add(cb);

    return () => {
        listeners.delete(cb);
    };
}

function detectIOS(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }

    const ua = navigator.userAgent;

    return (
        /iPad|iPhone|iPod/.test(ua) ||
        // iPadOS 13+ melapor sebagai Mac dengan layar sentuh.
        (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    );
}

function detectStandalone(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export type InstallPrompt = {
    /** Browser sudah mengirim `beforeinstallprompt` → tombol "Pasang aplikasi" bisa tampil. */
    canInstall: boolean;
    /** Tampilkan dialog pemasangan bawaan browser. */
    install: () => Promise<boolean>;
    /** iOS Safari belum terpasang → tampilkan petunjuk "Add to Home Screen". */
    showIOSHint: boolean;
    isIOS: boolean;
    isStandalone: boolean;
};

export function useInstallPrompt(): InstallPrompt {
    const event = useSyncExternalStore(
        subscribe,
        () => deferred,
        () => null,
    );
    const isIOS = detectIOS();
    const isStandalone = detectStandalone();

    const install = useCallback(async () => {
        if (!deferred) {
            return false;
        }

        const e = deferred;
        await e.prompt();
        const { outcome } = await e.userChoice;
        deferred = null;
        emit();

        return outcome === 'accepted';
    }, []);

    return {
        canInstall: event !== null && !isStandalone,
        install,
        showIOSHint: isIOS && !isStandalone,
        isIOS,
        isStandalone,
    };
}
