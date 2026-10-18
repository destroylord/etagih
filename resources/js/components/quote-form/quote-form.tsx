import { Link, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    CalendarDays,
    ListChecks,
    NotebookPen,
    Percent,
    UserRound,
    UserRoundPlus,
    Users,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import InputError from '@/components/input-error';
import {
    AffixInput,
    FormSection,
    SummaryRow,
} from '@/components/invoice-form/parts';
import { ProductPickerDialog } from '@/components/invoice-form/product-picker-dialog';
import type { FormClient, FormProduct } from '@/components/invoice-form/utils';
import { ProjectSelect } from '@/components/projects/project-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDate, formatIDR, formatNumber, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DiscountType, ProjectOption } from '@/types/models';
import { QuoteItemsEditor } from './quote-items-editor';
import {
    addDaysISO,
    blankQuoteRow,
    computeQuoteTotals,
    daysBetweenISO,
    isBlankQuoteRow,
    quoteLineTotal,
} from './utils';
import type { QuoteFormData, QuoteItemRow } from './utils';

/** Kunci error yang sudah ditampilkan inline (selain items.*). */
const INLINE_ERROR_KEYS = new Set([
    'client_id',
    'client.name',
    'client.phone',
    'client.email',
    'client.address',
    'project_id',
    'issue_date',
    'valid_until',
    'discount_type',
    'discount_value',
    'tax_rate',
    'pph_rate',
    'notes',
    'terms',
    'items',
]);

const VALIDITY_PRESETS = [7, 14, 30];
const PPH_PRESETS = [0, 2];

export type QuoteFormProps = {
    mode: 'create' | 'edit';
    initial: QuoteFormData;
    clients: FormClient[];
    products: FormProduct[];
    projects: ProjectOption[];
    submitUrl: string;
    method: 'post' | 'put';
    submitLabel: string;
    cancelHref: string;
    defaultTaxRate?: number;
};

export function QuoteForm({
    mode,
    initial,
    clients,
    products,
    projects,
    submitUrl,
    method,
    submitLabel,
    cancelHref,
    defaultTaxRate = 0,
}: QuoteFormProps) {
    const isEdit = mode === 'edit';
    const form = useForm<QuoteFormData>(initial);
    const { data } = form;
    const errors = form.errors as Record<string, string | undefined>;

    const [newClient, setNewClient] = useState(
        !isEdit && initial.client_id === null,
    );
    const submittedKeys = useRef<string[]>([]);
    const errorAlertRef = useRef<HTMLDivElement>(null);

    const selectedClient =
        data.client_id !== null
            ? clients.find((c) => c.id === data.client_id)
            : undefined;
    const quoteProject =
        data.project_id !== null
            ? projects.find((p) => p.id === data.project_id)
            : undefined;
    const subProjects =
        quoteProject && quoteProject.parent_id === null
            ? projects.filter((p) => p.parent_id === quoteProject.id)
            : [];
    const showItemProjects =
        !newClient && data.client_id !== null && subProjects.length > 0;
    const productNames = useMemo(
        () => new Map(products.map((p) => [p.id, p.name])),
        [products],
    );
    const usedProductIds = useMemo(
        () =>
            new Set(
                data.items
                    .map((r) => r.product_id)
                    .filter((x): x is number => x !== null),
            ),
        [data.items],
    );

    // ---- Perhitungan (cermin backend) ----
    const subtotal = data.items.reduce((s, r) => s + quoteLineTotal(r), 0);
    const totals = computeQuoteTotals(
        subtotal,
        data.discount_type,
        data.discount_value,
        data.tax_rate,
        data.pph_rate,
    );
    const filledRows = data.items.filter((r) => !isBlankQuoteRow(r)).length;
    const validDays = data.valid_until
        ? daysBetweenISO(data.issue_date, data.valid_until)
        : null;

    // ---- Helpers item ----
    const setItems = (updater: (items: QuoteItemRow[]) => QuoteItemRow[]) =>
        form.setData((prev) => ({ ...prev, items: updater(prev.items) }));

    const changeRow = (index: number, patch: Partial<QuoteItemRow>) =>
        setItems((items) =>
            items.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        );

    const removeRow = (index: number) =>
        setItems((items) => items.filter((_, i) => i !== index));

    const moveRow = (index: number, dir: -1 | 1) =>
        setItems((items) => {
            const target = index + dir;

            if (target < 0 || target >= items.length) {
                return items;
            }

            const next = [...items];
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });

    const addRow = () => {
        const row = blankQuoteRow();
        setItems((items) => [...items, row]);

        return row.key;
    };

    const addProducts = (picked: FormProduct[]) =>
        setItems((items) => [
            ...items.filter((r) => !isBlankQuoteRow(r)),
            ...picked.map((p) => blankQuoteRow({ product_id: p.id })),
        ]);

    const changeClient = (id: number) => {
        form.setData((prev) => ({
            ...prev,
            client_id: id,
            project_id: null,
            items: prev.items.map((r) => ({ ...r, project_id: null })),
        }));
        form.clearErrors('client_id', 'project_id');
    };

    const changeProject = (id: number | null) => {
        form.setData((prev) => {
            const next =
                id !== null ? projects.find((p) => p.id === id) : undefined;

            return {
                ...prev,
                project_id: id,
                // Sub-proyek baris yang tidak lagi di bawah proyek baru dilepas.
                items: prev.items.map((r) => {
                    if (r.project_id === null) {
                        return r;
                    }

                    const keep =
                        next?.parent_id === null &&
                        projects.find((p) => p.id === r.project_id)
                            ?.parent_id === id;

                    return keep ? r : { ...r, project_id: null };
                }),
            };
        });
        form.clearErrors('project_id');
    };

    const changeIssueDate = (value: string) =>
        form.setData((prev) => {
            // Pertahankan jarak masa berlaku saat tanggal penawaran diubah.
            const days = prev.valid_until
                ? daysBetweenISO(prev.issue_date, prev.valid_until)
                : null;

            return {
                ...prev,
                issue_date: value,
                valid_until:
                    days !== null && days >= 0 && value
                        ? addDaysISO(value, days)
                        : prev.valid_until,
            };
        });

    const switchToNewClient = (on: boolean) => {
        setNewClient(on);
        form.setData((prev) => ({
            ...prev,
            client_id: on ? null : (clients[0]?.id ?? null),
            project_id: null,
            items: prev.items.map((r) => ({ ...r, project_id: null })),
        }));
    };

    // ---- Error mapping (index item yang dikirim → key baris) ----
    const rowError = (key: string, field: string): string | undefined => {
        const idx = submittedKeys.current.indexOf(key);

        return idx < 0 ? undefined : errors[`items.${idx}.${field}`];
    };

    const errorKeys = Object.keys(errors).filter((k) => errors[k]);
    const otherErrors = errorKeys
        .filter((k) => !INLINE_ERROR_KEYS.has(k) && !k.startsWith('items.'))
        .map((k) => errors[k] as string);

    const submit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const rows = data.items.filter((r) => !isBlankQuoteRow(r));
        submittedKeys.current = rows.map((r) => r.key);

        form.transform((d) => ({
            ...(newClient && !isEdit
                ? { client_id: null, client: d.client }
                : { client_id: d.client_id }),
            project_id: newClient && !isEdit ? null : d.project_id,
            issue_date: d.issue_date,
            valid_until: d.valid_until,
            discount_type: d.discount_type,
            discount_value: d.discount_value === '' ? 0 : d.discount_value,
            tax_rate: d.tax_rate === '' ? 0 : d.tax_rate,
            pph_rate: d.pph_rate === '' ? 0 : d.pph_rate,
            notes: d.notes,
            terms: d.terms,
            items: rows.map((r) => ({
                description: r.description,
                quantity: r.quantity === '' ? 0 : r.quantity,
                unit_price: r.unit_price === '' ? 0 : r.unit_price,
                product_id: r.product_id,
                project_id: r.project_id,
            })),
        }));

        form.submit(method, submitUrl, {
            preserveScroll: true,
            onError: () =>
                requestAnimationFrame(() => {
                    const invalid = document.querySelector<HTMLElement>(
                        'form [aria-invalid="true"]',
                    );

                    if (invalid) {
                        invalid.focus();
                        invalid.scrollIntoView({
                            block: 'center',
                            behavior: 'smooth',
                        });
                    } else {
                        errorAlertRef.current?.scrollIntoView({
                            block: 'center',
                            behavior: 'smooth',
                        });
                    }
                }),
        });
    };

    const taxPresets = [...new Set([0, 11, toNumber(defaultTaxRate)])].sort(
        (a, b) => a - b,
    );
    const clientLabel = newClient
        ? data.client.name.trim() || 'Client baru'
        : (selectedClient?.name ?? '—');

    const presetButton = (
        active: boolean,
        label: string,
        onClick: () => void,
        key: string | number,
    ) => (
        <Button
            key={key}
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'outline'}
            aria-pressed={active}
            className={cn('h-9', active && 'ring-1 ring-primary')}
            onClick={onClick}
        >
            {label}
        </Button>
    );

    return (
        <form
            onSubmit={submit}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
        >
            <div className="min-w-0 space-y-6">
                {errorKeys.length > 0 && (
                    <Alert variant="destructive" ref={errorAlertRef}>
                        <AlertCircle className="size-4" />
                        <AlertTitle>Penawaran belum bisa disimpan</AlertTitle>
                        <AlertDescription>
                            <p>Periksa kembali isian yang ditandai merah.</p>
                            {otherErrors.length > 0 && (
                                <ul className="mt-1 list-inside list-disc">
                                    {otherErrors.map((msg) => (
                                        <li key={msg}>{msg}</li>
                                    ))}
                                </ul>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {/* ---------- Klien ---------- */}
                <FormSection
                    icon={Users}
                    title="Klien"
                    description={
                        isEdit
                            ? 'Klien tidak dapat diubah di mode edit; proyek masih bisa diganti.'
                            : 'Pilih klien (dan proyeknya) atau isi calon klien baru.'
                    }
                    actions={
                        !isEdit && clients.length > 0 ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => switchToNewClient(!newClient)}
                            >
                                {newClient ? (
                                    <>
                                        <UserRound className="size-4" /> Pilih
                                        klien yang ada
                                    </>
                                ) : (
                                    <>
                                        <UserRoundPlus className="size-4" />{' '}
                                        Klien baru
                                    </>
                                )}
                            </Button>
                        ) : undefined
                    }
                >
                    {isEdit ? (
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                                {(selectedClient?.name ?? '?')
                                    .charAt(0)
                                    .toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate font-medium">
                                    {selectedClient?.name ?? '—'}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {[
                                        selectedClient?.email,
                                        selectedClient?.phone,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || 'Tanpa kontak'}
                                </p>
                            </div>
                        </div>
                    ) : newClient ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="client-name">
                                    Nama klien{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="client-name"
                                    value={data.client.name}
                                    onChange={(e) =>
                                        form.setData(
                                            'client.name',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="PT Contoh Jaya / Nama orang"
                                    aria-invalid={!!errors['client.name']}
                                    required
                                />
                                <InputError message={errors['client.name']} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="client-phone">
                                    No. WhatsApp
                                </Label>
                                <Input
                                    id="client-phone"
                                    type="tel"
                                    inputMode="tel"
                                    value={data.client.phone}
                                    onChange={(e) =>
                                        form.setData(
                                            'client.phone',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="08xxxxxxxxxx"
                                    aria-invalid={!!errors['client.phone']}
                                />
                                <InputError message={errors['client.phone']} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="client-email">Email</Label>
                                <Input
                                    id="client-email"
                                    type="email"
                                    value={data.client.email}
                                    onChange={(e) =>
                                        form.setData(
                                            'client.email',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="nama@email.com"
                                    aria-invalid={!!errors['client.email']}
                                />
                                <InputError message={errors['client.email']} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="client-address">Alamat</Label>
                                <Textarea
                                    id="client-address"
                                    rows={2}
                                    value={data.client.address}
                                    onChange={(e) =>
                                        form.setData(
                                            'client.address',
                                            e.target.value,
                                        )
                                    }
                                    aria-invalid={!!errors['client.address']}
                                />
                                <InputError
                                    message={errors['client.address']}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground sm:col-span-2">
                                Klien baru otomatis tersimpan saat penawaran
                                disimpan.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="client-select">Klien</Label>
                            <Select
                                value={
                                    data.client_id !== null
                                        ? String(data.client_id)
                                        : undefined
                                }
                                onValueChange={(v) => changeClient(Number(v))}
                            >
                                <SelectTrigger
                                    id="client-select"
                                    className="w-full"
                                    aria-invalid={!!errors.client_id}
                                >
                                    <SelectValue placeholder="Pilih klien" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem
                                            key={c.id}
                                            value={String(c.id)}
                                        >
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.client_id} />
                            {selectedClient && (
                                <p className="text-xs text-muted-foreground">
                                    {[
                                        selectedClient.email,
                                        selectedClient.phone,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || 'Tanpa kontak'}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="quote-project">
                            Proyek{' '}
                            <span className="font-normal text-muted-foreground">
                                (opsional)
                            </span>
                        </Label>
                        <ProjectSelect
                            id="quote-project"
                            projects={projects}
                            clientId={newClient ? null : data.client_id}
                            value={newClient ? null : data.project_id}
                            onChange={(id) => changeProject(id)}
                            disabled={newClient}
                            aria-invalid={!!errors.project_id}
                        />
                        <InputError message={errors.project_id} />
                        <p className="text-xs text-muted-foreground">
                            {newClient
                                ? 'Proyek bisa dipilih setelah klien baru tersimpan.'
                                : subProjects.length > 0
                                  ? `Termasuk ${subProjects.length} sub-proyek — tiap baris item bisa ditandai sub-proyeknya.`
                                  : 'Proyek ikut terbawa saat penawaran diubah jadi invoice.'}
                        </p>
                    </div>
                </FormSection>

                {/* ---------- Detail ---------- */}
                <FormSection
                    icon={CalendarDays}
                    title="Detail Penawaran"
                    description="Tanggal penawaran dan masa berlakunya."
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="issue-date">
                                Tanggal penawaran
                            </Label>
                            <Input
                                id="issue-date"
                                type="date"
                                value={data.issue_date}
                                onChange={(e) =>
                                    changeIssueDate(e.target.value)
                                }
                                aria-invalid={!!errors.issue_date}
                                required
                            />
                            <InputError message={errors.issue_date} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="valid-until">Berlaku sampai</Label>
                            <Input
                                id="valid-until"
                                type="date"
                                min={data.issue_date || undefined}
                                value={data.valid_until}
                                onChange={(e) =>
                                    form.setData('valid_until', e.target.value)
                                }
                                aria-invalid={!!errors.valid_until}
                            />
                            <div
                                className="flex flex-wrap gap-1.5"
                                role="group"
                                aria-label="Pilihan cepat masa berlaku"
                            >
                                {VALIDITY_PRESETS.map((days) =>
                                    presetButton(
                                        validDays === days,
                                        `${days} hari`,
                                        () =>
                                            form.setData(
                                                'valid_until',
                                                addDaysISO(
                                                    data.issue_date,
                                                    days,
                                                ),
                                            ),
                                        days,
                                    ),
                                )}
                            </div>
                            <InputError message={errors.valid_until} />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Setelah lewat tanggal ini, penawaran otomatis
                        kedaluwarsa dan tidak bisa diterima klien. Kosongkan
                        untuk default 14 hari.
                    </p>
                </FormSection>

                {/* ---------- Item ---------- */}
                <FormSection
                    icon={ListChecks}
                    title="Item"
                    description="Layanan / produk yang ditawarkan: qty × harga satuan."
                    actions={
                        <ProductPickerDialog
                            products={products}
                            clientId={newClient ? null : data.client_id}
                            usedProductIds={usedProductIds}
                            onAdd={addProducts}
                        />
                    }
                >
                    {data.items.length === 0 && (
                        <EmptyState
                            icon={ListChecks}
                            title="Belum ada item"
                            description="Pilih produk atau tambah baris manual untuk mulai."
                            className="rounded-lg border border-dashed py-8"
                        />
                    )}

                    <QuoteItemsEditor
                        rows={data.items}
                        productName={(id) => productNames.get(id)}
                        projectName={(id) =>
                            projects.find((p) => p.id === id)?.full_name
                        }
                        itemProjects={
                            showItemProjects &&
                            data.client_id !== null &&
                            data.project_id !== null
                                ? {
                                      projects,
                                      clientId: data.client_id,
                                      withinProjectId: data.project_id,
                                  }
                                : null
                        }
                        rowError={rowError}
                        onChange={changeRow}
                        onRemove={removeRow}
                        onMove={moveRow}
                        onAdd={addRow}
                    />
                    <InputError message={errors.items} />
                </FormSection>

                {/* ---------- Diskon & Pajak ---------- */}
                <FormSection
                    icon={Percent}
                    title="Diskon & Pajak"
                    description="PPN & PPh 23 dihitung dari subtotal setelah diskon (DPP)."
                >
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="discount-value">Diskon</Label>
                            <div className="flex gap-2 sm:max-w-sm">
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    aria-label="Jenis diskon"
                                    value={data.discount_type}
                                    onValueChange={(v) =>
                                        v &&
                                        form.setData(
                                            'discount_type',
                                            v as DiscountType,
                                        )
                                    }
                                    className="shrink-0"
                                >
                                    <ToggleGroupItem
                                        value="amount"
                                        aria-label="Nominal (Rp)"
                                        className="px-3"
                                    >
                                        Rp
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="percent"
                                        aria-label="Persen (%)"
                                        className="px-3"
                                    >
                                        %
                                    </ToggleGroupItem>
                                </ToggleGroup>
                                <div className="min-w-0 flex-1">
                                    <AffixInput
                                        id="discount-value"
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={
                                            data.discount_type === 'percent'
                                                ? 100
                                                : undefined
                                        }
                                        step="any"
                                        placeholder="0"
                                        suffix={
                                            data.discount_type === 'percent'
                                                ? '%'
                                                : undefined
                                        }
                                        className="text-right"
                                        value={data.discount_value}
                                        onChange={(e) =>
                                            form.setData(
                                                'discount_value',
                                                e.target.value,
                                            )
                                        }
                                        aria-invalid={!!errors.discount_value}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {totals.discount > 0
                                    ? `Potongan ${formatIDR(totals.discount)}`
                                    : 'Tanpa diskon'}
                            </p>
                            <InputError
                                message={
                                    errors.discount_value ??
                                    errors.discount_type
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tax-rate">PPN</Label>
                            <div className="flex gap-2">
                                <div className="w-24 shrink-0">
                                    <AffixInput
                                        id="tax-rate"
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={100}
                                        step="any"
                                        placeholder="0"
                                        suffix="%"
                                        className="text-right"
                                        value={data.tax_rate}
                                        onChange={(e) =>
                                            form.setData(
                                                'tax_rate',
                                                e.target.value,
                                            )
                                        }
                                        aria-invalid={!!errors.tax_rate}
                                    />
                                </div>
                                <div
                                    className="flex flex-wrap gap-1.5"
                                    role="group"
                                    aria-label="Pilihan cepat PPN"
                                >
                                    {taxPresets.map((rate) =>
                                        presetButton(
                                            toNumber(data.tax_rate) === rate,
                                            `${formatNumber(rate)}%`,
                                            () =>
                                                form.setData(
                                                    'tax_rate',
                                                    String(rate),
                                                ),
                                            rate,
                                        ),
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {totals.tax > 0
                                    ? `PPN ${formatIDR(totals.tax)}`
                                    : 'Tanpa PPN'}
                            </p>
                            <InputError message={errors.tax_rate} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pph-rate">
                                PPh 23{' '}
                                <span className="font-normal text-muted-foreground">
                                    (dipotong klien)
                                </span>
                            </Label>
                            <div className="flex gap-2">
                                <div className="w-24 shrink-0">
                                    <AffixInput
                                        id="pph-rate"
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={15}
                                        step="any"
                                        placeholder="0"
                                        suffix="%"
                                        className="text-right"
                                        value={data.pph_rate}
                                        onChange={(e) =>
                                            form.setData(
                                                'pph_rate',
                                                e.target.value,
                                            )
                                        }
                                        aria-invalid={!!errors.pph_rate}
                                    />
                                </div>
                                <div
                                    className="flex flex-wrap gap-1.5"
                                    role="group"
                                    aria-label="Pilihan cepat PPh 23"
                                >
                                    {PPH_PRESETS.map((rate) =>
                                        presetButton(
                                            toNumber(data.pph_rate) === rate,
                                            `${formatNumber(rate)}%`,
                                            () =>
                                                form.setData(
                                                    'pph_rate',
                                                    String(rate),
                                                ),
                                            rate,
                                        ),
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {totals.pph > 0
                                    ? `Dipotong ${formatIDR(totals.pph)}`
                                    : 'Tidak dipotong'}
                            </p>
                            <InputError message={errors.pph_rate} />
                        </div>
                    </div>
                </FormSection>

                {/* ---------- Catatan & syarat ---------- */}
                <FormSection
                    icon={NotebookPen}
                    title="Catatan & Syarat"
                    description="Opsional — tampil di penawaran & PDF untuk klien."
                >
                    <div className="space-y-2">
                        <Label htmlFor="notes">Catatan</Label>
                        <Textarea
                            id="notes"
                            rows={3}
                            maxLength={5000}
                            value={data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            placeholder="Ruang lingkup, estimasi waktu pengerjaan, dll."
                            aria-invalid={!!errors.notes}
                        />
                        <InputError message={errors.notes} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="terms">Syarat & ketentuan</Label>
                        <Textarea
                            id="terms"
                            rows={4}
                            maxLength={5000}
                            value={data.terms}
                            onChange={(e) =>
                                form.setData('terms', e.target.value)
                            }
                            placeholder={
                                'Satu syarat per baris, mis.\nDP 50% sebelum pekerjaan dimulai\nRevisi maksimal 2 kali'
                            }
                            aria-invalid={!!errors.terms}
                        />
                        <p className="text-xs text-muted-foreground">
                            Satu syarat per baris — dicetak sebagai daftar
                            bernomor.
                        </p>
                        <InputError message={errors.terms} />
                    </div>
                </FormSection>
            </div>

            {/* ---------- Ringkasan (sticky) ---------- */}
            <aside className="space-y-4 lg:sticky lg:top-20">
                <Card className="gap-4 py-5">
                    <CardHeader className="px-5">
                        <CardTitle className="text-base">Ringkasan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-5">
                        <SummaryRow
                            label="Klien"
                            value={
                                <span className="block max-w-[12rem] truncate">
                                    {clientLabel}
                                </span>
                            }
                        />
                        {quoteProject && !newClient && (
                            <SummaryRow
                                label="Proyek"
                                value={
                                    <span className="block max-w-[12rem] truncate">
                                        {quoteProject.full_name}
                                    </span>
                                }
                            />
                        )}
                        <SummaryRow
                            label="Berlaku sampai"
                            value={formatDate(
                                data.valid_until || null,
                                '14 hari',
                            )}
                        />
                        <SummaryRow
                            label="Item"
                            value={`${filledRows} baris`}
                        />
                        <Separator />
                        <SummaryRow
                            label="Subtotal"
                            value={formatIDR(totals.subtotal)}
                        />
                        {totals.discount > 0 && (
                            <SummaryRow
                                label={`Diskon${data.discount_type === 'percent' ? ` (${formatNumber(Math.min(toNumber(data.discount_value), 100))}%)` : ''}`}
                                value={
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                        − {formatIDR(totals.discount)}
                                    </span>
                                }
                            />
                        )}
                        {totals.discount > 0 &&
                            (totals.tax > 0 || totals.pph > 0) && (
                                <SummaryRow
                                    label="DPP"
                                    value={formatIDR(totals.taxable)}
                                />
                            )}
                        {toNumber(data.tax_rate) > 0 && (
                            <SummaryRow
                                label={`PPN (${formatNumber(data.tax_rate)}%)`}
                                value={formatIDR(totals.tax)}
                            />
                        )}
                        {totals.pph > 0 && (
                            <SummaryRow
                                label={`PPh 23 (${formatNumber(data.pph_rate)}%)`}
                                value={`− ${formatIDR(totals.pph)}`}
                            />
                        )}
                        <Separator />
                        <div className="flex items-baseline justify-between gap-4">
                            <span className="text-sm font-medium">Total</span>
                            <span className="text-2xl font-semibold tracking-tight tabular-nums">
                                {formatIDR(totals.total)}
                            </span>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-2 px-5">
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={form.processing}
                        >
                            {form.processing && <Spinner />}
                            {form.processing ? 'Menyimpan…' : submitLabel}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            asChild
                        >
                            <Link href={cancelHref}>Batal</Link>
                        </Button>
                        {!isEdit && (
                            <p className="text-center text-xs text-muted-foreground">
                                Disimpan sebagai draft. Kirim ke klien dari
                                halaman detail penawaran.
                            </p>
                        )}
                    </CardFooter>
                </Card>
            </aside>
        </form>
    );
}
