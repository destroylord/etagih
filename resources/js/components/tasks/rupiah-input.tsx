import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** "1500000" → "1.500.000"; kosong tetap kosong. */
export function formatRupiahDigits(digits: string): string {
    return digits === '' ? '' : formatter.format(Number(digits));
}

/**
 * Input Rupiah (bilangan bulat) dengan pemisah ribuan saat mengetik.
 * `value`/`onValueChange` berupa string angka polos ("1500000" / "").
 */
export function RupiahInput({
    value,
    onValueChange,
    className,
    ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
    value: string;
    onValueChange: (digits: string) => void;
}) {
    return (
        <div className="relative">
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            >
                Rp
            </span>
            <Input
                {...props}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={cn('pl-9 text-right tabular-nums', className)}
                value={formatRupiahDigits(value)}
                onChange={(e) =>
                    onValueChange(
                        e.target.value
                            .replace(/\D/g, '')
                            .replace(/^0+(?=\d)/, '')
                            .slice(0, 13),
                    )
                }
            />
        </div>
    );
}
