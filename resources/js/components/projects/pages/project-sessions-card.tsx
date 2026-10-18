import { Link } from '@inertiajs/react';
import { ExternalLink, Play, Timer } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatDuration } from '@/lib/format';
import type { WorkSession } from '@/types/models';
import { projectPath } from './project-helpers';

/** 10 sesi Time Tracker terbaru untuk proyek (dan sub-proyeknya). */
export function ProjectSessionsCard({
    sessions,
    timerHref,
}: {
    sessions: WorkSession[];
    timerHref: string;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Timer className="size-4 text-muted-foreground" /> Sesi
                    kerja terbaru
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={timerHref}>
                        Time Tracker <ExternalLink />
                    </Link>
                </Button>
            </CardHeader>

            {sessions.length === 0 ? (
                <EmptyState
                    icon={Timer}
                    title="Belum ada sesi kerja"
                    description="Catat jam kerja dengan Time Tracker agar bisa ditagih per jam."
                    action={
                        <Button variant="outline" asChild>
                            <Link href={timerHref}>
                                <Play /> Mulai timer
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <ul className="divide-y">
                    {sessions.map((s) => {
                        const live =
                            s.status === 'running' || s.status === 'paused';

                        return (
                            <li
                                key={s.id}
                                className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {s.description || 'Tanpa deskripsi'}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {projectPath(s.project) ??
                                            'Tanpa proyek'}{' '}
                                        · {formatDateTime(s.started_at)}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-sm tabular-nums">
                                        {live && !s.duration_seconds
                                            ? '—'
                                            : formatDuration(
                                                  s.duration_seconds ?? 0,
                                              )}
                                    </span>
                                    <StatusBadge status={s.status} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
