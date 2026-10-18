import { Link } from '@inertiajs/react';
import { Clock, FolderKanban } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate, formatDuration, formatIDR, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOption } from '@/types/models';
import type { FormSession } from './utils';

/** Nama lengkap proyek sesi ("Gym › Allstar"), dari daftar proyek atau relasi sesi. */
export function sessionProjectName(
    s: FormSession,
    projects: ProjectOption[],
): string | null {
    if (s.project_id === null || s.project_id === undefined) {
        return null;
    }

    const option = projects.find((p) => p.id === s.project_id);

    if (option) {
        return option.full_name;
    }

    if (s.project) {
        return (
            s.project.full_name ??
            (s.project.parent
                ? `${s.project.parent.name} › ${s.project.name}`
                : s.project.name)
        );
    }

    return null;
}

/** Sesi termasuk proyek `rootId` (proyek itu sendiri atau sub-proyeknya)? */
export function sessionInProject(
    s: FormSession,
    projects: ProjectOption[],
    rootId: number,
): boolean {
    if (s.project_id === null || s.project_id === undefined) {
        return false;
    }

    if (s.project_id === rootId) {
        return true;
    }

    const parentId =
        projects.find((p) => p.id === s.project_id)?.parent_id ??
        s.project?.parent_id ??
        null;

    return parentId === rootId;
}

/** Daftar sesi Time Tracker (belum ditagih) yang bisa dicentang jadi item invoice. */
export function SessionPicker({
    sessions,
    selectedIds,
    projects,
    projectId,
    onToggle,
    onToggleAll,
}: {
    sessions: FormSession[];
    selectedIds: Set<number>;
    projects: ProjectOption[];
    /** Proyek invoice; bila diisi, sesi proyek tsb (+ sub-proyek) ditampilkan lebih dulu. */
    projectId: number | null;
    onToggle: (session: FormSession, checked: boolean) => void;
    onToggleAll: (sessions: FormSession[], checked: boolean) => void;
}) {
    const [showAll, setShowAll] = useState(false);

    const inProject = (s: FormSession) =>
        projectId !== null && sessionInProject(s, projects, projectId);
    const projectSessions =
        projectId !== null ? sessions.filter(inProject) : sessions;
    const filtering = projectId !== null && !showAll;
    // Saat difilter, sesi yang sudah dicentang tetap tampil agar bisa dilepas.
    const visible = filtering
        ? sessions.filter((s) => inProject(s) || selectedIds.has(s.id))
        : projectId !== null
          ? [...projectSessions, ...sessions.filter((s) => !inProject(s))]
          : sessions;
    const hiddenCount = sessions.length - visible.length;

    const selectedCount = sessions.filter((s) => selectedIds.has(s.id)).length;
    const visibleSelected = visible.filter((s) => selectedIds.has(s.id)).length;
    const allSelected =
        visible.length > 0 && visibleSelected === visible.length;
    const selectedSeconds = sessions
        .filter((s) => selectedIds.has(s.id))
        .reduce((sum, s) => sum + toNumber(s.duration_seconds), 0);
    const projectName =
        projectId !== null
            ? projects.find((p) => p.id === projectId)?.full_name
            : undefined;

    return (
        <div className="rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="size-4 text-muted-foreground" />
                    Sesi Time Tracker
                    <span className="font-normal text-muted-foreground">
                        {selectedCount}/{sessions.length} dipilih
                        {selectedCount > 0 &&
                            ` · ${formatDuration(selectedSeconds)}`}
                    </span>
                </div>
                {visible.length > 1 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => onToggleAll(visible, !allSelected)}
                    >
                        {allSelected ? 'Kosongkan' : 'Pilih semua'}
                    </Button>
                )}
            </div>

            {projectId !== null && sessions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <FolderKanban className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {projectSessions.length} sesi di proyek{' '}
                            <span className="font-medium text-foreground">
                                {projectName ?? 'terpilih'}
                            </span>
                            {filtering &&
                                hiddenCount > 0 &&
                                ` · ${hiddenCount} sesi lain disembunyikan`}
                        </span>
                    </span>
                    <label
                        htmlFor="session-show-all"
                        className="flex cursor-pointer items-center gap-2"
                    >
                        <Checkbox
                            id="session-show-all"
                            checked={showAll}
                            onCheckedChange={(c) => setShowAll(c === true)}
                        />
                        Tampilkan semua sesi klien
                    </label>
                </div>
            )}

            {visible.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                    {sessions.length > 0 ? (
                        <>
                            Tidak ada sesi belum ditagih untuk proyek ini.
                            Centang “Tampilkan semua sesi klien” untuk melihat
                            sesi lain.
                        </>
                    ) : (
                        <>
                            Tidak ada sesi selesai yang belum ditagih untuk
                            client ini.{' '}
                            <Link
                                href="/time-tracker"
                                className="font-medium text-foreground underline underline-offset-4"
                            >
                                Buka Time Tracker
                            </Link>
                            .
                        </>
                    )}
                </p>
            ) : (
                <ul className="max-h-72 divide-y overflow-y-auto">
                    {visible.map((s) => {
                        const checked = selectedIds.has(s.id);
                        const hours = toNumber(s.duration_seconds) / 3600;
                        const id = `session-pick-${s.id}`;
                        const project = sessionProjectName(s, projects);
                        const outside = projectId !== null && !inProject(s);

                        return (
                            <li key={s.id}>
                                <label
                                    htmlFor={id}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                                        checked
                                            ? 'bg-primary/5'
                                            : 'hover:bg-muted/50',
                                    )}
                                >
                                    <Checkbox
                                        id={id}
                                        checked={checked}
                                        onCheckedChange={(c) =>
                                            onToggle(s, c === true)
                                        }
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {s.description || 'Sesi kerja'}
                                        </p>
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                            {formatDate(s.started_at)} ·{' '}
                                            {formatDuration(s.duration_seconds)}{' '}
                                            × {formatIDR(s.unit_price)}/jam
                                        </p>
                                        {(project || outside) && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <Badge
                                                    variant={
                                                        outside
                                                            ? 'outline'
                                                            : 'secondary'
                                                    }
                                                    className={cn(
                                                        'max-w-full gap-1 font-normal',
                                                        outside &&
                                                            'text-muted-foreground',
                                                    )}
                                                >
                                                    <FolderKanban className="size-3" />
                                                    <span className="truncate">
                                                        {project ??
                                                            'Tanpa proyek'}
                                                    </span>
                                                </Badge>
                                                {outside && (
                                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                                        di luar proyek invoice
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                                        {formatIDR(
                                            hours * toNumber(s.unit_price),
                                        )}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
