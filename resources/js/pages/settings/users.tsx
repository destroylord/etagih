import { Head, router } from '@inertiajs/react';
import {
    Crown,
    KeyRound,
    MoreHorizontal,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ActiveBadge, RoleBadge } from '@/components/users/role-badge';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';
import type { ManagedUser, TemporaryPassword } from '@/components/users/types';
import { UserFormDialog } from '@/components/users/user-form-dialog';
import type { UserRole } from '@/hooks/use-can';
import { formatDate } from '@/lib/format';

type Props = {
    users: ManagedUser[];
    assignableRoles: UserRole[];
    roleLabels: Record<UserRole, string>;
    temporaryPassword: TemporaryPassword | null;
};

type PendingAction =
    | { type: 'delete'; user: ManagedUser }
    | { type: 'transfer'; user: ManagedUser }
    | { type: 'reset'; user: ManagedUser };

const ACTION_COPY = {
    delete: {
        title: 'Hapus pengguna?',
        confirm: 'Hapus',
        description: (u: ManagedUser) =>
            `Akun ${u.name} (${u.email}) akan dihapus permanen. Catatan waktu miliknya tetap tersimpan tanpa nama pengguna. Untuk menahan akses sementara, nonaktifkan saja.`,
    },
    transfer: {
        title: 'Jadikan pemilik?',
        confirm: 'Alihkan kepemilikan',
        description: (u: ManagedUser) =>
            `${u.name} akan menjadi pemilik aplikasi. Role Anda berubah menjadi admin dan tidak bisa dikembalikan kecuali pemilik baru mengalihkannya lagi.`,
    },
    reset: {
        title: 'Kirim email reset password?',
        confirm: 'Kirim email',
        description: (u: ManagedUser) =>
            `Tautan untuk mengatur password baru akan dikirim ke ${u.email}. Password lama tetap berlaku sampai diganti.`,
    },
} as const;

export default function UsersSettings({
    users,
    assignableRoles,
    roleLabels,
    temporaryPassword,
}: Props) {
    const [formOpen, setFormOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [editing, setEditing] = useState<ManagedUser | null>(null);
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [lastPending, setLastPending] = useState<PendingAction | null>(null);

    // Simpan aksi terakhir supaya isi dialog tidak hilang saat animasi tutup.
    if (pending && pending !== lastPending) {
        setLastPending(pending);
    }

    const openForm = (user: ManagedUser | null) => {
        setEditing(user);
        setFormKey((k) => k + 1);
        setFormOpen(true);
    };

    const runPending = (done: () => void) => {
        if (!pending) {
            return done();
        }

        const { type, user } = pending;
        const options = { preserveScroll: true, onFinish: done };

        if (type === 'delete') {
            router.delete(`/settings/users/${user.id}`, options);
        } else if (type === 'transfer') {
            router.post(
                `/settings/users/${user.id}/transfer-ownership`,
                {},
                options,
            );
        } else {
            router.post(
                `/settings/users/${user.id}/password-reset`,
                {},
                options,
            );
        }
    };

    const shown = pending ?? lastPending;
    const copy = shown ? ACTION_COPY[shown.type] : null;

    const rowActions = (u: ManagedUser) => {
        const hasAny =
            u.can.edit ||
            u.can.reset_password ||
            u.can.transfer_ownership ||
            u.can.delete;

        if (!hasAny) {
            return null;
        }

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label={`Aksi untuk ${u.name}`}
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {u.can.edit && (
                        <DropdownMenuItem onSelect={() => openForm(u)}>
                            <Pencil /> Edit
                        </DropdownMenuItem>
                    )}
                    {u.can.reset_password && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setPending({ type: 'reset', user: u })
                            }
                        >
                            <KeyRound /> Kirim reset password
                        </DropdownMenuItem>
                    )}
                    {u.can.transfer_ownership && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setPending({ type: 'transfer', user: u })
                            }
                        >
                            <Crown /> Jadikan pemilik
                        </DropdownMenuItem>
                    )}
                    {u.can.delete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() =>
                                    setPending({ type: 'delete', user: u })
                                }
                            >
                                <Trash2 /> Hapus
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <>
            <Head title="Pengguna" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <Heading
                        variant="small"
                        title="Pengguna"
                        description="Kelola akun tim dan hak aksesnya: pemilik, admin, dan staf."
                    />
                    <Button onClick={() => openForm(null)}>
                        <Plus /> Tambah pengguna
                    </Button>
                </div>

                <Card className="gap-0 overflow-hidden py-0">
                    {users.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title="Belum ada pengguna"
                            description="Tambah akun untuk anggota tim Anda."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pengguna</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        2FA
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Dibuat
                                    </TableHead>
                                    <TableHead className="w-12">
                                        <span className="sr-only">Aksi</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {u.name}
                                                {u.is_self && (
                                                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                        (Anda)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {u.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <RoleBadge role={u.role} />
                                        </TableCell>
                                        <TableCell>
                                            <ActiveBadge active={u.is_active} />
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {u.two_factor_enabled ? (
                                                <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                                                    <ShieldCheck className="size-3.5" />
                                                    Aktif
                                                </span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                                            {formatDate(u.created_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {rowActions(u)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            </div>

            <UserFormDialog
                key={formKey}
                open={formOpen}
                onOpenChange={setFormOpen}
                user={editing}
                assignableRoles={assignableRoles}
                roleLabels={roleLabels}
            />

            <ConfirmDialog
                open={!!pending}
                onOpenChange={(v) => !v && setPending(null)}
                title={copy?.title ?? ''}
                description={shown && copy ? copy.description(shown.user) : ''}
                confirmLabel={copy?.confirm}
                destructive={shown?.type === 'delete'}
                onConfirm={runPending}
            />

            <TemporaryPasswordDialog value={temporaryPassword} />
        </>
    );
}

UsersSettings.layout = {
    breadcrumbs: [
        {
            title: 'Pengguna',
            href: '/settings/users',
        },
    ],
};
