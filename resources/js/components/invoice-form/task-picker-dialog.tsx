import { CheckSquare, FolderKanban, ListTodo } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatIDR, formatNumber } from '@/lib/format';
import { getJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { billableTasks } from '@/routes/invoices';
import type { BillableTask, BillableTasksResponse } from '@/types/tasks';

/**
 * Dialog multi-pilih tugas selesai yang bisa ditagih (belum masuk invoice)
 * untuk klien terpilih. Data diambil saat dialog dibuka dari
 * `invoices.billable-tasks`; saat edit, `invoiceId` ikut dikirim supaya tugas
 * yang sudah ada di invoice ini tetap muncul.
 */
export function TaskPickerDialog({
    clientId,
    invoiceId,
    isHourly,
    linkedTaskIds,
    onAdd,
}: {
    clientId: number | null;
    invoiceId?: number | null;
    isHourly: boolean;
    /** Tugas yang sudah menjadi baris item di form. */
    linkedTaskIds: Set<number>;
    onAdd: (tasks: BillableTask[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [tasks, setTasks] = useState<BillableTask[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<number[]>([]);

    const load = (id: number) => {
        setTasks(null);
        setError(null);
        getJson<BillableTasksResponse>(
            billableTasks.url({
                query: {
                    client_id: id,
                    ...(invoiceId ? { invoice_id: invoiceId } : {}),
                },
            }),
        )
            .then((res) => setTasks(res.tasks))
            .catch((e: Error) => {
                setTasks([]);
                setError(e.message || 'Gagal memuat tugas.');
            });
    };

    const onOpenChange = (next: boolean) => {
        setOpen(next);

        if (next && clientId !== null) {
            setSelected([]);
            load(clientId);
        }
    };

    const toggle = (id: number, checked: boolean) =>
        setSelected((prev) =>
            checked
                ? [...new Set([...prev, id])]
                : prev.filter((x) => x !== id),
        );

    const available = (tasks ?? []).filter((t) => !linkedTaskIds.has(t.id));
    const allSelected =
        available.length > 0 && selected.length === available.length;

    const apply = () => {
        const chosen = (tasks ?? []).filter((t) => selected.includes(t.id));

        if (chosen.length) {
            onAdd(chosen);
        }

        setOpen(false);
    };

    /** Nominal saran sesuai mode invoice saat ini. */
    const amountOf = (t: BillableTask) => {
        if (!isHourly) {
            return t.suggested.fixed.unit_price;
        }

        const line = t.suggested.hourly;
        const hours =
            line.hours_qty === null || line.hours_qty === undefined
                ? t.hours
                : line.hours_qty;

        return hours * line.unit_price;
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={clientId === null}
                title={
                    clientId === null
                        ? 'Pilih client terlebih dulu'
                        : 'Tambahkan tugas selesai yang belum ditagih'
                }
                onClick={() => onOpenChange(true)}
            >
                <ListTodo className="size-4" /> Ambil dari task
            </Button>
            <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>
                        Ambil dari Task
                    </ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                        Tugas selesai yang bisa ditagih dan belum masuk invoice.
                        Setiap tugas menjadi satu baris item
                        {isHourly
                            ? ' (jam dari sesi Time Tracker tugas).'
                            : ' (harga tetap tugas atau jam × tarif).'}
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>

                {tasks === null ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                        <Spinner /> Memuat tugas…
                    </div>
                ) : error ? (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                        {error}
                    </p>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        <CheckSquare className="size-6" />
                        Tidak ada tugas selesai yang belum ditagih untuk client
                        ini.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {available.length > 1 && (
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    {selected.length}/{available.length} dipilih
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7"
                                    onClick={() =>
                                        setSelected(
                                            allSelected
                                                ? []
                                                : available.map((t) => t.id),
                                        )
                                    }
                                >
                                    {allSelected ? 'Kosongkan' : 'Pilih semua'}
                                </Button>
                            </div>
                        )}
                        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                            {tasks.map((t) => {
                                const linked = linkedTaskIds.has(t.id);
                                const checked = selected.includes(t.id);
                                const id = `task-pick-${t.id}`;

                                return (
                                    <li key={t.id}>
                                        <label
                                            htmlFor={id}
                                            className={cn(
                                                'flex items-start gap-3 rounded-lg border p-2.5 transition-colors',
                                                linked
                                                    ? 'cursor-default opacity-60'
                                                    : 'cursor-pointer',
                                                checked
                                                    ? 'border-primary bg-primary/5'
                                                    : !linked &&
                                                          'hover:bg-muted/50',
                                            )}
                                        >
                                            <Checkbox
                                                id={id}
                                                className="mt-0.5"
                                                checked={checked || linked}
                                                disabled={linked}
                                                onCheckedChange={(c) =>
                                                    toggle(t.id, c === true)
                                                }
                                            />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="text-sm leading-snug font-medium">
                                                    {t.title}
                                                </p>
                                                <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                                                    <FolderKanban className="size-3 shrink-0" />
                                                    <span className="truncate">
                                                        {t.project_full_name}
                                                    </span>
                                                </p>
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                                                    {t.hours > 0 && (
                                                        <span>
                                                            {formatNumber(
                                                                t.hours,
                                                            )}{' '}
                                                            jam
                                                        </span>
                                                    )}
                                                    {t.fixed_price !== null && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="font-normal"
                                                        >
                                                            Harga tetap{' '}
                                                            {formatIDR(
                                                                t.fixed_price,
                                                            )}
                                                        </Badge>
                                                    )}
                                                    {t.completed_at && (
                                                        <span>
                                                            Selesai{' '}
                                                            {formatDate(
                                                                t.completed_at,
                                                            )}
                                                        </span>
                                                    )}
                                                    {linked && (
                                                        <Badge variant="outline">
                                                            Sudah di invoice
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">
                                                {formatIDR(amountOf(t))}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <ResponsiveDialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        onClick={apply}
                        disabled={selected.length === 0}
                    >
                        Tambahkan{' '}
                        {selected.length > 0 ? `${selected.length} task` : ''}
                    </Button>
                </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
