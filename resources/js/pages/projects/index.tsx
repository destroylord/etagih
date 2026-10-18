import { Head, Link, router } from '@inertiajs/react';
import { FolderKanban, Plus, Search, SearchX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { ProjectTreeList } from '@/components/projects/pages/project-tree-list';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, ProjectNode, ProjectStatus } from '@/types/models';

type Filters = {
    q?: string | null;
    client_id?: string | number | null;
    status?: ProjectStatus | string | null;
};

type Props = {
    projects: Paginated<ProjectNode>;
    clients: { id: number; name: string }[];
    filters: Filters;
};

const ALL = '__all';

const STATUS_TABS: { value: string; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'active', label: 'Aktif' },
    { value: 'completed', label: 'Selesai' },
    { value: 'archived', label: 'Diarsipkan' },
];

function buildQuery(f: {
    q: string;
    client_id: string;
    status: string;
}): Record<string, string> {
    const query: Record<string, string> = {};

    if (f.q) {
        query.q = f.q;
    }

    if (f.client_id) {
        query.client_id = f.client_id;
    }

    if (f.status) {
        query.status = f.status;
    }

    return query;
}

type FormState =
    | { mode: 'create' }
    | { mode: 'sub'; parent: ProjectNode }
    | { mode: 'edit'; project: ProjectNode };

export default function ProjectsIndex({ projects, clients, filters }: Props) {
    const current = {
        q: filters.q ?? '',
        client_id: filters.client_id ? String(filters.client_id) : '',
        status: filters.status ?? '',
    };
    const [search, setSearch] = useState(current.q);
    const [loading, setLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    const [formOpen, setFormOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [formState, setFormState] = useState<FormState>({ mode: 'create' });

    const openForm = (state: FormState) => {
        setFormState(state);
        setFormKey((k) => k + 1);
        setFormOpen(true);
    };

    const hasFilters = !!(current.q || current.client_id || current.status);

    const apply = (patch: Partial<typeof current>) => {
        router.get('/projects', buildQuery({ ...current, ...patch }), {
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
            if (value.trim() !== current.q) {
                apply({ q: value.trim() });
            }
        }, 350);
    };

    const resetFilters = () => {
        clearTimeout(searchTimer.current);
        setSearch('');
        router.get(
            '/projects',
            {},
            {
                preserveScroll: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    const parentOptions = projects.data.map((p) => ({
        id: p.id,
        name: p.name,
        client_id: p.client_id,
    }));

    const noClients = clients.length === 0;

    return (
        <>
            <Head title="Proyek" />
            <PageContainer>
                <PageHeader
                    title="Proyek"
                    description="Kelompokkan invoice & jam kerja per proyek dan sub-proyek klien."
                    actions={
                        <Button
                            onClick={() => openForm({ mode: 'create' })}
                            disabled={noClients}
                            title={
                                noClients
                                    ? 'Tambahkan klien terlebih dahulu'
                                    : undefined
                            }
                        >
                            <Plus /> Tambah proyek
                        </Button>
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
                    {/* Tab status */}
                    <div className="border-b">
                        <nav
                            className="-mb-px flex [scrollbar-width:none] gap-1 overflow-x-auto px-3 sm:px-4"
                            aria-label="Filter status proyek"
                        >
                            {STATUS_TABS.map((tab) => {
                                const active = current.status === tab.value;

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
                                            'shrink-0 border-b-2 px-2.5 py-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                                            active
                                                ? 'border-primary text-foreground'
                                                : 'border-transparent text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Pencarian & klien */}
                    <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <Input
                                type="search"
                                placeholder="Cari proyek, sub-proyek, atau klien…"
                                aria-label="Cari proyek"
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        clearTimeout(searchTimer.current);
                                        apply({ q: search.trim() });
                                    }
                                }}
                                className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
                            />
                            {loading && (
                                <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Select
                                value={current.client_id || ALL}
                                onValueChange={(v) =>
                                    apply({ client_id: v === ALL ? '' : v })
                                }
                            >
                                <SelectTrigger
                                    className="w-full sm:w-52"
                                    aria-label="Filter klien"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>
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

                    {projects.data.length === 0 ? (
                        hasFilters ? (
                            <EmptyState
                                icon={SearchX}
                                title="Proyek tidak ditemukan"
                                description="Tidak ada proyek yang cocok dengan filter ini. Coba kata kunci, klien, atau status lain."
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
                                icon={FolderKanban}
                                title="Belum ada proyek"
                                description={
                                    noClients
                                        ? 'Tambahkan klien terlebih dahulu, lalu buat proyek untuk mengelompokkan invoice dan jam kerjanya.'
                                        : 'Buat proyek (mis. "Toko Online") lalu sub-proyek (mis. "Aplikasi Mobile", "Dashboard Admin") untuk memantau tagihan & jam kerja per pekerjaan.'
                                }
                                action={
                                    noClients ? (
                                        <Button asChild>
                                            <Link href="/clients">
                                                <Plus /> Tambah klien
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() =>
                                                openForm({ mode: 'create' })
                                            }
                                        >
                                            <Plus /> Tambah proyek
                                        </Button>
                                    )
                                }
                            />
                        )
                    ) : (
                        <>
                            <p className="sr-only" aria-live="polite">
                                {formatNumber(projects.total)} proyek
                            </p>
                            <ProjectTreeList
                                projects={projects.data}
                                expandByDefault={!!current.q}
                                onEdit={(project) =>
                                    openForm({ mode: 'edit', project })
                                }
                                onAddSub={(parent) =>
                                    openForm({ mode: 'sub', parent })
                                }
                            />
                        </>
                    )}

                    <DataPagination paginator={projects} noun="proyek" />
                </Card>

                {projects.data.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Angka proyek utama sudah termasuk semua sub-proyeknya.
                        Ditagih/terbayar dihitung dari invoice yang ditautkan
                        langsung (tanpa draft &amp; dibatalkan).
                    </p>
                )}
            </PageContainer>

            <ProjectFormDialog
                key={formKey}
                open={formOpen}
                onOpenChange={setFormOpen}
                project={formState.mode === 'edit' ? formState.project : null}
                clientId={
                    formState.mode === 'sub' ? formState.parent.client_id : null
                }
                parentId={formState.mode === 'sub' ? formState.parent.id : null}
                clients={clients}
                parentOptions={parentOptions}
            />
        </>
    );
}

ProjectsIndex.layout = {
    breadcrumbs: [{ title: 'Proyek', href: '/projects' }],
};
