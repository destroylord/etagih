import { FolderKanban, X } from 'lucide-react';
import { statusLabel } from '@/components/invoice-status-badge';
import { ProjectSelect } from '@/components/projects/project-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ProjectOption } from '@/types/models';
import type { TrackerClient, TrackerFilters } from './types';

const STATUSES = [
    'running',
    'paused',
    'completed',
    'billed',
    'cancelled',
] as const;

/** Semua proyek dikelompokkan per client (dipakai saat filter client kosong). */
function AllProjectsSelect({
    id,
    projects,
    clients,
    value,
    onChange,
}: {
    id: string;
    projects: ProjectOption[];
    clients: TrackerClient[];
    value: number | null;
    onChange: (id: number | null) => void;
}) {
    const groups = clients
        .map((c) => ({
            client: c,
            items: projects
                .filter((p) => p.client_id === c.id)
                .sort((a, b) => a.full_name.localeCompare(b.full_name)),
        }))
        .filter((g) => g.items.length > 0);

    return (
        <div className="relative">
            <FolderKanban className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
                id={id}
                value={value ?? ''}
                disabled={groups.length === 0}
                onChange={(e) =>
                    onChange(e.target.value ? Number(e.target.value) : null)
                }
                className="h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-8 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            >
                <option value="">
                    {groups.length === 0 ? 'Belum ada proyek' : 'Semua proyek'}
                </option>
                {groups.map((g) => (
                    <optgroup key={g.client.id} label={g.client.name}>
                        {g.items.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.parent_id ? `└ ${p.full_name}` : p.name}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
            <svg
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </div>
    );
}

export function SessionFilters({
    filters,
    clients,
    projects,
    onChange,
    onReset,
}: {
    filters: TrackerFilters;
    clients: TrackerClient[];
    projects: ProjectOption[];
    onChange: (patch: Partial<TrackerFilters>) => void;
    onReset: () => void;
}) {
    const hasFilter = Object.values(filters).some((v) => v);
    const clientId = filters.client_id ? Number(filters.client_id) : null;
    const projectId = filters.project_id ? Number(filters.project_id) : null;
    const setProject = (id: number | null) =>
        onChange({ project_id: id ? String(id) : '' });

    return (
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_9.5rem_9.5rem_auto]">
            <div className="grid gap-1.5">
                <Label
                    htmlFor="f-client"
                    className="text-xs text-muted-foreground"
                >
                    Client
                </Label>
                <Select
                    value={filters.client_id || 'all'}
                    onValueChange={(v) =>
                        // Proyek milik client lama tidak relevan lagi.
                        onChange({
                            client_id: v === 'all' ? '' : v,
                            project_id: '',
                        })
                    }
                >
                    <SelectTrigger id="f-client" className="w-full">
                        <SelectValue placeholder="Semua client" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua client</SelectItem>
                        {clients.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label
                    htmlFor="f-project"
                    className="text-xs text-muted-foreground"
                >
                    Proyek
                </Label>
                {clientId ? (
                    <ProjectSelect
                        id="f-project"
                        projects={projects}
                        clientId={clientId}
                        value={projectId}
                        onChange={(id) => setProject(id)}
                        emptyLabel="Semua proyek"
                    />
                ) : (
                    <AllProjectsSelect
                        id="f-project"
                        projects={projects}
                        clients={clients}
                        value={projectId}
                        onChange={setProject}
                    />
                )}
            </div>
            <div className="grid gap-1.5">
                <Label
                    htmlFor="f-status"
                    className="text-xs text-muted-foreground"
                >
                    Status
                </Label>
                <Select
                    value={filters.status || 'all'}
                    onValueChange={(v) =>
                        onChange({ status: v === 'all' ? '' : v })
                    }
                >
                    <SelectTrigger id="f-status" className="w-full">
                        <SelectValue placeholder="Semua status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua status</SelectItem>
                        {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                                {statusLabel(s)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label
                    htmlFor="f-from"
                    className="text-xs text-muted-foreground"
                >
                    Dari tanggal
                </Label>
                <Input
                    id="f-from"
                    type="date"
                    value={filters.date_from ?? ''}
                    max={filters.date_to || undefined}
                    onChange={(e) => onChange({ date_from: e.target.value })}
                />
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="f-to" className="text-xs text-muted-foreground">
                    Sampai tanggal
                </Label>
                <Input
                    id="f-to"
                    type="date"
                    value={filters.date_to ?? ''}
                    min={filters.date_from || undefined}
                    onChange={(e) => onChange({ date_to: e.target.value })}
                />
            </div>
            {hasFilter ? (
                <Button
                    variant="ghost"
                    onClick={onReset}
                    className="justify-self-start"
                >
                    <X /> Reset
                </Button>
            ) : (
                <span className="hidden xl:block" />
            )}
        </div>
    );
}
