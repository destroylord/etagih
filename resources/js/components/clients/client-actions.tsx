import { router } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Client } from '@/types/models';

/** Simpan nilai terakhir yang tidak null supaya teks dialog tidak hilang saat animasi tutup. */
function useLastDefined<T>(value: T | null): T | null {
    const [last, setLast] = useState(value);

    if (value !== null && value !== last) {
        setLast(value);
    }

    return value ?? last;
}

/**
 * Dialog konfirmasi "buat kunci akses baru". Dikontrol dari luar supaya bisa
 * dipicu dari tombol mana pun (tabel, kartu mobile, header detail).
 */
export function RegenerateKeyDialog({
    client,
    onOpenChange,
}: {
    client: Pick<Client, 'id' | 'name'> | null;
    onOpenChange: (open: boolean) => void;
}) {
    const shown = useLastDefined(client);

    return (
        <ConfirmDialog
            open={!!client}
            onOpenChange={onOpenChange}
            title="Buat kunci akses baru?"
            description={
                <>
                    Kunci portal lama milik{' '}
                    <span className="font-medium text-foreground">
                        {shown?.name}
                    </span>{' '}
                    akan langsung berhenti berfungsi. Kunci baru hanya
                    ditampilkan sekali — pastikan Anda menyalin dan
                    membagikannya ke klien.
                </>
            }
            confirmLabel="Buat kunci baru"
            onConfirm={(done) => {
                if (!client) {
                    return done();
                }

                router.post(
                    `/clients/${client.id}/access-key`,
                    {},
                    { preserveScroll: true, onFinish: done },
                );
            }}
        />
    );
}

/** Dialog konfirmasi hapus klien (hanya untuk klien tanpa invoice). */
export function DeleteClientDialog({
    client,
    onOpenChange,
}: {
    client: Pick<Client, 'id' | 'name'> | null;
    onOpenChange: (open: boolean) => void;
}) {
    const shown = useLastDefined(client);

    return (
        <ConfirmDialog
            open={!!client}
            onOpenChange={onOpenChange}
            title="Hapus klien?"
            description={
                <>
                    <span className="font-medium text-foreground">
                        {shown?.name}
                    </span>{' '}
                    beserta produk miliknya akan dihapus permanen. Tindakan ini
                    tidak bisa dibatalkan.
                </>
            }
            confirmLabel="Hapus klien"
            destructive
            onConfirm={(done) => {
                if (!client) {
                    return done();
                }

                router.delete(`/clients/${client.id}`, {
                    preserveScroll: true,
                    onFinish: done,
                });
            }}
        />
    );
}

/**
 * Tombol ikon kecil dengan tooltip. Jika `disabledReason` diisi, tombol
 * dinonaktifkan dan tooltip menjelaskan alasannya.
 */
export function IconAction({
    label,
    icon: Icon,
    onClick,
    disabledReason,
    destructive = false,
}: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    disabledReason?: string | null;
    destructive?: boolean;
}) {
    const button = (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
                'size-8 text-muted-foreground hover:text-foreground',
                destructive && 'hover:bg-destructive/10 hover:text-destructive',
            )}
            onClick={onClick}
            disabled={!!disabledReason}
            aria-label={label}
        >
            <Icon className="size-4" />
        </Button>
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {disabledReason ? (
                    // Tombol disabled tidak memicu event pointer, jadi bungkus agar tooltip tetap muncul.
                    <span
                        tabIndex={0}
                        className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={`${label} — ${disabledReason}`}
                    >
                        {button}
                    </span>
                ) : (
                    button
                )}
            </TooltipTrigger>
            <TooltipContent className="max-w-60 text-center">
                {disabledReason ?? label}
            </TooltipContent>
        </Tooltip>
    );
}

export function deleteBlockedReason(
    client: Pick<Client, 'invoices_count'>,
): string | null {
    const count = client.invoices_count ?? 0;

    return count > 0
        ? `Tidak bisa dihapus: masih punya ${count} invoice. Riwayat keuangan harus tetap tersimpan.`
        : null;
}
