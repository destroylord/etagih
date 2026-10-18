import { Link } from '@inertiajs/react';
import { ExternalLink, FilePlus2, Receipt } from 'lucide-react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { dueLabel, formatDate, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Invoice, Paginated } from '@/types/models';
import { invoiceRemaining, projectPath } from './project-helpers';

const OPEN_STATUSES = ['sent', 'partial', 'overdue'];

export function ProjectInvoicesCard({
    invoices,
    projectId,
    createHref,
}: {
    invoices: Paginated<Invoice>;
    projectId: number;
    createHref: string;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="size-4 text-muted-foreground" /> Invoice
                </CardTitle>
                <div className="flex items-center gap-1">
                    {invoices.total > 0 && (
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={`/invoices?project_id=${projectId}`}>
                                Lihat semua <ExternalLink />
                            </Link>
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={createHref}>
                            <FilePlus2 /> Baru
                        </Link>
                    </Button>
                </div>
            </CardHeader>

            {invoices.data.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="Belum ada invoice"
                    description="Invoice yang ditautkan ke proyek ini (atau punya item untuknya) akan muncul di sini."
                    action={
                        <Button asChild>
                            <Link href={createHref}>
                                <FilePlus2 /> Buat invoice
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    {/* Desktop */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="pl-4 sm:pl-6">
                                        No. invoice
                                    </TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Total
                                    </TableHead>
                                    <TableHead className="pr-4 text-right sm:pr-6">
                                        Sisa
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.data.map((inv) => {
                                    const remaining = invoiceRemaining(inv);
                                    const due = OPEN_STATUSES.includes(
                                        inv.status,
                                    )
                                        ? dueLabel(inv.due_date)
                                        : null;
                                    const path = projectPath(inv.project);

                                    return (
                                        <TableRow key={inv.id}>
                                            <TableCell className="max-w-56 pl-4 sm:pl-6">
                                                <Link
                                                    href={`/invoices/${inv.id}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {inv.invoice_number}
                                                </Link>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {path ?? 'Tanpa proyek'}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div>
                                                    {formatDate(inv.issue_date)}
                                                </div>
                                                {due && (
                                                    <div
                                                        className={cn(
                                                            'text-xs',
                                                            inv.status ===
                                                                'overdue'
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        {due}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge
                                                    status={inv.status}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {formatIDR(inv.total)}
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    'pr-4 text-right tabular-nums sm:pr-6',
                                                    remaining > 0
                                                        ? 'font-medium'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {inv.status === 'cancelled'
                                                    ? '—'
                                                    : formatIDR(remaining)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile */}
                    <ul className="divide-y md:hidden">
                        {invoices.data.map((inv) => {
                            const remaining = invoiceRemaining(inv);
                            const path = projectPath(inv.project);

                            return (
                                <li key={inv.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Link
                                                href={`/invoices/${inv.id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {inv.invoice_number}
                                            </Link>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {formatDate(inv.issue_date)}
                                                {path && ` · ${path}`}
                                            </p>
                                        </div>
                                        <StatusBadge status={inv.status} />
                                    </div>
                                    <div className="mt-2 text-sm tabular-nums">
                                        <span className="font-semibold">
                                            {formatIDR(inv.total)}
                                        </span>
                                        {remaining > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                {' '}
                                                · Sisa {formatIDR(remaining)}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            <DataPagination paginator={invoices} noun="invoice" />
        </Card>
    );
}
