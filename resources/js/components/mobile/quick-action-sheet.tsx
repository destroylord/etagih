import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CheckSquare,
    FileSignature,
    Receipt,
    Timer,
    UserPlus,
    Wallet,
} from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useCan } from '@/hooks/use-can';

type QuickAction = {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    adminOnly?: boolean;
};

export const QUICK_ACTIONS: QuickAction[] = [
    {
        title: 'Task baru',
        description: 'Catat pekerjaan',
        href: '/tasks?new=1',
        icon: CheckSquare,
    },
    {
        title: 'Invoice baru',
        description: 'Tagih klien',
        href: '/invoices/create',
        icon: Receipt,
    },
    {
        title: 'Mulai timer',
        description: 'Lacak jam kerja',
        href: '/time-tracker',
        icon: Timer,
    },
    {
        title: 'Klien baru',
        description: 'Tambah klien',
        href: '/clients?new=1',
        icon: UserPlus,
        adminOnly: true,
    },
    {
        title: 'Catat pembayaran',
        description: 'Invoice terkirim',
        href: '/invoices?status=sent',
        icon: Wallet,
    },
    {
        title: 'Penawaran baru',
        description: 'Buat quotation',
        href: '/quotes/create',
        icon: FileSignature,
    },
];

/** Bottom sheet aksi cepat dari tombol (+) di bottom nav. */
export function QuickActionSheet({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { isAdmin } = useCan();
    const actions = QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
                <div aria-hidden className="flex justify-center pt-3">
                    <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                </div>
                <SheetHeader className="pb-2">
                    <SheetTitle>Buat baru</SheetTitle>
                    <SheetDescription>Pilih aksi cepat.</SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-2 px-4 pb-2">
                    {actions.map((action) => (
                        <Link
                            key={action.href}
                            href={action.href}
                            onClick={() => onOpenChange(false)}
                            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-2 text-center transition-colors hover:bg-accent active:bg-accent"
                        >
                            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <action.icon className="size-5" />
                            </span>
                            <span className="text-xs leading-tight font-medium">
                                {action.title}
                            </span>
                        </Link>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
