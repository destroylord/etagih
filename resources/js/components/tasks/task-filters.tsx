import { X } from 'lucide-react';
import { useMemo } from 'react';
import { FilterSheet } from '@/components/mobile/filter-sheet';
import { groupProjectsByClient } from '@/components/tasks/task-utils';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TASK_PRIORITIES } from '@/types/tasks';
import type {
    TaskFilters,
    TaskPriority,
    TaskProjectOption,
    TaskUserOption,
    TaskView,
} from '@/types/tasks';

const ALL = 'all';

export type TaskFilterPatch = Partial<TaskFilters>;

/** Jumlah filter aktif (selain pencarian). */
export function activeFilterCount(
    filters: TaskFilters,
    view: TaskView,
): number {
    return (
        (filters.project_id ? 1 : 0) +
        (filters.client_id ? 1 : 0) +
        (filters.assignee_id && view !== 'mine' ? 1 : 0) +
        (filters.priority ? 1 : 0) +
        (filters.due ? 1 : 0) +
        (filters.status ? 1 : 0)
    );
}

/**
 * Kontrol filter halaman task (inline di desktop, bottom sheet di mobile).
 * Filter penanggung jawab disembunyikan di "Task saya" (selalu milik saya).
 */
export function TaskFilterControls({
    view,
    filters,
    projects,
    users,
    priorityLabels,
    onApply,
    onReset,
}: {
    view: TaskView;
    filters: TaskFilters;
    projects: TaskProjectOption[];
    users: TaskUserOption[];
    priorityLabels: Record<TaskPriority, string>;
    onApply: (patch: TaskFilterPatch) => void;
    onReset: () => void;
}) {
    const groups = useMemo(() => groupProjectsByClient(projects), [projects]);
    const clients = useMemo(() => groups.map((g) => g.client), [groups]);
    const visibleGroups = filters.client_id
        ? groups.filter((g) => g.client.id === filters.client_id)
        : groups;
    const count = activeFilterCount(filters, view);

    return (
        <FilterSheet
            className="flex flex-wrap items-center gap-2"
            activeCount={count}
            onReset={count > 0 ? onReset : undefined}
        >
            {clients.length > 1 && (
                <Select
                    value={filters.client_id ? String(filters.client_id) : ALL}
                    onValueChange={(v) =>
                        onApply({
                            client_id: v === ALL ? null : Number(v),
                            // Proyek dari klien lain tidak relevan lagi.
                            project_id:
                                v !== ALL &&
                                filters.project_id &&
                                !projects.some(
                                    (p) =>
                                        p.id === filters.project_id &&
                                        p.client.id === Number(v),
                                )
                                    ? null
                                    : filters.project_id,
                        })
                    }
                >
                    <SelectTrigger
                        className="w-full md:w-40"
                        aria-label="Klien"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Semua klien</SelectItem>
                        {clients.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            <Select
                value={filters.project_id ? String(filters.project_id) : ALL}
                onValueChange={(v) =>
                    onApply({ project_id: v === ALL ? null : Number(v) })
                }
            >
                <SelectTrigger className="w-full md:w-48" aria-label="Proyek">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>Semua proyek</SelectItem>
                    {visibleGroups.map((g) => (
                        <SelectGroup key={g.client.id}>
                            <SelectLabel>{g.client.name}</SelectLabel>
                            {g.projects.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                    {p.parent_id ? `↳ ${p.full_name}` : p.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>

            {view !== 'mine' && (
                <Select
                    value={filters.assignee_id ?? ALL}
                    onValueChange={(v) =>
                        onApply({ assignee_id: v === ALL ? null : v })
                    }
                >
                    <SelectTrigger
                        className="w-full md:w-44"
                        aria-label="Penanggung jawab"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Semua orang</SelectItem>
                        <SelectItem value="me">Saya</SelectItem>
                        <SelectItem value="none">
                            Tanpa penanggung jawab
                        </SelectItem>
                        {users.length > 0 && (
                            <SelectGroup>
                                <SelectLabel>Tim</SelectLabel>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        )}
                    </SelectContent>
                </Select>
            )}

            <Select
                value={filters.priority ?? ALL}
                onValueChange={(v) =>
                    onApply({
                        priority: v === ALL ? null : (v as TaskPriority),
                    })
                }
            >
                <SelectTrigger
                    className="w-full md:w-36"
                    aria-label="Prioritas"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>Semua prioritas</SelectItem>
                    {[...TASK_PRIORITIES].reverse().map((p) => (
                        <SelectItem key={p} value={p}>
                            {priorityLabels[p]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={filters.due ?? ALL}
                onValueChange={(v) =>
                    onApply({
                        due: v === ALL ? null : (v as TaskFilters['due']),
                    })
                }
            >
                <SelectTrigger className="w-full md:w-36" aria-label="Tenggat">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>Semua tenggat</SelectItem>
                    <SelectItem value="overdue">Terlambat</SelectItem>
                    <SelectItem value="today">Hari ini</SelectItem>
                    <SelectItem value="week">Minggu ini</SelectItem>
                </SelectContent>
            </Select>

            {count > 0 && (
                <Button
                    variant="ghost"
                    onClick={onReset}
                    className="hidden shrink-0 md:inline-flex"
                >
                    <X /> Reset
                </Button>
            )}
        </FilterSheet>
    );
}
