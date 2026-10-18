import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Kartu section form dengan header (ikon + judul + deskripsi + aksi opsional). */
export function FormSection({
    icon: Icon,
    title,
    description,
    actions,
    children,
    className,
    contentClassName,
}: {
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}) {
    return (
        <Card className={cn('gap-5 py-5', className)}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5">
                <div className="flex min-w-0 items-start gap-3">
                    {Icon && (
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                        </span>
                    )}
                    <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base">{title}</CardTitle>
                        {description && (
                            <CardDescription>{description}</CardDescription>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </CardHeader>
            <CardContent className={cn('space-y-4 px-5', contentClassName)}>
                {children}
            </CardContent>
        </Card>
    );
}

export type Choice<T extends string> = {
    value: T;
    title: string;
    description?: string;
    icon?: LucideIcon;
};

/** Pilihan berbentuk kartu dengan semantik radiogroup (panah kiri/kanan untuk pindah). */
export function ChoiceCards<T extends string>({
    value,
    onChange,
    options,
    label,
    disabled,
}: {
    value: T;
    onChange: (value: T) => void;
    options: Choice<T>[];
    label: string;
    disabled?: boolean;
}) {
    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const delta =
            e.key === 'ArrowRight' || e.key === 'ArrowDown'
                ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                  ? -1
                  : 0;

        if (!delta) {
            return;
        }

        e.preventDefault();
        const next = options[(index + delta + options.length) % options.length];
        onChange(next.value);
        const group = e.currentTarget.parentElement;
        requestAnimationFrame(() =>
            group
                ?.querySelector<HTMLButtonElement>(
                    `[data-value="${next.value}"]`,
                )
                ?.focus(),
        );
    };

    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
            {options.map((opt, i) => {
                const active = opt.value === value;
                const Icon = opt.icon;

                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        data-value={opt.value}
                        disabled={disabled}
                        onClick={() => onChange(opt.value)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                        className={cn(
                            'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none',
                            'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
                            active
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'hover:bg-muted/50',
                        )}
                    >
                        {Icon && (
                            <Icon
                                className={cn(
                                    'mt-0.5 size-4 shrink-0',
                                    active
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            />
                        )}
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">
                                {opt.title}
                            </span>
                            {opt.description && (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {opt.description}
                                </span>
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** Input dengan prefix/suffix teks (mis. "Rp", "%", "jam"). */
export function AffixInput({
    prefix,
    suffix,
    className,
    ...props
}: ComponentProps<typeof Input> & { prefix?: string; suffix?: string }) {
    return (
        <div className="relative">
            {prefix && (
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    {prefix}
                </span>
            )}
            <Input
                className={cn(
                    'tabular-nums',
                    prefix && 'pl-9',
                    suffix && 'pr-10',
                    className,
                )}
                {...props}
            />
            {suffix && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    {suffix}
                </span>
            )}
        </div>
    );
}

/** Input persen + tombol pilihan cepat (PPN, PPh 23). */
export function RatePicker({
    id,
    value,
    onChange,
    presets,
    max = 100,
    label,
    invalid,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    presets: number[];
    max?: number;
    /** Label aria grup pilihan cepat. */
    label: string;
    invalid?: boolean;
}) {
    const current = Number(value) || 0;

    return (
        <div className="flex gap-2">
            <div className="w-28 shrink-0">
                <AffixInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={max}
                    step="any"
                    placeholder="0"
                    suffix="%"
                    className="text-right"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={invalid}
                />
            </div>
            <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={label}
            >
                {presets.map((rate) => {
                    const active = current === rate;

                    return (
                        <Button
                            key={rate}
                            type="button"
                            size="sm"
                            variant={active ? 'secondary' : 'outline'}
                            aria-pressed={active}
                            className={cn(
                                'h-9',
                                active && 'ring-1 ring-primary',
                            )}
                            onClick={() => onChange(String(rate))}
                        >
                            {formatNumber(rate)}%
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

/** Baris label–nilai di ringkasan. */
export function SummaryRow({
    label,
    value,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-4 text-sm',
                className,
            )}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium tabular-nums">{value}</span>
        </div>
    );
}
