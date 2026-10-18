import { router } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Kolom pencarian dengan debounce: mengetik langsung memfilter daftar lewat
 * query `?q=` tanpa tombol "Cari". Dipakai di halaman klien & produk.
 */
export function SearchField({
    url,
    initial,
    placeholder,
    only,
    className,
    delay = 350,
}: {
    url: string;
    initial: string;
    placeholder: string;
    /** Prop Inertia yang perlu dimuat ulang (partial reload). */
    only?: string[];
    className?: string;
    delay?: number;
}) {
    const [value, setValue] = useState(initial);
    const [loading, setLoading] = useState(false);
    const lastSent = useRef(initial);

    useEffect(() => {
        const q = value.trim();

        if (q === lastSent.current) {
            return;
        }

        const t = window.setTimeout(() => {
            lastSent.current = q;
            router.get(url, q ? { q } : {}, {
                only,
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            });
        }, delay);

        return () => window.clearTimeout(t);
    }, [value, url, delay, only]);

    return (
        <div className={cn('relative w-full sm:max-w-xs', className)}>
            <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
            />
            <Input
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
            <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
                {loading ? (
                    <Spinner className="size-4 text-muted-foreground" />
                ) : (
                    value && (
                        <button
                            type="button"
                            onClick={() => setValue('')}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label="Hapus pencarian"
                        >
                            <X className="size-4" />
                        </button>
                    )
                )}
            </span>
        </div>
    );
}
