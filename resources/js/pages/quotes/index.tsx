import { Head, Link, router } from '@inertiajs/react';
import {
    Copy,
    Download,
    ExternalLink,
    Eye,
    FileSignature,
    FolderKanban,
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
import { PageContainer, PageHeader } from '@/components/page-header';
import {
    QUOTE_STATUS,
    QUOTE_STATUS_OPTIONS,
    QuoteStatusBadge,
} from '@/components/quote-detail/quote-status-badge';
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
import { daysFromToday, formatDate, formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Client, Paginated } from '@/types/models';
import type { Quote } from '@/types/quotes';

type Filters = {
    status?: string | null;
    q?: string | null;
    client_id?: string | number | null;
};

const STATUS_TABS: { value: string; label: string }[] = [
    { value: '', label: 'Semua' },
    ...QUOTE_STATUS_OPTIONS.map((s) => ({
        value: s,
        label: s === 'sent' ? 'Terkirim' : QUOTE_STATUS[s].label,
    })),
];

const ALL_CLIENTS = 'all';

function buildQuery(filters: Filters): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.q) {
        query.q = filters.q;
    }

    if (filters.client_id) {
        query.client_id = String(filters.client_id);
    }

    return query;
}

export default function QuotesIndex({
    quotes,
    filters,
    clients = [],
    statusCounts = {},
}: {
    quotes: Paginated<Quote>;
    filters: Filters;
    clients?: Pick<Client, 'id' | 'name'>[];
    statusCounts?: Record<string, number>;
}) {
    const [search, setSearch] = useState(filters.q ?? '');
    const [loading, setLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    const current: Filters = {
        status: filters.status ?? '',
        q: filters.q ?? '',
        client_id: filters.client_id ?? '',
    };
    const hasFilters = !!(current.status || current.q || current.client_id);
    const totalCount = Object.values(statusCounts).reduce(
        (sum, n) => sum + Number(n),
        0,
    );

    const apply = (patch: Partial<Filters>) => {
        router.get('/quotes', buildQuery({ ...current, ...patch }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

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

    const resetFilters = () => {
        clearTimeout(searchTimer.current);
        setSearch('');
        router.get(
            '/quotes',
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
            <Head title="Penawaran" />
            <PageContainer>
                <PageHeader
                    title="Penawaran"
                    description="Kirim penawaran harga ke klien; setelah disetujui, ubah jadi invoice dalam satu klik."
                    actions={
                        <Button asChild>
                            <Link href="/quotes/create">
                                <Plus /> Buat Penawaran
                            </Link>
                        </Button>
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
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
                                                tab.value === 'accepted' &&
                                                    count > 0 &&
                                                    !active &&
                                                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
                                            )}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Cari nomor penawaran atau nama klien…"
                                aria-label="Cari penawaran"
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        clearTimeout(searchTimer.current);
                                        apply({ q: search.trim() });
                                    }
                                }}
                                className="pr-9 pl-9"
                            />
                            {loading && (
                                <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex gap-2">
                            {clients.length > 0 && (
                                <Select
                                    value={
                                        current.client_id
                                            ? String(current.client_id)
                                            : ALL_CLIENTS
                                    }
                                    onValueChange={(v) =>
                                        apply({
                                            client_id:
                                                v === ALL_CLIENTS ? '' : v,
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        className="w-full sm:w-52"
                                        aria-label="Filter klien"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL_CLIENTS}>
                                            Semua klien
                                        </SelectItem>
                                        {clients.map((c) => (
                                            <SelectItem
                                                key={c.id}
                                                value={String(c.id)}
                                            >
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

                    {quotes.data.length === 0 ? (
                        hasFilters ? (
                            <EmptyState
                                icon={Search}
                                title="Tidak ada penawaran yang cocok"
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
                                icon={FileSignature}
                                title="Belum ada penawaran"
                                description="Buat penawaran harga, kirim ke klien, dan biarkan klien menyetujuinya secara online."
                                action={
                                    <Button asChild>
                                        <Link href="/quotes/create">
                                            <Plus /> Buat Penawaran
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
                                            No. Penawaran
                                        </TableHead>
                                        <TableHead>Klien</TableHead>
                                        <TableHead className="hidden md:table-cell">
                                            Tanggal
                                        </TableHead>
                                        <TableHead className="hidden sm:table-cell">
                                            Berlaku sampai
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Total
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
                                    {quotes.data.map((q) => {
                                        const href = `/quotes/${q.id}`;
                                        const diff = daysFromToday(
                                            q.valid_until,
                                        );
                                        const lapsed =
                                            q.status === 'sent' &&
                                            diff !== null &&
                                            diff < 0;

                                        return (
                                            <TableRow
                                                key={q.id}
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
                                                        {q.quote_number}
                                                    </Link>
                                                    <div className="text-xs font-normal text-muted-foreground md:hidden">
                                                        {formatDate(
                                                            q.issue_date,
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[160px] sm:max-w-[220px]">
                                                    <div className="truncate">
                                                        {q.client?.name ?? '—'}
                                                    </div>
                                                    {q.project && (
                                                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                            <FolderKanban className="size-3 shrink-0" />
                                                            {q.project.parent
                                                                ? `${q.project.parent.name} › ${q.project.name}`
                                                                : q.project
                                                                      .name}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden text-muted-foreground md:table-cell">
                                                    {formatDate(q.issue_date)}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <div className="text-muted-foreground">
                                                        {formatDate(
                                                            q.valid_until,
                                                        )}
                                                    </div>
                                                    {lapsed && (
                                                        <div className="text-xs font-medium text-red-600 dark:text-red-400">
                                                            Lewat masa berlaku
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {formatIDR(q.total)}
                                                </TableCell>
                                                <TableCell>
                                                    <QuoteStatusBadge
                                                        status={q.status}
                                                    />
                                                </TableCell>
                                                <TableCell
                                                    className="pr-4 text-right"
                                                    onClick={stop}
                                                >
                                                    <RowActions quote={q} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <DataPagination
                                paginator={quotes}
                                noun="penawaran"
                            />
                        </div>
                    )}
                </Card>
            </PageContainer>
        </>
    );
}

function RowActions({ quote }: { quote: Quote }) {
    const href = `/quotes/${quote.id}`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Aksi untuk ${quote.quote_number}`}
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
                {quote.status === 'draft' && (
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
                        href={`${href}/pdf?inline=1`}
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
