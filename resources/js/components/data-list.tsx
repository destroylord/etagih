import { Link, router } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type DataListColumn<T> = {
    /** Kunci unik kolom. */
    key: string;
    header: ReactNode;
    cell: (item: T) => ReactNode;
    /** Kelas untuk <th> & <td>, mis. 'text-right' / 'w-12'. */
    className?: string;
    headClassName?: string;
    /** Klik di sel ini tidak memicu navigasi baris (mis. kolom aksi). */
    stopPropagation?: boolean;
};

/**
 * Daftar data responsif: tabel shadcn di ≥ md, tumpukan kartu yang bisa
 * diketuk di mobile. Keduanya dirender (disembunyikan via CSS) agar tidak
 * ada lompatan layout saat hidrasi.
 *
 *   <DataList
 *       items={invoices.data}
 *       getKey={(i) => i.id}
 *       href={(i) => show.url(i.id)}
 *       columns={[{ key: 'no', header: 'Nomor', cell: (i) => i.invoice_number }]}
 *       renderCard={(i) => <InvoiceCard invoice={i} />}
 *       empty={<EmptyState title="Belum ada invoice" />}
 *   />
 */
export function DataList<T>({
    items,
    columns,
    renderCard,
    renderCardActions,
    getKey,
    empty,
    href,
    onRowClick,
    rowClassName,
    className,
    tableClassName,
    cardListClassName,
}: {
    items: T[];
    columns: DataListColumn<T>[];
    renderCard: (item: T) => ReactNode;
    /** Aksi (mis. menu ⋯) di kanan kartu mobile, di luar area tautan. */
    renderCardActions?: (item: T) => ReactNode;
    getKey: (item: T) => string | number;
    empty?: ReactNode;
    /** Baris & kartu menjadi tautan ke URL ini. */
    href?: (item: T) => string | undefined;
    onRowClick?: (item: T) => void;
    rowClassName?: (item: T) => string | undefined;
    className?: string;
    tableClassName?: string;
    cardListClassName?: string;
}) {
    if (items.length === 0) {
        return <>{empty ?? null}</>;
    }

    const interactive = !!href || !!onRowClick;

    const activate = (item: T) => {
        if (onRowClick) {
            onRowClick(item);

            return;
        }

        const url = href?.(item);

        if (url) {
            router.visit(url);
        }
    };

    return (
        <div className={className}>
            <div className="hidden md:block">
                <Table className={tableClassName}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {columns.map((col) => (
                                <TableHead
                                    key={col.key}
                                    className={cn(
                                        col.className,
                                        col.headClassName,
                                    )}
                                >
                                    {col.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow
                                key={getKey(item)}
                                className={cn(
                                    interactive && 'cursor-pointer',
                                    rowClassName?.(item),
                                )}
                                onClick={
                                    interactive
                                        ? (e) => {
                                              // Biarkan tautan/tombol di dalam sel bekerja sendiri.
                                              if (
                                                  (
                                                      e.target as HTMLElement
                                                  ).closest(
                                                      'a,button,input,label,[role=menuitem],[data-no-row-click]',
                                                  )
                                              ) {
                                                  return;
                                              }

                                              activate(item);
                                          }
                                        : undefined
                                }
                            >
                                {columns.map((col) => (
                                    <TableCell
                                        key={col.key}
                                        className={col.className}
                                        data-no-row-click={
                                            col.stopPropagation ? '' : undefined
                                        }
                                    >
                                        {col.cell(item)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ul className={cn('divide-y md:hidden', cardListClassName)}>
                {items.map((item) => {
                    const url = href?.(item);
                    const content = renderCard(item);
                    const actions = renderCardActions?.(item);

                    return (
                        <li
                            key={getKey(item)}
                            className={cn(
                                'flex items-center',
                                rowClassName?.(item),
                            )}
                        >
                            {url ? (
                                <Link
                                    href={url}
                                    className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-4 py-3 transition-colors active:bg-accent"
                                >
                                    <div className="min-w-0 flex-1">
                                        {content}
                                    </div>
                                    {!actions && (
                                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                    )}
                                </Link>
                            ) : onRowClick ? (
                                <button
                                    type="button"
                                    onClick={() => onRowClick(item)}
                                    className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left transition-colors active:bg-accent"
                                >
                                    <div className="min-w-0 flex-1">
                                        {content}
                                    </div>
                                </button>
                            ) : (
                                <div className="min-h-14 min-w-0 flex-1 px-4 py-3">
                                    {content}
                                </div>
                            )}
                            {actions && (
                                <div className="shrink-0 pr-2">{actions}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/**
 * Tata letak kartu standar untuk `renderCard`: judul + subjudul di kiri,
 * nilai (mis. nominal) + badge di kanan atas, baris meta di bawah.
 */
export function DataCard({
    title,
    subtitle,
    value,
    badge,
    meta,
    actions,
    className,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    value?: ReactNode;
    badge?: ReactNode;
    meta?: ReactNode;
    /** Elemen interaktif (menu ⋯) di kanan; jangan dipakai bersama `href`. */
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 items-start gap-3', className)}>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate font-medium">{title}</p>
                        {subtitle && (
                            <p className="truncate text-sm text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {(value !== undefined || badge) && (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            {value !== undefined && (
                                <span className="font-semibold tabular-nums">
                                    {value}
                                </span>
                            )}
                            {badge}
                        </div>
                    )}
                </div>
                {meta && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {meta}
                    </div>
                )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </div>
    );
}
