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
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
            <p className="text-muted-foreground">
                {paginator.from}–{paginator.to} dari {paginator.total} {noun}
            </p>
            {paginator.last_page > 1 && (
                <nav
                    className="flex items-center gap-1"
                    aria-label="Pagination"
                >
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
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
                    {pages.map((link, i) =>
                        link.url ? (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'ghost'}
                                size="icon"
                                className="size-8"
                                asChild
                            >
                                <Link href={link.url} preserveScroll>
                                    {link.label}
                                </Link>
                            </Button>
                        ) : (
                            <span
                                key={i}
                                className="px-1 text-muted-foreground"
                            >
                                …
                            </span>
                        ),
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
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
