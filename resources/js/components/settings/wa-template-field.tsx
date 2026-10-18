import { AlertTriangle, Eraser, FileText, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useRef } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Placeholder } from './wa-templates';
import { renderTemplate, unknownPlaceholders } from './wa-templates';

/** Format ala WhatsApp: *tebal*, _miring_, ~coret~ (satu baris). */
function formatWa(line: string): ReactNode[] {
    const out: ReactNode[] = [];
    const re = /([*_~])([^*_~\n]+?)\1/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;

    while ((m = re.exec(line)) !== null) {
        if (m.index > last) {
            out.push(line.slice(last, m.index));
        }

        const text = m[2];
        out.push(
            m[1] === '*' ? (
                <strong key={i++}>{text}</strong>
            ) : m[1] === '_' ? (
                <em key={i++}>{text}</em>
            ) : (
                <s key={i++}>{text}</s>
            ),
        );
        last = m.index + m[0].length;
    }

    if (last < line.length) {
        out.push(line.slice(last));
    }

    return out;
}

/**
 * Editor template WA: chip placeholder (sisip di posisi kursor), indikator
 * "pakai default", peringatan placeholder asing, dan pratinjau gelembung chat.
 */
export function WaTemplateField({
    id,
    label,
    description,
    value,
    onChange,
    placeholders,
    defaultTemplate,
    sample,
    error,
}: {
    id: string;
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
    placeholders: readonly Placeholder[];
    defaultTemplate: string;
    sample: Record<string, string>;
    error?: string;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const usingDefault = value.trim() === '';
    const effective = usingDefault ? defaultTemplate : value;
    const preview = renderTemplate(effective, sample, placeholders);
    const unknown = usingDefault
        ? []
        : unknownPlaceholders(value, placeholders);

    const insert = (key: string) => {
        const token = `{{${key}}}`;
        const el = ref.current;
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        const next = value.slice(0, start) + token + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
            if (!el) {
                return;
            }

            el.focus();
            const pos = start + token.length;
            el.setSelectionRange(pos, pos);
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <Label htmlFor={id}>{label}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
                {usingDefault ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange(defaultTemplate)}
                    >
                        <FileText /> Ubah dari default
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange('')}
                    >
                        <Eraser /> Kembali ke default
                    </Button>
                )}
            </div>

            <div
                className="flex flex-wrap gap-1.5"
                aria-label="Sisipkan placeholder"
            >
                {placeholders.map((p) => (
                    <Tooltip key={p.key}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => insert(p.key)}
                                className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                aria-label={`Sisipkan ${p.label}`}
                            >
                                <Plus
                                    className="size-3 text-muted-foreground"
                                    aria-hidden
                                />
                                {`{{${p.key}}}`}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {p.label} — contoh: {sample[p.key] || '(kosong)'}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>

            <Textarea
                id={id}
                ref={ref}
                rows={7}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`Kosong = memakai template default:\n\n${defaultTemplate}`}
                className="font-mono text-xs leading-relaxed"
                aria-invalid={!!error}
            />
            <InputError message={error} />

            {unknown.length > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                        Placeholder tidak dikenal untuk pesan ini dan tidak akan
                        diganti:{' '}
                        <span className="font-mono">{unknown.join(', ')}</span>
                    </span>
                </p>
            )}

            <div className="rounded-lg bg-[#efeae2] p-3 dark:bg-zinc-900">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    <span>Pratinjau (data contoh)</span>
                    {usingDefault && (
                        <span className="rounded bg-white/70 px-1.5 py-0.5 dark:bg-zinc-800">
                            Memakai template default
                        </span>
                    )}
                </div>
                <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-relaxed break-words text-zinc-900 shadow-sm dark:bg-emerald-900 dark:text-emerald-50">
                    {preview.split('\n').map((line, i, arr) => (
                        <Fragment key={i}>
                            {formatWa(line)}
                            {i < arr.length - 1 && <br />}
                        </Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}
