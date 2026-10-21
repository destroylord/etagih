import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * Bilah filter: inline di ≥ md, di mobile diringkas jadi tombol "Filter"
 * (dengan jumlah filter aktif) yang membuka bottom sheet berisi kontrol
 * yang sama. Kontrol tetap langsung menerapkan filter seperti biasa.
 *
 *   <FilterSheet activeCount={2} onReset={reset}>
 *       <Select …/> <Select …/>
 *   </FilterSheet>
 */
export function FilterSheet({
    children,
    activeCount = 0,
    onReset,
    className,
    sheetBodyClassName,
    label = 'Filter',
}: {
    children: ReactNode;
    activeCount?: number;
    onReset?: () => void;
    /** Kelas wadah inline (desktop). */
    className?: string;
    /** Kelas wadah kontrol di dalam sheet (default: tumpuk vertikal). */
    sheetBodyClassName?: string;
    label?: string;
}) {
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);

    if (!isMobile) {
        return <div className={className}>{children}</div>;
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                onClick={() => setOpen(true)}
            >
                <SlidersHorizontal className="size-4" />
                {label}
                {activeCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
                        {activeCount}
                    </span>
                )}
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    side="bottom"
                    className="max-h-[90dvh] gap-0 rounded-t-2xl"
                >
                    <div aria-hidden className="flex justify-center pt-3">
                        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                    </div>
                    <SheetHeader>
                        <SheetTitle>{label}</SheetTitle>
                        <SheetDescription className="sr-only">
                            Saring daftar
                        </SheetDescription>
                    </SheetHeader>
                    <div
                        className={cn(
                            'flex flex-col gap-3 overflow-y-auto px-4 *:w-full [&_button[role=combobox]]:h-11 [&_input]:h-11',
                            sheetBodyClassName,
                        )}
                    >
                        {children}
                    </div>
                    <SheetFooter className="flex-row pb-[max(1rem,env(safe-area-inset-bottom))]">
                        {onReset && (
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 flex-1"
                                onClick={onReset}
                            >
                                Reset
                            </Button>
                        )}
                        <Button
                            type="button"
                            className="h-11 flex-1"
                            onClick={() => setOpen(false)}
                        >
                            Selesai
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </>
    );
}
