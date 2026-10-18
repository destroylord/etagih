import { Head, Link, router } from '@inertiajs/react';
import { Package, Pencil, Plus, SearchX, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { IconAction } from '@/components/clients/client-actions';
import { SearchField } from '@/components/clients/search-field';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { Badge } from '@/components/ui/badge';
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
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Client, Paginated, Product } from '@/types/models';

type Props = {
    products: Paginated<Product>;
    clients: Pick<Client, 'id' | 'name'>[];
    filters: { q: string };
};

const SEARCH_ONLY = ['products', 'filters'];

function ActiveBadge({ active }: { active: boolean }) {
    return active ? (
        <Badge
            variant="outline"
            className="gap-1.5 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
        >
            <span
                className="size-1.5 rounded-full bg-emerald-500"
                aria-hidden
            />{' '}
            Aktif
        </Badge>
    ) : (
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden />{' '}
            Nonaktif
        </Badge>
    );
}

function ClientCell({ product }: { product: Product }) {
    return product.client ? (
        <Link
            href={`/clients/${product.client.id}`}
            className="hover:underline"
        >
            {product.client.name}
        </Link>
    ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5" aria-hidden /> Semua klien
        </span>
    );
}

export default function ProductsIndex({ products, clients, filters }: Props) {
    const [formOpen, setFormOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [editing, setEditing] = useState<Product | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [lastDeleted, setLastDeleted] = useState<Product | null>(null);

    if (deleteTarget && deleteTarget !== lastDeleted) {
        setLastDeleted(deleteTarget);
    }

    const openForm = (product: Product | null) => {
        setEditing(product);
        setFormKey((k) => k + 1);
        setFormOpen(true);
    };

    const actions = (p: Product) => (
        <div className="flex items-center justify-end gap-0.5">
            <IconAction
                label="Edit produk"
                icon={Pencil}
                onClick={() => openForm(p)}
            />
            <IconAction
                label="Hapus produk"
                icon={Trash2}
                destructive
                onClick={() => setDeleteTarget(p)}
            />
        </div>
    );

    const isSearching = filters.q !== '';

    return (
        <>
            <Head title="Produk" />
            <PageContainer>
                <PageHeader
                    title="Produk"
                    description="Katalog produk/jasa per klien. Uraian pekerjaan tetap ditulis di setiap baris invoice."
                    actions={
                        <Button onClick={() => openForm(null)}>
                            <Plus /> Produk baru
                        </Button>
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <SearchField
                            url="/products"
                            initial={filters.q}
                            placeholder="Cari produk atau nama klien…"
                            only={SEARCH_ONLY}
                        />
                        <p className="text-sm text-muted-foreground">
                            {isSearching ? (
                                <>
                                    {formatNumber(products.total)} hasil untuk “
                                    <span className="font-medium text-foreground">
                                        {filters.q}
                                    </span>
                                    ”
                                </>
                            ) : (
                                <>{formatNumber(products.total)} produk</>
                            )}
                        </p>
                    </div>

                    {products.data.length === 0 ? (
                        isSearching ? (
                            <EmptyState
                                icon={SearchX}
                                title="Produk tidak ditemukan"
                                description="Coba kata kunci lain atau cari berdasarkan nama klien."
                            />
                        ) : (
                            <EmptyState
                                icon={Package}
                                title="Belum ada produk"
                                description="Tambahkan produk agar baris invoice lebih cepat diisi dan laporan per produk lebih rapi."
                                action={
                                    <Button onClick={() => openForm(null)}>
                                        <Plus /> Tambah produk
                                    </Button>
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
                                                Nama produk
                                            </TableHead>
                                            <TableHead>Klien</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-24 pr-4 text-right">
                                                <span className="sr-only">
                                                    Aksi
                                                </span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {products.data.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell
                                                    className={cn(
                                                        'pl-4 font-medium',
                                                        !p.is_active &&
                                                            'text-muted-foreground',
                                                    )}
                                                >
                                                    {p.name}
                                                </TableCell>
                                                <TableCell>
                                                    <ClientCell product={p} />
                                                </TableCell>
                                                <TableCell>
                                                    <ActiveBadge
                                                        active={Boolean(
                                                            p.is_active,
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="pr-4">
                                                    {actions(p)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile */}
                            <ul className="divide-y md:hidden">
                                {products.data.map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center gap-3 p-4"
                                    >
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <p
                                                className={cn(
                                                    'truncate font-medium',
                                                    !p.is_active &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {p.name}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                <ClientCell product={p} />
                                                <ActiveBadge
                                                    active={Boolean(
                                                        p.is_active,
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        {actions(p)}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <DataPagination paginator={products} noun="produk" />
                </Card>
            </PageContainer>

            <ProductFormDialog
                key={formKey}
                open={formOpen}
                onOpenChange={setFormOpen}
                product={editing}
                clients={clients}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Hapus produk?"
                description={
                    <>
                        Produk{' '}
                        <span className="font-medium text-foreground">
                            {(deleteTarget ?? lastDeleted)?.name}
                        </span>{' '}
                        akan dihapus. Invoice yang sudah memakai produk ini
                        tetap tersimpan.
                    </>
                }
                confirmLabel="Hapus produk"
                destructive
                onConfirm={(done) => {
                    if (!deleteTarget) {
                        return done();
                    }

                    router.delete(`/products/${deleteTarget.id}`, {
                        preserveScroll: true,
                        onFinish: done,
                    });
                }}
            />
        </>
    );
}

ProductsIndex.layout = {
    breadcrumbs: [{ title: 'Produk', href: '/products' }],
};
