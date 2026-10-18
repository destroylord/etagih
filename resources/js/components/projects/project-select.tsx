import { FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectOption } from '@/types/models';

/**
 * Pilihan proyek bertingkat (Proyek → Sub-proyek) untuk satu klien.
 * Native <select> supaya ringan, ramah keyboard & mobile.
 *
 * - `clientId`        : hanya proyek milik klien ini yang ditampilkan.
 * - `withinProjectId` : batasi ke proyek tsb + sub-proyeknya (mis. item invoice).
 * - `value` null      : "Tanpa proyek" (atau `emptyLabel`).
 */
export function ProjectSelect({
    projects,
    clientId,
    value,
    onChange,
    withinProjectId = null,
    emptyLabel = 'Tanpa proyek',
    id,
    className,
    disabled,
    'aria-invalid': ariaInvalid,
}: {
    projects: ProjectOption[];
    clientId: number | null | undefined;
    value: number | null;
    onChange: (projectId: number | null, project: ProjectOption | null) => void;
    withinProjectId?: number | null;
    emptyLabel?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
    'aria-invalid'?: boolean;
}) {
    const own = projects.filter((p) => p.client_id === clientId);
    const roots = own
        .filter((p) => p.parent_id === null)
        .filter(
            (p) =>
                withinProjectId === null ||
                p.id === withinProjectId ||
                own.some(
                    (c) => c.id === withinProjectId && c.parent_id === p.id,
                ),
        );
    const childrenOf = (id: number) => own.filter((p) => p.parent_id === id);

    // Bila dibatasi ke sebuah sub-proyek, hanya sub-proyek itu yang relevan.
    const within =
        withinProjectId !== null
            ? own.find((p) => p.id === withinProjectId)
            : null;
    const withinIsSub = within?.parent_id != null;

    const noProjects = own.length === 0;

    return (
        <div className={cn('relative', className)}>
            <FolderKanban className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
                id={id}
                value={value ?? ''}
                disabled={disabled || !clientId || noProjects}
                aria-invalid={ariaInvalid}
                onChange={(e) => {
                    const next = e.target.value ? Number(e.target.value) : null;
                    onChange(next, own.find((p) => p.id === next) ?? null);
                }}
                className={cn(
                    'h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-8 text-sm shadow-xs transition-[color,box-shadow] outline-none',
                    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30',
                )}
            >
                <option value="">
                    {!clientId
                        ? 'Pilih klien dulu'
                        : noProjects
                          ? 'Klien belum punya proyek'
                          : emptyLabel}
                </option>
                {withinIsSub && within ? (
                    <option value={within.id}>{within.full_name}</option>
                ) : (
                    roots.map((root) => {
                        const kids = childrenOf(root.id);

                        return kids.length === 0 ? (
                            <option key={root.id} value={root.id}>
                                {root.name}
                            </option>
                        ) : (
                            <optgroup key={root.id} label={root.name}>
                                <option value={root.id}>
                                    {root.name} (seluruh proyek)
                                </option>
                                {kids.map((k) => (
                                    <option key={k.id} value={k.id}>
                                        └ {k.name}
                                    </option>
                                ))}
                            </optgroup>
                        );
                    })
                )}
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
