import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { UserRole } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import type { ManagedUser } from './types';
import { ROLE_DESCRIPTIONS } from './types';

type PasswordMode = 'invite' | 'temporary';

type UserFormData = {
    name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    password_mode: PasswordMode;
};

const PASSWORD_MODES: { value: PasswordMode; title: string; hint: string }[] = [
    {
        value: 'invite',
        title: 'Kirim email untuk mengatur password',
        hint: 'Pengguna menerima tautan dan memilih password sendiri.',
    },
    {
        value: 'temporary',
        title: 'Buat password sementara',
        hint: 'Password acak ditampilkan sekali — bagikan secara langsung.',
    },
];

/** Form tambah / edit pengguna. Render ulang dengan `key` baru setiap kali dibuka. */
export function UserFormDialog({
    open,
    onOpenChange,
    user,
    assignableRoles,
    roleLabels,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: ManagedUser | null;
    assignableRoles: UserRole[];
    roleLabels: Record<UserRole, string>;
}) {
    const isEdit = !!user;
    const canChangeRole = !user || user.can.change_role;
    const canDeactivate = !!user && user.can.deactivate;

    const form = useForm<UserFormData>({
        name: user?.name ?? '',
        email: user?.email ?? '',
        role:
            user?.role ??
            (assignableRoles.includes('staff') ? 'staff' : assignableRoles[0]),
        is_active: user?.is_active ?? true,
        password_mode: 'invite',
    });

    // Opsi role: yang boleh diberikan + role saat ini (agar tetap tampil).
    const roleOptions = Array.from(
        new Set<UserRole>([...(user ? [user.role] : []), ...assignableRoles]),
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (user) {
            form.transform((data) => ({
                name: data.name,
                email: data.email,
                role: data.role,
                is_active: data.is_active,
            }));
            form.put(`/settings/users/${user.id}`, options);
        } else {
            form.transform((data) => ({
                name: data.name,
                email: data.email,
                role: data.role,
                password_mode: data.password_mode,
            }));
            form.post('/settings/users', options);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => !form.processing && onOpenChange(v)}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Edit pengguna' : 'Tambah pengguna'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Ubah data, role, atau status akun.'
                            : 'Pengguna baru bisa masuk setelah password diatur.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="user-name">
                            Nama <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="user-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            autoComplete="off"
                            aria-invalid={!!form.errors.name || undefined}
                            autoFocus
                            required
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="user-email">
                            Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="user-email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) =>
                                form.setData(
                                    'email',
                                    e.target.value.toLowerCase(),
                                )
                            }
                            autoComplete="off"
                            aria-invalid={!!form.errors.email || undefined}
                            required
                        />
                        <InputError message={form.errors.email} />
                    </div>

                    {canChangeRole && (
                        <div className="grid gap-2">
                            <Label htmlFor="user-role">Role</Label>
                            <Select
                                value={form.data.role}
                                onValueChange={(v) =>
                                    form.setData('role', v as UserRole)
                                }
                            >
                                <SelectTrigger
                                    id="user-role"
                                    className="w-full"
                                    aria-invalid={
                                        !!form.errors.role || undefined
                                    }
                                >
                                    <SelectValue placeholder="Pilih role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roleOptions.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {roleLabels[r] ?? r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {ROLE_DESCRIPTIONS[form.data.role]}
                            </p>
                            <InputError message={form.errors.role} />
                        </div>
                    )}

                    {!isEdit && (
                        <fieldset className="grid gap-2">
                            <legend className="mb-2 text-sm font-medium">
                                Password
                            </legend>
                            {PASSWORD_MODES.map((mode) => (
                                <label
                                    key={mode.value}
                                    className={cn(
                                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
                                        form.data.password_mode ===
                                            mode.value &&
                                            'border-primary/40 bg-primary/5',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="password_mode"
                                        value={mode.value}
                                        checked={
                                            form.data.password_mode ===
                                            mode.value
                                        }
                                        onChange={() =>
                                            form.setData(
                                                'password_mode',
                                                mode.value,
                                            )
                                        }
                                        className="mt-1 accent-primary"
                                    />
                                    <span className="grid gap-0.5">
                                        <span className="text-sm font-medium">
                                            {mode.title}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {mode.hint}
                                        </span>
                                    </span>
                                </label>
                            ))}
                            <InputError message={form.errors.password_mode} />
                        </fieldset>
                    )}

                    {canDeactivate && (
                        <label
                            htmlFor="user-active"
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                        >
                            <Checkbox
                                id="user-active"
                                checked={form.data.is_active}
                                onCheckedChange={(v) =>
                                    form.setData('is_active', v === true)
                                }
                                className="mt-0.5"
                            />
                            <span className="grid gap-0.5">
                                <span className="text-sm font-medium">
                                    Akun aktif
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Pengguna nonaktif tidak bisa masuk dan
                                    langsung dikeluarkan dari sesi yang
                                    berjalan.
                                </span>
                            </span>
                        </label>
                    )}

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
                            {isEdit ? 'Simpan perubahan' : 'Tambah pengguna'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
