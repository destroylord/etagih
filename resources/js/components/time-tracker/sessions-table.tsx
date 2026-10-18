import { Link } from '@inertiajs/react';
import { ExternalLink, FolderKanban } from 'lucide-react';
import { StatusBadge } from '@/components/invoice-status-badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate, formatDuration, formatIDR, toNumber } from '@/lib/format';
import { projectLabel } from './types';
import type { TrackerSession } from './types';

export function sessionSubtotal(s: TrackerSession): number {
    if (!['completed', 'billed'].includes(s.status) || !s.duration_seconds) {
        return 0;
    }

    return (s.duration_seconds / 3600) * toNumber(s.unit_price);
}

function timeOf(value: string | null): string {
    if (!value) {
        return '';
    }

    const d = new Date(value);

    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function timeRange(s: TrackerSession): string {
    const start = timeOf(s.started_at);
    const end = ['completed', 'billed', 'cancelled'].includes(s.status)
        ? timeOf(s.ended_at)
        : '';

    return end ? `${start}–${end}` : start;
}

function DurationCell({ s }: { s: TrackerSession }) {
    if (s.status === 'running' || s.status === 'paused') {
        return <span className="text-muted-foreground">Sedang berjalan</span>;
    }

    return (
        <span className="tabular-nums">
            {formatDuration(s.duration_seconds)}
        </span>
    );
}

function ProjectLink({ s }: { s: TrackerSession }) {
    const label = projectLabel(s.project);

    if (!s.project || !label) {
        return null;
    }

    return (
        <Link
            href={`/projects/${s.project.id}`}
            className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
            <FolderKanban className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">Proyek:</span>
            <span className="truncate">{label}</span>
        </Link>
    );
}

function InvoiceLink({ s }: { s: TrackerSession }) {
    if (s.status !== 'billed' || !s.invoice_id) {
        return null;
    }

    return (
        <Link
            href={`/invoices/${s.invoice_id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
            Lihat invoice <ExternalLink className="size-3" />
        </Link>
    );
}

/** Riwayat sesi: tabel di desktop, daftar kartu di HP. */
export function SessionsTable({ sessions }: { sessions: TrackerSession[] }) {
    return (
        <>
            {/* Desktop */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4">Pekerjaan</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead className="text-right">Durasi</TableHead>
                            <TableHead className="text-right">
                                Tarif/jam
                            </TableHead>
                            <TableHead className="text-right">
                                Subtotal
                            </TableHead>
                            <TableHead className="pr-4">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.map((s) => {
                            const subtotal = sessionSubtotal(s);

                            return (
                                <TableRow key={s.id}>
                                    <TableCell className="max-w-72 pl-4 whitespace-normal">
                                        <p className="font-medium break-words">
                                            {s.description}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {s.client?.name ?? '—'}
                                            {s.user && ` · oleh ${s.user.name}`}
                                        </p>
                                        <ProjectLink s={s} />
                                    </TableCell>
                                    <TableCell>
                                        <p>{formatDate(s.started_at)}</p>
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                            {timeRange(s)}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DurationCell s={s} />
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground tabular-nums">
                                        {formatIDR(s.unit_price)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {subtotal > 0
                                            ? formatIDR(subtotal)
                                            : '—'}
                                    </TableCell>
                                    <TableCell className="pr-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <StatusBadge status={s.status} />
                                            <InvoiceLink s={s} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile */}
            <ul className="divide-y md:hidden">
                {sessions.map((s) => {
                    const subtotal = sessionSubtotal(s);

                    return (
                        <li key={s.id} className="space-y-2 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium break-words">
                                        {s.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {s.client?.name ?? '—'} ·{' '}
                                        {formatDate(s.started_at)}{' '}
                                        {timeRange(s)}
                                        {s.user && ` · ${s.user.name}`}
                                    </p>
                                    <ProjectLink s={s} />
                                </div>
                                <StatusBadge status={s.status} />
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-muted-foreground">
                                    <DurationCell s={s} /> ·{' '}
                                    {formatIDR(s.unit_price)}/jam
                                </span>
                                <span className="font-medium tabular-nums">
                                    {subtotal > 0 ? formatIDR(subtotal) : '—'}
                                </span>
                            </div>
                            <InvoiceLink s={s} />
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
