import { router } from '@inertiajs/react';
import { PackagePlus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
    ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { FormProduct } from './utils';

/**
 * Dialog multi-pilih produk + tambah cepat produk baru.
 * Produk ditampilkan: milik client terpilih + katalog umum (tanpa pemilik).
 * Client baru (clientId null) → hanya katalog umum.
 */
export function ProductPickerDialog({
    products,
    clientId,
    usedProductIds,
    onAdd,
}: {
    products: FormProduct[];
    clientId: number | null;
    usedProductIds: Set<number>;
    onAdd: (products: FormProduct[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);

    const clientProducts =
        clientId === null
            ? []
            : products.filter((p) => p.client_id === clientId);
    const globalProducts = products.filter((p) => p.client_id === null);
    const groups = [
        { label: 'Produk client ini', items: clientProducts },
        { label: 'Katalog umum', items: globalProducts },
    ].filter((g) => g.items.length > 0);

    const toggle = (id: number, checked: boolean) =>
        setSelected((prev) =>
            checked
                ? [...new Set([...prev, id])]
                : prev.filter((x) => x !== id),
        );

    const onOpenChange = (next: boolean) => {
        setOpen(next);

        if (next) {
            setSelected([]);
            setNewName('');
        }
    };

    const quickAdd = () => {
        const name = newName.trim();

        if (!name || adding) {
            return;
        }

        setAdding(true);
        router.post(
            '/products',
            { name, client_id: clientId },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    setNewName('');
                    // Otomatis centang produk yang baru dibuat.
                    const list = (page.props.products ?? []) as FormProduct[];
                    const created = list
                        .filter((p) => p.name === name)
                        .sort((a, b) => b.id - a.id)[0];

                    if (created) {
                        toggle(created.id, true);
                    }
                },
                onFinish: () => setAdding(false),
            },
        );
    };

    const onQuickAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            quickAdd();
        }
    };

    const apply = () => {
        const chosen = products.filter((p) => selected.includes(p.id));

        if (chosen.length) {
            onAdd(chosen);
        }

        setOpen(false);
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <ResponsiveDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <PackagePlus className="size-4" /> Pilih Produk
                </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Pilih Produk</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                        Centang produk untuk ditambahkan sebagai baris item.
                        Bisa lebih dari satu.
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>

                {groups.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Belum ada produk. Tambahkan lewat form di bawah.
                    </p>
                ) : (
                    <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                        {groups.map((g) => (
                            <div key={g.label} className="space-y-2">
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    {g.label}
                                </p>
                                {g.items.map((p) => {
                                    const checked = selected.includes(p.id);
                                    const id = `product-pick-${p.id}`;

                                    return (
                                        <label
                                            key={p.id}
                                            htmlFor={id}
                                            className={cn(
                                                'flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors',
                                                checked
                                                    ? 'border-primary bg-primary/5'
                                                    : 'hover:bg-muted/50',
                                            )}
                                        >
                                            <Checkbox
                                                id={id}
                                                checked={checked}
                                                onCheckedChange={(c) =>
                                                    toggle(p.id, c === true)
                                                }
                                            />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                {p.name}
                                            </span>
                                            {usedProductIds.has(p.id) && (
                                                <Badge
                                                    variant="secondary"
                                                    className="shrink-0"
                                                >
                                                    Sudah di invoice
                                                </Badge>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <Label
                        htmlFor="quick-product-name"
                        className="text-xs text-muted-foreground"
                    >
                        Produk belum ada? Tambah cepat
                        {clientId === null
                            ? ' (katalog umum)'
                            : ' untuk client ini'}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="quick-product-name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={onQuickAddKey}
                            placeholder="Nama produk"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={quickAdd}
                            disabled={!newName.trim() || adding}
                        >
                            {adding ? <Spinner /> : <Plus className="size-4" />}{' '}
                            Tambah
                        </Button>
                    </div>
                </div>

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
                        {selected.length > 0 ? `${selected.length} produk` : ''}
                    </Button>
                </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
