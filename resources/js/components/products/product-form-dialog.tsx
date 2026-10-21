import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
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
} from '@/components/ui/responsive-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { Client, Product } from '@/types/models';

type ProductFormData = {
    name: string;
    client_id: number | null;
    is_active: boolean;
};

const ALL_CLIENTS = 'all';

/** Form tambah / edit produk. Render ulang dengan `key` baru setiap kali dibuka. */
export function ProductFormDialog({
    open,
    onOpenChange,
    product,
    clients,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product?: Product | null;
    clients: Pick<Client, 'id' | 'name'>[];
}) {
    const isEdit = !!product;
    const form = useForm<ProductFormData>({
        name: product?.name ?? '',
        client_id: product?.client_id ?? product?.client?.id ?? null,
        is_active: product ? Boolean(product.is_active) : true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (product) {
            form.put(`/products/${product.id}`, options);
        } else {
            form.post('/products', options);
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={(v) => !form.processing && onOpenChange(v)}
        >
            <ResponsiveDialogContent className="sm:max-w-md">
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>
                        {isEdit ? 'Edit produk' : 'Tambah produk'}
                    </ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                        Produk muncul sebagai pilihan saat menyusun baris item
                        invoice.
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>

                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="product-name">
                            Nama produk{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="product-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="Mis. Website company profile"
                            aria-invalid={!!form.errors.name || undefined}
                            autoFocus
                            required
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="product-client">Klien</Label>
                        <Select
                            value={
                                form.data.client_id === null
                                    ? ALL_CLIENTS
                                    : String(form.data.client_id)
                            }
                            onValueChange={(v) =>
                                form.setData(
                                    'client_id',
                                    v === ALL_CLIENTS ? null : Number(v),
                                )
                            }
                        >
                            <SelectTrigger
                                id="product-client"
                                className="w-full"
                                aria-invalid={
                                    !!form.errors.client_id || undefined
                                }
                            >
                                <SelectValue placeholder="Pilih klien" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_CLIENTS}>
                                    Semua klien (umum)
                                </SelectItem>
                                {clients.length > 0 && <SelectSeparator />}
                                {clients.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Pilih klien jika produk ini khusus untuk satu klien
                            saja.
                        </p>
                        <InputError message={form.errors.client_id} />
                    </div>

                    <label
                        htmlFor="product-active"
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                    >
                        <Checkbox
                            id="product-active"
                            checked={form.data.is_active}
                            onCheckedChange={(v) =>
                                form.setData('is_active', v === true)
                            }
                            className="mt-0.5"
                        />
                        <span className="grid gap-0.5">
                            <span className="text-sm font-medium">Aktif</span>
                            <span className="text-xs text-muted-foreground">
                                Produk nonaktif tidak ditawarkan saat membuat
                                invoice baru.
                            </span>
                        </span>
                    </label>
                    <InputError message={form.errors.is_active} />

                    <ResponsiveDialogFooter className="gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={form.processing}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            {isEdit ? 'Simpan perubahan' : 'Tambah produk'}
                        </Button>
                    </ResponsiveDialogFooter>
                </form>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
