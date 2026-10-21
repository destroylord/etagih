import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * Dialog yang tampil sebagai modal di tengah pada layar ≥ md dan sebagai
 * bottom sheet (lebar penuh, sudut atas membulat, bisa di-scroll, footer
 * menempel di bawah) pada layar mobile. API sama dengan shadcn `Dialog`:
 *
 *   <ResponsiveDialog open={open} onOpenChange={setOpen}>
 *       <ResponsiveDialogContent className="sm:max-w-lg">
 *           <ResponsiveDialogHeader>
 *               <ResponsiveDialogTitle>Judul</ResponsiveDialogTitle>
 *               <ResponsiveDialogDescription>…</ResponsiveDialogDescription>
 *           </ResponsiveDialogHeader>
 *           <form>… <ResponsiveDialogFooter>…</ResponsiveDialogFooter></form>
 *       </ResponsiveDialogContent>
 *   </ResponsiveDialog>
 *
 * `className` pada Content berlaku di kedua mode; `sheetClassName` hanya
 * berlaku di mode bottom sheet.
 */

const SheetModeContext = React.createContext(false);

/** `true` bila dialog sedang dirender sebagai bottom sheet (mobile). */
export function useResponsiveDialogIsSheet(): boolean {
    return React.useContext(SheetModeContext);
}

function ResponsiveDialog(
    props: React.ComponentProps<typeof DialogPrimitive.Root>,
) {
    const isMobile = useIsMobile();

    return (
        <SheetModeContext.Provider value={isMobile}>
            <DialogPrimitive.Root data-slot="responsive-dialog" {...props} />
        </SheetModeContext.Provider>
    );
}

function ResponsiveDialogTrigger(
    props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
    return (
        <DialogPrimitive.Trigger
            data-slot="responsive-dialog-trigger"
            {...props}
        />
    );
}

function ResponsiveDialogClose(
    props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
    return (
        <DialogPrimitive.Close data-slot="responsive-dialog-close" {...props} />
    );
}

function ResponsiveDialogContent({
    className,
    sheetClassName,
    children,
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    sheetClassName?: string;
    showCloseButton?: boolean;
}) {
    const isSheet = useResponsiveDialogIsSheet();

    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
                className={cn(
                    'fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
                    isSheet && 'bg-black/60',
                )}
            />
            <DialogPrimitive.Content
                data-slot="responsive-dialog-content"
                data-sheet={isSheet ? '' : undefined}
                className={
                    isSheet
                        ? cn(
                              'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-background px-4 pt-0 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
                              className,
                              // Mode sheet selalu lebar penuh, apa pun className desktop-nya.
                              'top-auto left-0 max-w-none translate-x-0 translate-y-0 sm:max-w-none',
                              sheetClassName,
                          )
                        : cn(
                              'fixed top-[50%] left-[50%] z-50 grid max-h-[90dvh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg',
                              className,
                          )
                }
                {...props}
            >
                {isSheet && (
                    <div
                        aria-hidden
                        className="sticky top-0 z-10 -mx-4 flex shrink-0 justify-center bg-background pt-3 pb-1"
                    >
                        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                    </div>
                )}
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close
                        className={cn(
                            'absolute rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
                            isSheet
                                ? 'top-3 right-3 z-20 flex size-9 items-center justify-center rounded-full'
                                : 'top-4 right-4',
                        )}
                    >
                        <XIcon />
                        <span className="sr-only">Tutup</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}

function ResponsiveDialogHeader({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const isSheet = useResponsiveDialogIsSheet();

    return (
        <div
            data-slot="responsive-dialog-header"
            className={cn(
                'flex flex-col gap-2 text-center sm:text-left',
                isSheet && 'pr-8 text-left',
                className,
            )}
            {...props}
        />
    );
}

/** Area isi opsional (mis. daftar panjang) — di sheet ikut scroll konten. */
function ResponsiveDialogBody({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="responsive-dialog-body"
            className={cn('min-w-0', className)}
            {...props}
        />
    );
}

function ResponsiveDialogFooter({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    const isSheet = useResponsiveDialogIsSheet();

    return (
        <div
            data-slot="responsive-dialog-footer"
            className={cn(
                'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
                // Footer menempel di bawah sheet saat isi di-scroll.
                isSheet &&
                    'sticky -bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto -mb-[max(1rem,env(safe-area-inset-bottom))] flex-row flex-wrap border-t *:flex-1 bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [&_a]:min-h-11 [&_button]:min-h-11',
                className,
            )}
            {...props}
        />
    );
}

function ResponsiveDialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="responsive-dialog-title"
            className={cn('text-lg leading-none font-semibold', className)}
            {...props}
        />
    );
}

function ResponsiveDialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="responsive-dialog-description"
            className={cn('text-sm text-muted-foreground', className)}
            {...props}
        />
    );
}

export {
    ResponsiveDialog,
    ResponsiveDialogBody,
    ResponsiveDialogClose,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
    ResponsiveDialogTrigger,
};
