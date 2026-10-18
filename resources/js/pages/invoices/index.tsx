import { Head, Link, router } from '@inertiajs/react';
import {
    Copy,
    FolderKanban,
    Download,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    FileText,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    X,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/invoice-status-badge';
import { PageContainer, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    daysFromToday,
    dueLabel,
    formatDate,
    formatIDR,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Invoice, Paginated, ProjectOption } from '@/types/models';

type Filters = {
    status?: string | null;
    type?: string | null;
    q?: string | null;
    project_id?: string | number | null;
};

const STATUS_TABS: { value: string; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Terkirim' },
    { value: 'partial', label: 'Sebagian' },
    { value: 'overdue', label: 'Terlambat' },
    { value: 'paid', label: 'Lunas' },
    { value: 'cancelled', label: 'Dibatalkan' },
];

const OPEN_STATUSES = ['sent', 'partial', 'overdue'];
const ALL_TYPES = 'all';

function buildQuery(filters: Filters): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.type) {
        query.type = filters.type;
    }

    if (filters.q) {
        query.q = filters.q;
    }

    if (filters.project_id) {
        query.project_id = String(filters.project_id);
    }

    return query;
}

export default function InvoicesIndex({
    invoices,
    filters,
    statusCounts = {},
    projects = [],
}: {
    invoices: Paginated<Invoice>;
    filters: Filters;
    statusCounts?: Record<string, number>;
    projects?: ProjectOption[];
}) {
    const [search, setSearch] = useState(filters.q ?? '');
    const [loading, setLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    const current: Filters = {
        status: filters.status ?? '',
        type: filters.type ?? '',
        q: filters.q ?? '',
        project_id: filters.project_id ?? '',
    };
    const hasFilters = !!(
        current.status ||
        current.type ||
        current.q ||
        current.project_id
    );
    const totalCount = Object.values(statusCounts).reduce(
        (sum, n) => sum + Number(n),
        0,
    );

    const apply = (patch: Partial<Filters>) => {
        router.get('/invoices', buildQuery({ ...current, ...patch }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

    // Pencarian dengan debounce 350ms.
    useEffect(() => () => clearTimeout(searchTimer.current), []);

    const onSearchChange = (value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            if (value.trim() !== (filters.q ?? '')) {
                apply({ q: value.trim() });
            }
        }, 350);
    };

    const submitSearch = () => {
        clearTimeout(searchTimer.current);
        apply({ q: search.trim() });
    };

    const exportHref = (() => {
        const params = new URLSearchParams(buildQuery(current));
        const qs = params.toString();

        return `/invoices/export${qs ? `?${qs}` : ''}`;
    })();

    const resetFilters = () => {
        clearTimeout(searchTimer.current);
        setSearch('');
        router.get(
            '/invoices',
            {},
            {
                preserveScroll: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    const stop = (e: MouseEvent) => e.stopPropagation();

    return (
        <>
            <Head title="Invoice" />
            <PageContainer>
                <PageHeader
                    title="Invoice"
                    description="Buat, kirim, dan pantau pembayaran invoice klien."
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <a href={exportHref}>
                                    <FileSpreadsheet /> Export Excel
                                </a>
                            </Button>
                            <Button asChild>
                                <Link href="/invoices/create">
                                    <Plus /> Buat Invoice
                                </Link>
                            </Button>
                        </>
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
                    {/* Tab status */}
                    <div className="border-b">
                        <nav
                            className="-mb-px flex [scrollbar-width:none] gap-1 overflow-x-auto px-3 sm:px-4"
                            aria-label="Filter status"
                        >
                            {STATUS_TABS.map((tab) => {
                                const active =
                                    (current.status ?? '') === tab.value;
                                const count = tab.value
                                    ? Number(statusCounts[tab.value] ?? 0)
                                    : totalCount;

                                return (
                                    <button
                                        key={tab.value || 'all'}
                                        type="button"
                                        onClick={() =>
                                            !active &&
                                            apply({ status: tab.value })
                                        }
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={cn(
                                            'flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                                            active
                                                ? 'border-primary text-foreground'
                                                : 'border-transparent text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {tab.label}
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 py-px text-[11px] tabular-nums',
                                                active
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground',
                                                tab.value === 'overdue' &&
                                                    count > 0 &&
                                                    !active &&
                                                    'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
                                            )}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Pencarian & tipe */}
                    <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Cari nomor invoice atau nama klien…"
                                aria-label="Cari invoice"
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === 'Enter' && submitSearch()
                                }
                                className="pr-9 pl-9"
                            />
                            {loading && (
                                <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Select
                                value={current.type || ALL_TYPES}
                                onValueChange={(v) =>
                                    apply({ type: v === ALL_TYPES ? '' : v })
                                }
                            >
                                <SelectTrigger
                                    className="w-full sm:w-40"
                                    aria-label="Tipe pembayaran"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_TYPES}>
                                        Semua tipe
                                    </SelectItem>
                                    <SelectItem value="full">
                                        Bayar penuh
                                    </SelectItem>
                                    <SelectItem value="installment">
                                        Cicilan
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {projects.length > 0 && (
                                <ProjectFilter
                                    projects={projects}
                                    value={
                                        current.project_id
                                            ? Number(current.project_id)
                                            : null
                                    }
                                    onChange={(id) =>
                                        apply({ project_id: id ?? '' })
                                    }
                                />
                            )}
                            {hasFilters && (
                                <Button
                                    variant="ghost"
                                    onClick={resetFilters}
                                    className="shrink-0"
                                >
                                    <X /> Reset
                                </Button>
                            )}
                        </div>
                    </div>

                    {invoices.data.length === 0 ? (
                        hasFilters ? (
                            <EmptyState
                                icon={Search}
                                title="Tidak ada invoice yang cocok"
                                description="Coba ubah kata kunci atau filter yang dipakai."
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={resetFilters}
                                    >
                                        Reset filter
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="Belum ada invoice"
                                description="Buat invoice pertama Anda lalu kirim ke klien lewat WhatsApp dan email."
                                action={
                                    <Button asChild>
                                        <Link href="/invoices/create">
                                            <Plus /> Buat Invoice
                                        </Link>
                                    </Button>
                                }
                            />
                        )
                    ) : (
                        <div
                            className={cn(
                                'transition-opacity',
                                loading && 'opacity-60',
                            )}
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                        <TableHead className="pl-4">
                                            No. Invoice
                                        </TableHead>
                                        <TableHead>Klien</TableHead>
                                        <TableHead className="hidden md:table-cell">
                                            Tanggal
                                        </TableHead>
                                        <TableHead className="hidden sm:table-cell">
                                            Jatuh tempo
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Total
                                        </TableHead>
                                        <TableHead className="hidden text-right lg:table-cell">
                                            Sisa
                                        </TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-12 pr-4">
                                            <span className="sr-only">
                                                Aksi
                                            </span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.data.map((inv) => {
                                        const isOpenInv =
                                            OPEN_STATUSES.includes(inv.status);
                                        const late =
                                            isOpenInv &&
                                            !!inv.due_date &&
                                            (daysFromToday(inv.due_date) ?? 0) <
                                                0;
                                        const remaining =
                                            inv.status === 'cancelled'
                                                ? 0
                                                : Math.max(
                                                      0,
                                                      toNumber(inv.total) -
                                                          toNumber(
                                                              inv.paid_amount,
                                                          ),
                                                  );
                                        const href = `/invoices/${inv.id}`;

                                        return (
                                            <TableRow
                                                key={inv.id}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    router.visit(href)
                                                }
                                            >
                                                <TableCell className="pl-4 font-medium">
                                                    <Link
                                                        href={href}
                                                        className="hover:underline"
                                                        onClick={stop}
                                                    >
                                                        {inv.invoice_number}
                                                    </Link>
                                                    <div className="text-xs font-normal text-muted-foreground md:hidden">
                                                        {formatDate(
                                                            inv.issue_date,
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[160px] sm:max-w-[220px]">
                                                    <div className="truncate">
                                                        {inv.client?.name ??
                                                            '—'}
                                                    </div>
                                                    {inv.project && (
                                                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                            <FolderKanban className="size-3 shrink-0" />
                                                            {inv.project.parent
                                                                ? `${inv.project.parent.name} › ${inv.project.name}`
                                                                : inv.project
                                                                      .name}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden text-muted-foreground md:table-cell">
                                                    {formatDate(inv.issue_date)}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <div className="text-muted-foreground">
                                                        {formatDate(
                                                            inv.due_date,
                                                        )}
                                                    </div>
                                                    {late && (
                                                        <div className="text-xs font-medium text-red-600 dark:text-red-400">
                                                            {dueLabel(
                                                                inv.due_date,
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right font-medium tabular-nums',
                                                        inv.status ===
                                                            'cancelled' &&
                                                            'text-muted-foreground line-through',
                                                    )}
                                                >
                                                    {formatIDR(inv.total)}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'hidden text-right tabular-nums lg:table-cell',
                                                        remaining > 0
                                                            ? 'text-foreground'
                                                            : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {inv.status === 'draft' ||
                                                    remaining === 0
                                                        ? '—'
                                                        : formatIDR(remaining)}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        status={inv.status}
                                                    />
                                                </TableCell>
                                                <TableCell
                                                    className="pr-4 text-right"
                                                    onClick={stop}
                                                >
                                                    <RowActions invoice={inv} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <DataPagination
                                paginator={invoices}
                                noun="invoice"
                            />
                        </div>
                    )}
                </Card>
            </PageContainer>
        </>
    );
}

function RowActions({ invoice }: { invoice: Invoice }) {
    const href = `/invoices/${invoice.id}`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Aksi untuk ${invoice.invoice_number}`}
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                    <Link href={href}>
                        <Eye /> Lihat
                    </Link>
                </DropdownMenuItem>
                {invoice.status === 'draft' && (
                    <DropdownMenuItem asChild>
                        <Link href={`${href}/edit`}>
                            <Pencil /> Edit
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    onSelect={() => router.post(`${href}/duplicate`)}
                >
                    <Copy /> Duplikat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <a
                        href={`${href}/pdf/stream`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <ExternalLink /> Lihat PDF
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <a href={`${href}/pdf`}>
                        <Download /> Download PDF
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Filter proyek lintas klien: dikelompokkan per proyek utama (beserta kliennya). */
function ProjectFilter({
    projects,
    value,
    onChange,
}: {
    projects: ProjectOption[];
    value: number | null;
    onChange: (id: number | null) => void;
}) {
    const roots = projects.filter((p) => p.parent_id === null);

    return (
        <div className="relative w-full sm:w-52">
            <FolderKanban className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
                aria-label="Filter proyek"
                value={value ?? ''}
                onChange={(e) =>
                    onChange(e.target.value ? Number(e.target.value) : null)
                }
                className="h-9 w-full appearance-none truncate rounded-md border border-input bg-transparent py-1 pr-3 pl-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            >
                <option value="">Semua proyek</option>
                {roots.map((root) => {
                    const kids = projects.filter(
                        (p) => p.parent_id === root.id,
                    );
                    const label = root.client_name
                        ? `${root.client_name} · ${root.name}`
                        : root.name;

                    return (
                        <optgroup key={root.id} label={label}>
                            <option value={root.id}>
                                {root.name}
                                {kids.length > 0 ? ' (semua)' : ''}
                            </option>
                            {kids.map((k) => (
                                <option key={k.id} value={k.id}>
                                    └ {k.name}
                                </option>
                            ))}
                        </optgroup>
                    );
                })}
            </select>
        </div>
    );
}
