import {
    ArrowDown,
    ArrowUp,
    Clock,
    FolderKanban,
    ListPlus,
    ListTodo,
    MoreHorizontal,
    Package,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import InputError from '@/components/input-error';
import { ProjectSelect } from '@/components/projects/project-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatIDR, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOption } from '@/types/models';
import { AffixInput } from './parts';
import { lineTotal, rowHours } from './utils';
import type { ItemRow, SessionMap } from './utils';

const ROW_FIELDS = [
    'description',
    'hours_qty',
    'unit_price',
    'session_ids',
    'project_id',
    'task_id',
] as const;

/** Konfigurasi pilihan sub-proyek per baris (null = disembunyikan). */
export type ItemProjectConfig = {
    projects: ProjectOption[];
    clientId: number;
    /** Proyek utama invoice — pilihan dibatasi ke proyek ini + sub-proyeknya. */
    withinProjectId: number;
};

export function ItemsEditor({
    rows,
    isHourly,
    sessions,
    productName,
    projectName,
    itemProjects,
    rowError,
    onChange,
    onRemove,
    onMove,
    onAdd,
}: {
    rows: ItemRow[];
    isHourly: boolean;
    sessions: SessionMap;
    productName: (id: number) => string | undefined;
    /** Nama proyek baris untuk badge (saat pilihan sub-proyek tidak ditampilkan). */
    projectName: (id: number) => string | undefined;
    itemProjects: ItemProjectConfig | null;
    rowError: (key: string, field: string) => string | undefined;
    onChange: (index: number, patch: Partial<ItemRow>) => void;
    onRemove: (index: number) => void;
    onMove: (index: number, direction: -1 | 1) => void;
    /** Tambah baris kosong setelah `afterIndex` (atau di akhir), mewarisi product_id bila diberikan. Mengembalikan key baris baru. */
    onAdd: (afterIndex?: number, productId?: number | null) => string;
}) {
    const focusKey = useRef<string | null>(null);

    useEffect(() => {
        if (!focusKey.current) {
            return;
        }

        document
            .querySelector<HTMLInputElement>(
                `[data-row-desc="${focusKey.current}"]`,
            )
            ?.focus();
        focusKey.current = null;
    }, [rows]);

    const addAndFocus = (afterIndex?: number, productId?: number | null) => {
        focusKey.current = onAdd(afterIndex, productId);
    };

    // Enter di input baris → lompat ke baris berikutnya (buat baru bila baris terakhir), bukan submit form.
    const onEnter = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) {
            return;
        }

        e.preventDefault();
        const next = rows[index + 1];

        if (next) {
            document
                .querySelector<HTMLInputElement>(
                    `[data-row-desc="${next.key}"]`,
                )
                ?.focus();
        } else {
            addAndFocus();
        }
    };

    return (
        <div className="space-y-3">
            {rows.length > 0 && (
                <ol className="divide-y overflow-hidden rounded-lg border">
                    {rows.map((row, index) => {
                        const fromSessions =
                            isHourly && row.session_ids.length > 0;
                        const product =
                            row.product_id !== null
                                ? productName(row.product_id)
                                : undefined;
                        const ids = {
                            desc: `item-${row.key}-desc`,
                            qty: `item-${row.key}-qty`,
                            price: `item-${row.key}-price`,
                            project: `item-${row.key}-project`,
                        };
                        const rowProject =
                            !itemProjects && row.project_id !== null
                                ? projectName(row.project_id)
                                : undefined;
                        const errors = [
                            ...new Set(
                                ROW_FIELDS.map((f) =>
                                    rowError(row.key, f),
                                ).filter((m): m is string => !!m),
                            ),
                        ];

                        return (
                            <li key={row.key} className="space-y-2.5 p-3">
                                <div className="flex items-start gap-2">
                                    <span
                                        className="mt-2 w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
                                        aria-hidden
                                    >
                                        {index + 1}.
                                    </span>
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        {(product ||
                                            fromSessions ||
                                            rowProject ||
                                            row.task_id !== null) && (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {row.task_id !== null && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="max-w-full gap-1 bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300"
                                                        title="Baris dari tugas — hapus baris untuk melepas tugas"
                                                    >
                                                        <ListTodo className="size-3" />{' '}
                                                        <span className="truncate">
                                                            Task
                                                            {row.task_title
                                                                ? `: ${row.task_title}`
                                                                : ''}
                                                        </span>
                                                    </Badge>
                                                )}
                                                {product && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="max-w-full gap-1"
                                                    >
                                                        <Package className="size-3" />{' '}
                                                        <span className="truncate">
                                                            {product}
                                                        </span>
                                                    </Badge>
                                                )}
                                                {fromSessions && (
                                                    <Badge
                                                        variant="outline"
                                                        className="gap-1"
                                                    >
                                                        <Clock className="size-3" />{' '}
                                                        {row.session_ids.length}{' '}
                                                        sesi Time Tracker
                                                    </Badge>
                                                )}
                                                {rowProject && (
                                                    <Badge
                                                        variant="outline"
                                                        className="max-w-full gap-1"
                                                    >
                                                        <FolderKanban className="size-3" />{' '}
                                                        <span className="truncate">
                                                            {rowProject}
                                                        </span>
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                        <label
                                            htmlFor={ids.desc}
                                            className="sr-only"
                                        >
                                            Uraian baris {index + 1}
                                        </label>
                                        <Input
                                            id={ids.desc}
                                            data-row-desc={row.key}
                                            value={row.description}
                                            onChange={(e) =>
                                                onChange(index, {
                                                    description: e.target.value,
                                                })
                                            }
                                            onKeyDown={(e) => onEnter(e, index)}
                                            placeholder={
                                                product
                                                    ? `Detail ${product}`
                                                    : 'Detail pekerjaan / layanan'
                                            }
                                            aria-invalid={
                                                !!rowError(
                                                    row.key,
                                                    'description',
                                                )
                                            }
                                            maxLength={255}
                                        />
                                        {itemProjects && (
                                            <div className="sm:max-w-64">
                                                <label
                                                    htmlFor={ids.project}
                                                    className="sr-only"
                                                >
                                                    Sub-proyek baris {index + 1}
                                                </label>
                                                <ProjectSelect
                                                    id={ids.project}
                                                    projects={
                                                        itemProjects.projects
                                                    }
                                                    clientId={
                                                        itemProjects.clientId
                                                    }
                                                    withinProjectId={
                                                        itemProjects.withinProjectId
                                                    }
                                                    emptyLabel="— (proyek utama)"
                                                    value={row.project_id}
                                                    onChange={(projectId) =>
                                                        onChange(index, {
                                                            project_id:
                                                                projectId ===
                                                                itemProjects.withinProjectId
                                                                    ? null
                                                                    : projectId,
                                                        })
                                                    }
                                                    className="[&_select]:h-8 [&_select]:text-xs"
                                                    aria-invalid={
                                                        !!rowError(
                                                            row.key,
                                                            'project_id',
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-9"
                                                    aria-label={`Aksi baris ${index + 1}`}
                                                >
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    disabled={index === 0}
                                                    onSelect={() =>
                                                        onMove(index, -1)
                                                    }
                                                >
                                                    <ArrowUp className="size-4" />{' '}
                                                    Pindah ke atas
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={
                                                        index ===
                                                        rows.length - 1
                                                    }
                                                    onSelect={() =>
                                                        onMove(index, 1)
                                                    }
                                                >
                                                    <ArrowDown className="size-4" />{' '}
                                                    Pindah ke bawah
                                                </DropdownMenuItem>
                                                {row.product_id !== null &&
                                                    !fromSessions && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    addAndFocus(
                                                                        index,
                                                                        row.product_id,
                                                                    )
                                                                }
                                                            >
                                                                <ListPlus className="size-4" />{' '}
                                                                Tambah uraian
                                                                produk ini
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-9 text-muted-foreground hover:text-destructive"
                                            onClick={() => onRemove(index)}
                                            aria-label={`Hapus baris ${index + 1}`}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-end gap-2 pl-7 sm:flex-nowrap">
                                    {isHourly && (
                                        <div className="w-[calc(50%-0.25rem)] sm:w-32">
                                            <label
                                                htmlFor={ids.qty}
                                                className="mb-1 block text-xs text-muted-foreground"
                                            >
                                                Jumlah jam
                                            </label>
                                            {fromSessions ? (
                                                <div
                                                    id={ids.qty}
                                                    className="flex h-9 items-center justify-end gap-1.5 rounded-md border border-dashed bg-muted/40 px-3 text-sm tabular-nums"
                                                    title="Dihitung otomatis dari durasi sesi"
                                                >
                                                    <Clock className="size-3.5 text-muted-foreground" />
                                                    {formatNumber(
                                                        rowHours(row, sessions),
                                                    )}{' '}
                                                    jam
                                                </div>
                                            ) : (
                                                <AffixInput
                                                    id={ids.qty}
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    step="any"
                                                    suffix="jam"
                                                    placeholder="0"
                                                    className="text-right"
                                                    value={row.hours_qty}
                                                    onChange={(e) =>
                                                        onChange(index, {
                                                            hours_qty:
                                                                e.target.value,
                                                        })
                                                    }
                                                    onKeyDown={(e) =>
                                                        onEnter(e, index)
                                                    }
                                                    aria-invalid={
                                                        !!rowError(
                                                            row.key,
                                                            'hours_qty',
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            isHourly
                                                ? 'w-[calc(50%-0.25rem)] sm:w-40'
                                                : 'w-full sm:w-44',
                                        )}
                                    >
                                        <label
                                            htmlFor={ids.price}
                                            className="mb-1 block text-xs text-muted-foreground"
                                        >
                                            {isHourly
                                                ? 'Tarif per jam'
                                                : 'Harga'}
                                        </label>
                                        <AffixInput
                                            id={ids.price}
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            step="any"
                                            prefix="Rp"
                                            placeholder="0"
                                            className="text-right"
                                            value={row.unit_price}
                                            onChange={(e) =>
                                                onChange(index, {
                                                    unit_price: e.target.value,
                                                })
                                            }
                                            onKeyDown={(e) => onEnter(e, index)}
                                            aria-invalid={
                                                !!rowError(
                                                    row.key,
                                                    'unit_price',
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex h-9 min-w-0 flex-1 items-center justify-between gap-3 sm:justify-end">
                                        <span className="text-xs text-muted-foreground">
                                            Jumlah
                                        </span>
                                        <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                                            {formatIDR(
                                                lineTotal(
                                                    row,
                                                    isHourly,
                                                    sessions,
                                                ),
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {errors.length > 0 && (
                                    <div className="space-y-0.5 pl-7">
                                        {errors.map((msg) => (
                                            <InputError
                                                key={msg}
                                                message={msg}
                                            />
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addAndFocus()}
                className="w-full border-dashed sm:w-auto"
            >
                <Plus className="size-4" /> Tambah baris
            </Button>
        </div>
    );
}
