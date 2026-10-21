import { Head, router } from '@inertiajs/react';
import {
    Crown,
    KeyRound,
    MailPlus,
    MoreHorizontal,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataCard, DataList } from '@/components/data-list';
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
import { RoleBadge, StatusBadge } from '@/components/users/role-badge';
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
    | { type: 'reset'; user: ManagedUser }
    | { type: 'resend'; user: ManagedUser };

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
    resend: {
        title: 'Kirim ulang undangan?',
        confirm: 'Kirim ulang',
        description: (u: ManagedUser) =>
            `Undangan baru (berlaku 7 hari) akan dikirim ke ${u.email}. Tautan undangan sebelumnya tidak berlaku lagi.`,
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
        } else if (type === 'resend') {
            router.post(
                `/settings/users/${user.id}/resend-invitation`,
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
            u.can.resend_invitation ||
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
                        className="size-10 text-muted-foreground md:size-8"
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
                    {u.can.resend_invitation && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setPending({ type: 'resend', user: u })
                            }
                        >
                            <MailPlus /> Kirim ulang undangan
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
                        <DataList
                            items={users}
                            getKey={(u) => u.id}
                            columns={[
                                {
                                    key: 'user',
                                    header: 'Pengguna',
                                    cell: (u) => (
                                        <>
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
                                        </>
                                    ),
                                },
                                {
                                    key: 'role',
                                    header: 'Role',
                                    cell: (u) => <RoleBadge role={u.role} />,
                                },
                                {
                                    key: 'status',
                                    header: 'Status',
                                    cell: (u) => (
                                        <StatusBadge status={u.status} />
                                    ),
                                },
                                {
                                    key: '2fa',
                                    header: '2FA',
                                    cell: (u) => (
                                        <TwoFactor
                                            enabled={u.two_factor_enabled}
                                        />
                                    ),
                                },
                                {
                                    key: 'created',
                                    header: 'Dibuat',
                                    className: 'text-sm text-muted-foreground',
                                    cell: (u) => formatDate(u.created_at),
                                },
                                {
                                    key: 'actions',
                                    header: (
                                        <span className="sr-only">Aksi</span>
                                    ),
                                    className: 'w-12 text-right',
                                    cell: (u) => rowActions(u),
                                },
                            ]}
                            renderCard={(u) => (
                                <DataCard
                                    title={
                                        <>
                                            {u.name}
                                            {u.is_self && (
                                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                    (Anda)
                                                </span>
                                            )}
                                        </>
                                    }
                                    subtitle={u.email}
                                    badge={<StatusBadge status={u.status} />}
                                    meta={
                                        <>
                                            <RoleBadge role={u.role} />
                                            {u.two_factor_enabled && (
                                                <TwoFactor enabled />
                                            )}
                                            <span>
                                                Dibuat{' '}
                                                {formatDate(u.created_at)}
                                            </span>
                                        </>
                                    }
                                />
                            )}
                            renderCardActions={(u) => rowActions(u)}
                        />
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

function TwoFactor({ enabled }: { enabled: boolean }) {
    return enabled ? (
        <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />
            2FA aktif
        </span>
    ) : (
        <span className="text-sm text-muted-foreground">—</span>
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
