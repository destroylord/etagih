import { CheckCircle2, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SuccessInfo } from './types';

export function PaymentSuccessDialog({
    success,
    onClose,
}: {
    success: SuccessInfo | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={success !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="items-center text-center sm:text-center">
                    <div className="mx-auto mb-2 grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        {success?.fullyPaid ? (
                            <PartyPopper className="size-8" />
                        ) : (
                            <CheckCircle2 className="size-8" />
                        )}
                    </div>
                    <DialogTitle className="text-xl">
                        {success?.fullyPaid
                            ? 'Pembayaran berhasil!'
                            : 'Pembayaran diterima'}
                    </DialogTitle>
                    <DialogDescription>
                        {success?.fullyPaid
                            ? `Invoice ${success.invoiceNumber} sudah lunas. Terima kasih atas pembayarannya.`
                            : success?.scheduleSequence
                              ? `Cicilan ke-${success.scheduleSequence} untuk invoice ${success.invoiceNumber} sudah diterima.`
                              : `Pembayaran untuk invoice ${success?.invoiceNumber ?? ''} sudah diterima.`}
                    </DialogDescription>
                </DialogHeader>

                <dl className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">
                            Nominal dibayar
                        </dt>
                        <dd className="font-semibold tabular-nums">
                            {formatIDR(success?.amount ?? 0)}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Total invoice</dt>
                        <dd className="tabular-nums">
                            {formatIDR(success?.total ?? 0)}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t pt-2">
                        <dt className="text-muted-foreground">Sisa tagihan</dt>
                        <dd
                            className={cn(
                                'font-semibold tabular-nums',
                                (success?.newRemaining ?? 0) > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400',
                            )}
                        >
                            {formatIDR(success?.newRemaining ?? 0)}
                        </dd>
                    </div>
                </dl>

                <DialogFooter className="sm:justify-center">
                    <Button onClick={onClose} className="w-full sm:w-auto">
                        {success?.fullyPaid ? 'Tutup' : 'Lanjut'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
