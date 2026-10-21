import { Head, Link } from '@inertiajs/react';
import {
    FileText,
    KeyRound,
    Mail,
    Package,
    Pencil,
    Phone,
    Plus,
    SearchX,
    Trash2,
    Upload,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import {
    DeleteClientDialog,
    IconAction,
    RegenerateKeyDialog,
    deleteBlockedReason,
} from '@/components/clients/client-actions';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
import { ClientImportDialog } from '@/components/clients/client-import-dialog';
import { SearchField } from '@/components/clients/search-field';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { useQueryFlag } from '@/hooks/use-query-flag';
import { formatIDR, formatNumber } from '@/lib/format';
import type { Client, Paginated } from '@/types/models';

type Props = { clients: Paginated<Client>; filters: { q: string } };

const SEARCH_ONLY = ['clients', 'filters'];

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');
}

function ClientAvatar({ name }: { name: string }) {
    return (
        <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
            aria-hidden
        >
            {initials(name) || '?'}
        </span>
    );
}

export default function ClientsIndex({ clients, filters }: Props) {
    const [formOpen, setFormOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [editing, setEditing] = useState<Client | null>(null);
    const [keyTarget, setKeyTarget] = useState<Client | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
    // Tambah/edit/hapus/import klien & kunci portal hanya untuk admin.
    const { manageClients } = useCan();

    const openForm = (client: Client | null) => {
        setEditing(client);
        setFormKey((k) => k + 1);
        setFormOpen(true);
    };

    // `/clients?new=1` (aksi cepat mobile) langsung membuka form klien baru.
    useQueryFlag('new', () => manageClients && openForm(null));

    const rowActions = (c: Client) =>
        manageClients && (
            <div className="flex items-center justify-end gap-0.5">
                <IconAction
                    label="Edit klien"
                    icon={Pencil}
                    onClick={() => openForm(c)}
                />
                <IconAction
                    label="Buat kunci akses baru"
                    icon={KeyRound}
                    onClick={() => setKeyTarget(c)}
                />
                <IconAction
                    label="Hapus klien"
                    icon={Trash2}
                    destructive
                    disabledReason={deleteBlockedReason(c)}
                    onClick={() => setDeleteTarget(c)}
                />
            </div>
        );

    const isSearching = filters.q !== '';

    return (
        <>
            <Head title="Klien" />
            <PageContainer>
                <PageHeader
                    title="Klien"
                    description="Kelola data klien, tarif per jam, dan akses portal mereka."
                    actions={
                        manageClients ? (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setImportOpen(true)}
                                >
                                    <Upload /> Import
                                </Button>
                                <Button onClick={() => openForm(null)}>
                                    <Plus /> Klien baru
                                </Button>
                            </div>
                        ) : undefined
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <SearchField
                            url="/clients"
                            initial={filters.q}
                            placeholder="Cari nama, email, atau telepon…"
                            only={SEARCH_ONLY}
                        />
                        <p className="text-sm text-muted-foreground">
                            {isSearching ? (
                                <>
                                    {formatNumber(clients.total)} hasil untuk “
                                    <span className="font-medium text-foreground">
                                        {filters.q}
                                    </span>
                                    ”
                                </>
                            ) : (
                                <>
                                    {formatNumber(clients.total)} klien
                                    terdaftar
                                </>
                            )}
                        </p>
                    </div>

                    {clients.data.length === 0 ? (
                        isSearching ? (
                            <EmptyState
                                icon={SearchX}
                                title="Klien tidak ditemukan"
                                description="Coba kata kunci lain, atau periksa ejaan nama, email, maupun nomor telepon."
                            />
                        ) : (
                            <EmptyState
                                icon={Users}
                                title="Belum ada klien"
                                description="Tambahkan klien pertama Anda untuk mulai membuat invoice dan membagikan akses portal."
                                action={
                                    manageClients ? (
                                        <Button onClick={() => openForm(null)}>
                                            <Plus /> Tambah klien
                                        </Button>
                                    ) : undefined
                                }
                            />
                        )
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                                            <TableHead className="pl-4">
                                                Klien
                                            </TableHead>
                                            <TableHead>Telepon</TableHead>
                                            <TableHead className="text-right">
                                                Tarif/jam
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Invoice
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Produk
                                            </TableHead>
                                            <TableHead className="w-32 pr-4 text-right">
                                                <span className="sr-only">
                                                    Aksi
                                                </span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clients.data.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="pl-4">
                                                    <div className="flex items-center gap-3">
                                                        <ClientAvatar
                                                            name={c.name}
                                                        />
                                                        <div className="min-w-0">
                                                            <Link
                                                                href={`/clients/${c.id}`}
                                                                className="block truncate font-medium hover:underline"
                                                            >
                                                                {c.name}
                                                            </Link>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {c.email ??
                                                                    'Tanpa email'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {c.phone ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {c.hourly_rate !== null ? (
                                                        formatIDR(c.hourly_rate)
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            Default
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatNumber(
                                                        c.invoices_count ?? 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatNumber(
                                                        c.products_count ?? 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-4">
                                                    {rowActions(c)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile */}
                            <ul className="divide-y md:hidden">
                                {clients.data.map((c) => (
                                    <li
                                        key={c.id}
                                        className="flex flex-col gap-3 p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <ClientAvatar name={c.name} />
                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={`/clients/${c.id}`}
                                                    className="block truncate font-medium hover:underline"
                                                >
                                                    {c.name}
                                                </Link>
                                                <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                                                    {c.email && (
                                                        <p className="flex items-center gap-1.5 truncate">
                                                            <Mail className="size-3 shrink-0" />{' '}
                                                            {c.email}
                                                        </p>
                                                    )}
                                                    {c.phone && (
                                                        <p className="flex items-center gap-1.5">
                                                            <Phone className="size-3 shrink-0" />{' '}
                                                            {c.phone}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                    <FileText className="size-3" />{' '}
                                                    {formatNumber(
                                                        c.invoices_count ?? 0,
                                                    )}{' '}
                                                    invoice
                                                </span>
                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                    <Package className="size-3" />{' '}
                                                    {formatNumber(
                                                        c.products_count ?? 0,
                                                    )}{' '}
                                                    produk
                                                </span>
                                                {c.hourly_rate !== null && (
                                                    <span className="tabular-nums">
                                                        {formatIDR(
                                                            c.hourly_rate,
                                                        )}
                                                        /jam
                                                    </span>
                                                )}
                                            </div>
                                            {rowActions(c)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <DataPagination paginator={clients} noun="klien" />
                </Card>
            </PageContainer>

            <ClientFormDialog
                key={formKey}
                open={formOpen}
                onOpenChange={setFormOpen}
                client={editing}
            />
            <ClientImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
            />
            <RegenerateKeyDialog
                client={keyTarget}
                onOpenChange={(open) => !open && setKeyTarget(null)}
            />
            <DeleteClientDialog
                client={deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            />
        </>
    );
}

ClientsIndex.layout = {
    breadcrumbs: [{ title: 'Klien', href: '/clients' }],
};
