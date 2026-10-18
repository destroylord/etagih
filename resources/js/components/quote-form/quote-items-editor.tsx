import {
    ArrowDown,
    ArrowUp,
    FolderKanban,
    MoreHorizontal,
    Package,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import InputError from '@/components/input-error';
import { AffixInput } from '@/components/invoice-form/parts';
import { ProjectSelect } from '@/components/projects/project-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatIDR } from '@/lib/format';
import type { ProjectOption } from '@/types/models';
import { quoteLineTotal } from './utils';
import type { QuoteItemRow } from './utils';

const ROW_FIELDS = [
    'description',
    'quantity',
    'unit_price',
    'project_id',
    'product_id',
] as const;

export type QuoteItemProjectConfig = {
    projects: ProjectOption[];
    clientId: number;
    withinProjectId: number;
};

/**
 * Editor baris penawaran: uraian, qty, harga satuan → jumlah.
 * Turunan sederhana dari ItemsEditor invoice (tanpa sesi Time Tracker).
 */
export function QuoteItemsEditor({
    rows,
    productName,
    projectName,
    itemProjects,
    rowError,
    onChange,
    onRemove,
    onMove,
    onAdd,
}: {
    rows: QuoteItemRow[];
    productName: (id: number) => string | undefined;
    projectName: (id: number) => string | undefined;
    itemProjects: QuoteItemProjectConfig | null;
    rowError: (key: string, field: string) => string | undefined;
    onChange: (index: number, patch: Partial<QuoteItemRow>) => void;
    onRemove: (index: number) => void;
    onMove: (index: number, direction: -1 | 1) => void;
    /** Tambah baris kosong di akhir. Mengembalikan key baris baru. */
    onAdd: () => string;
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

    const addAndFocus = () => {
        focusKey.current = onAdd();
    };

    // Enter → pindah ke baris berikutnya (atau buat baris baru), bukan submit form.
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
                        const product =
                            row.product_id !== null
                                ? productName(row.product_id)
                                : undefined;
                        const rowProject =
                            !itemProjects && row.project_id !== null
                                ? projectName(row.project_id)
                                : undefined;
                        const ids = {
                            desc: `qitem-${row.key}-desc`,
                            qty: `qitem-${row.key}-qty`,
                            price: `qitem-${row.key}-price`,
                            project: `qitem-${row.key}-project`,
                        };
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
                                        {(product || rowProject) && (
                                            <div className="flex flex-wrap items-center gap-1.5">
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
                                                    : 'Pekerjaan / layanan yang ditawarkan'
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
                                    <div className="w-[calc(40%-0.25rem)] sm:w-24">
                                        <label
                                            htmlFor={ids.qty}
                                            className="mb-1 block text-xs text-muted-foreground"
                                        >
                                            Qty
                                        </label>
                                        <Input
                                            id={ids.qty}
                                            type="number"
                                            inputMode="decimal"
                                            min={0.01}
                                            step="any"
                                            className="text-right tabular-nums"
                                            value={row.quantity}
                                            onChange={(e) =>
                                                onChange(index, {
                                                    quantity: e.target.value,
                                                })
                                            }
                                            onKeyDown={(e) => onEnter(e, index)}
                                            aria-invalid={
                                                !!rowError(row.key, 'quantity')
                                            }
                                        />
                                    </div>
                                    <div className="w-[calc(60%-0.25rem)] sm:w-44">
                                        <label
                                            htmlFor={ids.price}
                                            className="mb-1 block text-xs text-muted-foreground"
                                        >
                                            Harga satuan
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
                                            {formatIDR(quoteLineTotal(row))}
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
                onClick={addAndFocus}
                className="w-full border-dashed sm:w-auto"
            >
                <Plus className="size-4" /> Tambah baris
            </Button>
        </div>
    );
}
