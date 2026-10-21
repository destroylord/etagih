import { Link, router } from '@inertiajs/react';
import { Search, UserCog, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { initials } from '@/components/tasks/task-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    ResponsiveDialog,
    ResponsiveDialogBody,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { ROLE_LABEL } from '@/lib/navigation';
import { sync as syncMembers } from '@/routes/projects/members';
import type { ProjectMember } from '@/types/tasks';

function RoleBadge({ role }: { role: ProjectMember['role'] }) {
    return (
        <Badge
            variant={role === 'staff' ? 'outline' : 'secondary'}
            className="shrink-0"
        >
            {ROLE_LABEL[role]}
        </Badge>
    );
}

/**
 * Anggota tim proyek (disimpan di proyek utama; sub-proyek mewarisi).
 * Admin bisa "Kelola anggota". Owner/admin selalu punya akses ke semua
 * proyek, jadi daftar ini terutama untuk staf.
 */
export function ProjectMembersCard({
    projectId,
    members,
    assignableUsers,
    canManage,
    parent = null,
}: {
    projectId: number;
    members: ProjectMember[];
    assignableUsers: ProjectMember[];
    canManage: boolean;
    /** Isi bila halaman ini sub-proyek. */
    parent?: { id: number; name: string } | null;
}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [query, setQuery] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const openDialog = () => {
        setSelected(members.map((m) => m.id));
        setQuery('');
        setError(undefined);
        setOpen(true);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return q
            ? assignableUsers.filter(
                  (u) =>
                      u.name.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q),
              )
            : assignableUsers;
    }, [assignableUsers, query]);

    const toggle = (id: number, on: boolean) =>
        setSelected((s) =>
            on ? [...new Set([...s, id])] : s.filter((x) => x !== id),
        );

    const save = () => {
        router.put(
            syncMembers.url(projectId),
            { user_ids: selected },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => setOpen(false),
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ?? 'Gagal menyimpan anggota.',
                    ),
            },
        );
    };

    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1.5">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="size-4 text-muted-foreground" />
                        Anggota
                        <span className="text-sm font-normal text-muted-foreground tabular-nums">
                            {members.length}
                        </span>
                    </CardTitle>
                    {parent && (
                        <CardDescription>
                            Anggota diatur di proyek utama{' '}
                            <Link
                                href={`/projects/${parent.id}`}
                                className="font-medium text-foreground hover:underline"
                            >
                                {parent.name}
                            </Link>
                            .
                        </CardDescription>
                    )}
                </div>
                {canManage && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-11 shrink-0 sm:h-8"
                        onClick={openDialog}
                    >
                        <UserCog /> Kelola
                        <span className="sr-only"> anggota</span>
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Belum ada anggota. Admin & pemilik selalu bisa mengakses
                        proyek ini; tambahkan staf agar mereka bisa melihat dan
                        mengerjakan task-nya.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {members.map((m) => (
                            <li key={m.id} className="flex items-center gap-3">
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary dark:bg-primary/20"
                                >
                                    {initials(m.name)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {m.name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {m.email}
                                    </p>
                                </div>
                                <RoleBadge role={m.role} />
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>

            {canManage && (
                <ResponsiveDialog
                    open={open}
                    onOpenChange={(v) => !processing && setOpen(v)}
                >
                    <ResponsiveDialogContent className="sm:max-w-md">
                        <ResponsiveDialogHeader>
                            <ResponsiveDialogTitle>
                                Kelola anggota
                            </ResponsiveDialogTitle>
                            <ResponsiveDialogDescription>
                                Staf hanya bisa melihat proyek (dan
                                sub-proyeknya) tempat ia menjadi anggota.
                                {parent &&
                                    ` Perubahan disimpan di proyek utama ${parent.name}.`}
                            </ResponsiveDialogDescription>
                        </ResponsiveDialogHeader>
                        <ResponsiveDialogBody className="grid gap-3">
                            {assignableUsers.length > 6 && (
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        placeholder="Cari nama atau email…"
                                        aria-label="Cari pengguna"
                                        className="h-11 pl-9 md:h-9"
                                    />
                                </div>
                            )}
                            <ul className="-mx-2 max-h-[50dvh] overflow-y-auto">
                                {filtered.map((u) => {
                                    const id = `member-${u.id}`;
                                    const checked = selected.includes(u.id);

                                    return (
                                        <li key={u.id}>
                                            <label
                                                htmlFor={id}
                                                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                                            >
                                                <Checkbox
                                                    id={id}
                                                    checked={checked}
                                                    onCheckedChange={(v) =>
                                                        toggle(u.id, v === true)
                                                    }
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">
                                                        {u.name}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {u.email}
                                                    </span>
                                                </span>
                                                <RoleBadge role={u.role} />
                                            </label>
                                        </li>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                                        Tidak ada pengguna yang cocok.
                                    </li>
                                )}
                            </ul>
                            <InputError message={error} />
                        </ResponsiveDialogBody>
                        <ResponsiveDialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={processing}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={save}
                                disabled={processing}
                            >
                                {processing && <Spinner />}
                                Simpan ({selected.length})
                            </Button>
                        </ResponsiveDialogFooter>
                    </ResponsiveDialogContent>
                </ResponsiveDialog>
            )}
        </Card>
    );
}
