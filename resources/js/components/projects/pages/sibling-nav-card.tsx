import { Link } from '@inertiajs/react';
import { CornerDownRight, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectNode } from '@/types/models';
import { ProjectStatusBadge, ShareBar, percentOf } from './project-helpers';

/** Navigasi untuk sub-proyek: proyek induk + sub-proyek lain (saudara). */
export function SiblingNavCard({
    tree,
    currentId,
}: {
    tree: ProjectNode;
    currentId: number;
}) {
    const children = tree.children ?? [];
    const total = tree.stats.work_value;

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
                <CardTitle className="text-base">Proyek utama</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Link
                    href={`/projects/${tree.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-6"
                >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FolderKanban className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                            {tree.name}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                            Nilai pekerjaan {formatIDR(total)}
                        </span>
                    </span>
                    <ProjectStatusBadge status={tree.status} />
                </Link>
                <nav aria-label="Sub-proyek lain" className="border-t">
                    <ul className="py-1">
                        {children.map((c) => {
                            const active = c.id === currentId;
                            const pct = percentOf(c.stats.work_value, total);

                            return (
                                <li key={c.id}>
                                    <Link
                                        href={`/projects/${c.id}`}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={cn(
                                            'flex flex-col gap-1.5 px-4 py-2.5 transition-colors focus-visible:outline-none sm:px-6',
                                            active
                                                ? 'bg-muted'
                                                : 'hover:bg-muted/50 focus-visible:bg-muted/50',
                                        )}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <CornerDownRight
                                                    className="size-3.5 shrink-0 text-muted-foreground"
                                                    aria-hidden
                                                />
                                                <span
                                                    className={cn(
                                                        'truncate text-sm',
                                                        active && 'font-medium',
                                                    )}
                                                >
                                                    {c.name}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                                {formatIDR(c.stats.work_value)}
                                            </span>
                                        </span>
                                        <ShareBar
                                            value={pct}
                                            label={`Porsi ${c.name}`}
                                            className="ml-5.5 w-auto"
                                        />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </CardContent>
        </Card>
    );
}
