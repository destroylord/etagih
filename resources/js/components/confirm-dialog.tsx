import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

/**
 * Dialog konfirmasi pengganti `window.confirm`. `onConfirm` boleh async /
 * menerima `done` callback — dialog menutup setelah selesai.
 *
 * Contoh:
 *   <ConfirmDialog
 *     trigger={<Button variant="destructive">Hapus</Button>}
 *     title="Hapus invoice?"
 *     description="Tindakan ini tidak bisa dibatalkan."
 *     confirmLabel="Hapus"
 *     destructive
 *     onConfirm={(done) => router.delete(url, { onFinish: done })}
 *   />
 */
export function ConfirmDialog({
    trigger,
    title,
    description,
    confirmLabel = 'Lanjutkan',
    cancelLabel = 'Kembali',
    destructive = false,
    onConfirm,
    children,
    confirmDisabled = false,
    open: controlledOpen,
    onOpenChange,
}: {
    trigger?: ReactNode;
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: (done: () => void) => void | Promise<void>;
    /** Isi tambahan, mis. input alasan. */
    children?: ReactNode;
    confirmDisabled?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = (v: boolean) => {
        if (busy) {
            return;
        }

        setInternalOpen(v);
        onOpenChange?.(v);
    };

    const done = () => {
        setBusy(false);
        setInternalOpen(false);
        onOpenChange?.(false);
    };

    const handleConfirm = async () => {
        setBusy(true);

        try {
            await onConfirm(done);
        } catch {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                {children}
                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={handleConfirm}
                        disabled={busy || confirmDisabled}
                    >
                        {busy && <Spinner />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
