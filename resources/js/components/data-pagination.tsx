import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Paginated } from '@/types/models';

/**
 * Footer tabel dengan info "1–20 dari 57" + tombol halaman.
 * Pakai langsung objek paginator Laravel (`->paginate()->withQueryString()`).
 */
export function DataPagination<T>({
    paginator,
    noun = 'data',
}: {
    paginator: Paginated<T>;
    noun?: string;
}) {
    if (paginator.total === 0) {
        return null;
    }

    const pages = paginator.links.slice(1, -1);
    const prev = paginator.links[0]?.url;
    const next = paginator.links[paginator.links.length - 1]?.url;

    return (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <p className="min-w-0 truncate text-muted-foreground">
                {paginator.from}–{paginator.to} dari {paginator.total} {noun}
            </p>
            {paginator.last_page > 1 && (
                <nav
                    className="flex shrink-0 items-center gap-1"
                    aria-label="Navigasi halaman"
                >
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-10 sm:size-8"
                        disabled={!prev}
                        asChild={!!prev}
                    >
                        {prev ? (
                            <Link
                                href={prev}
                                preserveScroll
                                aria-label="Sebelumnya"
                            >
                                <ChevronLeft className="size-4" />
                            </Link>
                        ) : (
                            <span>
                                <ChevronLeft className="size-4" />
                            </span>
                        )}
                    </Button>
                    {/* Mobile: cukup "2 / 5" di antara tombol prev/next. */}
                    <span className="px-2 text-muted-foreground tabular-nums sm:hidden">
                        {paginator.current_page} / {paginator.last_page}
                    </span>
                    {pages.map((link, i) =>
                        link.url ? (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'ghost'}
                                size="icon"
                                className="hidden size-8 sm:inline-flex"
                                asChild
                            >
                                <Link href={link.url} preserveScroll>
                                    {link.label}
                                </Link>
                            </Button>
                        ) : (
                            <span
                                key={i}
                                className="hidden px-1 text-muted-foreground sm:inline"
                            >
                                …
                            </span>
                        ),
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-10 sm:size-8"
                        disabled={!next}
                        asChild={!!next}
                    >
                        {next ? (
                            <Link
                                href={next}
                                preserveScroll
                                aria-label="Berikutnya"
                            >
                                <ChevronRight className="size-4" />
                            </Link>
                        ) : (
                            <span>
                                <ChevronRight className="size-4" />
                            </span>
                        )}
                    </Button>
                </nav>
            )}
        </div>
    );
}
