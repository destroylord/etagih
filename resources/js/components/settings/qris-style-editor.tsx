import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type QrisStyleValue = {
    fg_color: string;
    bg_color: string;
    eye_color: string | null;
    module: 'square' | 'rounded' | 'dots';
    eye: 'square' | 'rounded' | 'circle';
    logo: 'none' | 'company';
    frame: 'none' | 'simple' | 'card';
    frame_color: string;
    title: string | null;
    caption: string | null;
    show_amount: boolean;
};

export const QRIS_STYLE_DEFAULTS: QrisStyleValue = {
    fg_color: '#0f172a',
    bg_color: '#ffffff',
    eye_color: null,
    module: 'square',
    eye: 'square',
    logo: 'none',
    frame: 'card',
    frame_color: '#1e3a8a',
    title: null,
    caption: 'Scan dengan aplikasi e-wallet atau m-banking',
    show_amount: true,
};

const PRESETS: { label: string; style: Partial<QrisStyleValue> }[] = [
    {
        label: 'Klasik',
        style: {
            fg_color: '#0f172a',
            bg_color: '#ffffff',
            eye_color: null,
            module: 'square',
            eye: 'square',
            frame: 'card',
            frame_color: '#1e3a8a',
        },
    },
    {
        label: 'Modern',
        style: {
            fg_color: '#134e4a',
            bg_color: '#ffffff',
            eye_color: '#0f766e',
            module: 'rounded',
            eye: 'circle',
            frame: 'card',
            frame_color: '#0f766e',
        },
    },
    {
        label: 'Titik',
        style: {
            fg_color: '#3b0764',
            bg_color: '#ffffff',
            eye_color: '#6b21a8',
            module: 'dots',
            eye: 'rounded',
            frame: 'simple',
            frame_color: '#6b21a8',
        },
    },
    {
        label: 'Minimal',
        style: {
            fg_color: '#000000',
            bg_color: '#ffffff',
            eye_color: null,
            module: 'square',
            eye: 'square',
            frame: 'none',
        },
    },
];

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/** Rasio kontras WCAG (sama dengan QrisStyle::contrast di server). */
function contrast(a: string, b: string): number {
    const lum = (hex: string) => {
        const [r, g, bl] = [1, 3, 5].map(
            (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
        );
        const lin = (c: number) =>
            c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
    };
    const [l1, l2] = [lum(a), lum(b)];

    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    label: string;
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-0.5"
        >
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        value === o.value
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function ColorField({
    label,
    value,
    onChange,
    allowInherit,
}: {
    label: string;
    value: string | null;
    onChange: (v: string | null) => void;
    allowInherit?: string;
}) {
    return (
        <div className="grid gap-1.5">
            <span className="text-xs font-medium">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value ?? allowInherit ?? '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                    className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
                    aria-label={label}
                />
                <code className="text-xs text-muted-foreground">
                    {value ?? 'ikut titik'}
                </code>
                {allowInherit && value && (
                    <button
                        type="button"
                        className="text-xs text-muted-foreground underline"
                        onClick={() => onChange(null)}
                    >
                        reset
                    </button>
                )}
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-1.5">
            <span className="text-xs font-medium">{label}</span>
            {children}
        </div>
    );
}

/**
 * Editor gaya QRIS + pratinjau langsung (dirender server, persis seperti
 * yang dilihat klien di halaman bayar). Belum tersimpan sampai klik Simpan.
 */
export function QrisStyleEditor({
    value,
    onChange,
    hasLogo,
    errors,
}: {
    value: QrisStyleValue;
    onChange: (v: QrisStyleValue) => void;
    hasLogo: boolean;
    errors?: Record<string, string>;
}) {
    const [svg, setSvg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const requestId = useRef(0);

    const set = <K extends keyof QrisStyleValue>(
        key: K,
        v: QrisStyleValue[K],
    ) => onChange({ ...value, [key]: v });

    const ratio = contrast(value.fg_color, value.bg_color);
    const lowContrast = ratio < 3;
    const serialized = JSON.stringify(value);

    // Pratinjau di-render server (debounce) supaya sama persis dengan halaman bayar.
    useEffect(() => {
        if (lowContrast) {
            return;
        }

        const id = ++requestId.current;
        const timer = window.setTimeout(async () => {
            setLoading(true);

            try {
                const res = await fetch('/settings/qris/preview', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': xsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ style: JSON.parse(serialized) }),
                });
                const body = await res.json().catch(() => null);

                if (id !== requestId.current) {
                    return;
                }

                if (!res.ok) {
                    const first = body?.errors
                        ? (Object.values(body.errors)[0] as string[])[0]
                        : null;
                    setPreviewError(first ?? 'Pratinjau gagal dimuat.');

                    return;
                }

                setPreviewError(null);
                setSvg(body.svg);
            } catch {
                if (id === requestId.current) {
                    setPreviewError('Pratinjau gagal dimuat.');
                }
            } finally {
                if (id === requestId.current) {
                    setLoading(false);
                }
            }
        }, 300);

        return () => window.clearTimeout(timer);
    }, [serialized, lowContrast]);

    const fieldError = (k: string) => errors?.[`qris_style.${k}`];

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
                <Row label="Preset cepat">
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <Button
                                key={p.label}
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    onChange({ ...value, ...p.style })
                                }
                            >
                                <span
                                    className="size-3 rounded-full"
                                    style={{
                                        backgroundColor:
                                            p.style.frame_color ??
                                            p.style.fg_color,
                                    }}
                                />
                                {p.label}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onChange(QRIS_STYLE_DEFAULTS)}
                        >
                            <RotateCcw /> Default
                        </Button>
                    </div>
                </Row>

                <div className="grid gap-4 sm:grid-cols-3">
                    <ColorField
                        label="Warna titik"
                        value={value.fg_color}
                        onChange={(v) =>
                            set('fg_color', v ?? QRIS_STYLE_DEFAULTS.fg_color)
                        }
                    />
                    <ColorField
                        label="Warna latar"
                        value={value.bg_color}
                        onChange={(v) =>
                            set('bg_color', v ?? QRIS_STYLE_DEFAULTS.bg_color)
                        }
                    />
                    <ColorField
                        label="Warna sudut (mata)"
                        value={value.eye_color}
                        allowInherit={value.fg_color}
                        onChange={(v) => set('eye_color', v)}
                    />
                </div>
                {(lowContrast || fieldError('bg_color')) && (
                    <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {fieldError('bg_color') ??
                            `Kontras ${ratio.toFixed(1)}:1 terlalu rendah (min. 3:1) — QR bisa gagal di-scan. Gunakan titik gelap di latar terang.`}
                    </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <Row label="Bentuk titik">
                        <Segmented
                            label="Bentuk titik"
                            value={value.module}
                            onChange={(v) => set('module', v)}
                            options={[
                                { value: 'square', label: 'Kotak' },
                                { value: 'rounded', label: 'Membulat' },
                                { value: 'dots', label: 'Bulat' },
                            ]}
                        />
                    </Row>
                    <Row label="Bentuk sudut">
                        <Segmented
                            label="Bentuk sudut"
                            value={value.eye}
                            onChange={(v) => set('eye', v)}
                            options={[
                                { value: 'square', label: 'Kotak' },
                                { value: 'rounded', label: 'Membulat' },
                                { value: 'circle', label: 'Lingkaran' },
                            ]}
                        />
                    </Row>
                </div>

                <Row label="Bingkai">
                    <Segmented
                        label="Bingkai"
                        value={value.frame}
                        onChange={(v) => set('frame', v)}
                        options={[
                            { value: 'card', label: 'Kartu berjudul' },
                            { value: 'simple', label: 'Garis tepi' },
                            { value: 'none', label: 'Tanpa' },
                        ]}
                    />
                </Row>

                {value.frame !== 'none' && (
                    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                        <ColorField
                            label="Warna bingkai"
                            value={value.frame_color}
                            onChange={(v) =>
                                set(
                                    'frame_color',
                                    v ?? QRIS_STYLE_DEFAULTS.frame_color,
                                )
                            }
                        />
                        {value.frame === 'card' && (
                            <Row label="Judul kartu">
                                <Input
                                    value={value.title ?? ''}
                                    maxLength={40}
                                    onChange={(e) =>
                                        set('title', e.target.value || null)
                                    }
                                    placeholder="Default: nama perusahaan"
                                />
                            </Row>
                        )}
                    </div>
                )}

                {value.frame !== 'none' && (
                    <Row label="Keterangan di bawah QR">
                        <Input
                            value={value.caption ?? ''}
                            maxLength={80}
                            onChange={(e) => set('caption', e.target.value)}
                            placeholder="Kosongkan untuk menyembunyikan"
                        />
                    </Row>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {value.frame !== 'none' && (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={value.show_amount}
                                onCheckedChange={(v) =>
                                    set('show_amount', v === true)
                                }
                            />
                            Tampilkan nominal
                        </label>
                    )}
                    <label
                        className={cn(
                            'flex items-center gap-2 text-sm',
                            !hasLogo && 'opacity-60',
                        )}
                    >
                        <Checkbox
                            checked={value.logo === 'company'}
                            disabled={!hasLogo}
                            onCheckedChange={(v) =>
                                set('logo', v === true ? 'company' : 'none')
                            }
                        />
                        Logo perusahaan di tengah QR
                        {!hasLogo && (
                            <span className="text-xs text-muted-foreground">
                                (upload logo di Profil dulu)
                            </span>
                        )}
                    </label>
                </div>
            </div>

            <div className="lg:sticky lg:top-20 lg:self-start">
                <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Pratinjau di halaman bayar</span>
                        {loading && <Spinner />}
                    </div>
                    <div className="grid min-h-[360px] place-items-center">
                        {lowContrast ? (
                            <p className="px-4 text-center text-xs text-red-600 dark:text-red-400">
                                Perbaiki kontras warna untuk melihat pratinjau.
                            </p>
                        ) : previewError ? (
                            <p className="px-4 text-center text-xs text-red-600 dark:text-red-400">
                                {previewError}
                            </p>
                        ) : svg ? (
                            <img
                                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                                alt="Pratinjau QRIS"
                                className={cn(
                                    'w-full max-w-[280px] transition-opacity',
                                    loading && 'opacity-60',
                                )}
                            />
                        ) : (
                            <Spinner />
                        )}
                    </div>
                    <p className="mt-3 text-center text-[11px] text-muted-foreground">
                        Contoh data. Nominal & QR asli dibuat saat klien menekan
                        “Bayar”.
                    </p>
                </div>
            </div>
        </div>
    );
}
