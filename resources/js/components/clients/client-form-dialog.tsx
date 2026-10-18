import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toNumber } from '@/lib/format';
import type { Client } from '@/types/models';

type ClientFormData = {
    name: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
    hourly_rate: string;
};

/**
 * Form tambah / edit klien dalam dialog. Render ulang dengan `key` baru setiap
 * kali dibuka supaya nilai awal selalu segar.
 */
export function ClientFormDialog({
    open,
    onOpenChange,
    client,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client?: Client | null;
}) {
    const isEdit = !!client;
    const form = useForm<ClientFormData>({
        name: client?.name ?? '',
        email: client?.email ?? '',
        phone: client?.phone ?? '',
        address: client?.address ?? '',
        notes: client?.notes ?? '',
        hourly_rate:
            client?.hourly_rate !== null && client?.hourly_rate !== undefined
                ? String(toNumber(client.hourly_rate))
                : '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (client) {
            form.put(`/clients/${client.id}`, options);
        } else {
            form.post('/clients', options);
        }
    };

    const field = (key: keyof ClientFormData) => ({
        id: `client-${key}`,
        value: form.data[key],
        'aria-invalid': !!form.errors[key] || undefined,
        onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => form.setData(key, e.target.value),
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => !form.processing && onOpenChange(v)}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Edit klien' : 'Tambah klien'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Perbarui data kontak dan tarif klien.'
                            : 'Kunci akses portal dibuat otomatis dan ditampilkan sekali setelah klien disimpan.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="client-name">
                            Nama <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            {...field('name')}
                            placeholder="PT Contoh Jaya"
                            autoFocus
                            required
                            autoComplete="organization"
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="client-email">Email</Label>
                            <Input
                                {...field('email')}
                                type="email"
                                placeholder="nama@perusahaan.com"
                                autoComplete="email"
                            />
                            <InputError message={form.errors.email} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="client-phone">
                                Telepon / WhatsApp
                            </Label>
                            <Input
                                {...field('phone')}
                                type="tel"
                                inputMode="tel"
                                placeholder="62812xxxx"
                                autoComplete="tel"
                            />
                            <InputError message={form.errors.phone} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="client-hourly_rate">
                            Tarif per jam
                        </Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                Rp
                            </span>
                            <Input
                                {...field('hourly_rate')}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step="any"
                                placeholder="Kosongkan untuk tarif default"
                                className="pl-9 tabular-nums"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Dipakai untuk invoice per jam & time tracker.
                        </p>
                        <InputError message={form.errors.hourly_rate} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="client-address">Alamat</Label>
                        <Textarea
                            {...field('address')}
                            rows={2}
                            placeholder="Alamat penagihan"
                        />
                        <InputError message={form.errors.address} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="client-notes">Catatan</Label>
                        <Textarea
                            {...field('notes')}
                            rows={2}
                            placeholder="Catatan internal (tidak terlihat oleh klien)"
                        />
                        <InputError message={form.errors.notes} />
                    </div>

                    <DialogFooter className="gap-2 pt-2">
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
                            {isEdit ? 'Simpan perubahan' : 'Tambah klien'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
