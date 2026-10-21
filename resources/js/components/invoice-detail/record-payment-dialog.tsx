import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useEffect } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatIDR, toNumber, todayISO } from '@/lib/format';
import type { InvoiceDetail } from './types';
import { remainingOf } from './types';

const NO_SCHEDULE = 'none';

/** Dialog "Catat pembayaran" manual (transfer bank, tunai, dll). */
export function RecordPaymentDialog({
    invoice,
    open,
    onOpenChange,
}: {
    invoice: InvoiceDetail;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const remaining = remainingOf(invoice);
    const openSchedules = invoice.schedules.filter((s) => s.status !== 'paid');

    const form = useForm({
        amount: '',
        paid_at: todayISO(),
        schedule_id: NO_SCHEDULE,
        notes: '',
    });

    // Reset tiap kali dialog dibuka, default ke cicilan berikutnya (atau sisa tagihan).
    useEffect(() => {
        if (!open) {
            return;
        }

        const next = openSchedules[0];
        form.setData({
            amount: String(
                next ? Math.min(toNumber(next.amount), remaining) : remaining,
            ),
            paid_at: todayISO(),
            schedule_id: next ? String(next.id) : NO_SCHEDULE,
            notes: '',
        });
        form.clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const selectSchedule = (value: string) => {
        const schedule = openSchedules.find((s) => String(s.id) === value);
        form.setData((data) => ({
            ...data,
            schedule_id: value,
            amount: schedule
                ? String(Math.min(toNumber(schedule.amount), remaining))
                : data.amount,
        }));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            schedule_id:
                data.schedule_id === NO_SCHEDULE
                    ? null
                    : Number(data.schedule_id),
            notes: data.notes.trim() || null,
        }));
        form.post(`/invoices/${invoice.id}/payments`, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    const amount = toNumber(form.data.amount);
    const overLimit = amount > remaining;

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={(v) => !form.processing && onOpenChange(v)}
        >
            <ResponsiveDialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="grid gap-5">
                    <ResponsiveDialogHeader>
                        <ResponsiveDialogTitle>
                            Catat pembayaran
                        </ResponsiveDialogTitle>
                        <ResponsiveDialogDescription>
                            Untuk pembayaran di luar QRIS, mis. transfer bank
                            atau tunai. Sisa tagihan{' '}
                            <span className="font-medium text-foreground tabular-nums">
                                {formatIDR(remaining)}
                            </span>
                            .
                        </ResponsiveDialogDescription>
                    </ResponsiveDialogHeader>

                    {openSchedules.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="schedule_id">Untuk cicilan</Label>
                            <Select
                                value={form.data.schedule_id}
                                onValueChange={selectSchedule}
                            >
                                <SelectTrigger
                                    id="schedule_id"
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_SCHEDULE}>
                                        Tanpa cicilan tertentu
                                    </SelectItem>
                                    {openSchedules.map((s) => (
                                        <SelectItem
                                            key={s.id}
                                            value={String(s.id)}
                                        >
                                            Cicilan {s.sequence} ·{' '}
                                            {formatIDR(s.amount)} ·{' '}
                                            {formatDate(s.due_date)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.schedule_id} />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="amount">Nominal (Rp)</Label>
                        <Input
                            id="amount"
                            type="number"
                            inputMode="decimal"
                            min={1}
                            step="any"
                            max={remaining}
                            required
                            autoFocus
                            value={form.data.amount}
                            onChange={(e) =>
                                form.setData('amount', e.target.value)
                            }
                            aria-invalid={!!form.errors.amount || overLimit}
                            className="tabular-nums"
                        />
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                                {amount > 0 ? formatIDR(amount) : ' '}
                            </span>
                            {amount !== remaining && remaining > 0 && (
                                <button
                                    type="button"
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                    onClick={() =>
                                        form.setData(
                                            'amount',
                                            String(remaining),
                                        )
                                    }
                                >
                                    Isi sisa tagihan
                                </button>
                            )}
                        </div>
                        <InputError
                            message={
                                form.errors.amount ??
                                (overLimit
                                    ? 'Nominal melebihi sisa tagihan.'
                                    : undefined)
                            }
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="paid_at">Tanggal bayar</Label>
                        <Input
                            id="paid_at"
                            type="date"
                            max={todayISO()}
                            required
                            value={form.data.paid_at}
                            onChange={(e) =>
                                form.setData('paid_at', e.target.value)
                            }
                            aria-invalid={!!form.errors.paid_at}
                        />
                        <InputError message={form.errors.paid_at} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">
                            Catatan{' '}
                            <span className="font-normal text-muted-foreground">
                                (opsional)
                            </span>
                        </Label>
                        <Textarea
                            id="notes"
                            rows={2}
                            maxLength={500}
                            placeholder="Mis. Transfer BCA a.n. Budi"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                        />
                        <InputError message={form.errors.notes} />
                    </div>

                    <ResponsiveDialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={form.processing}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                form.processing || amount <= 0 || overLimit
                            }
                        >
                            {form.processing && <Spinner />}
                            Simpan pembayaran
                        </Button>
                    </ResponsiveDialogFooter>
                </form>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
