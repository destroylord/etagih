import { Link, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    CalendarClock,
    CalendarDays,
    Clock,
    FileText,
    FolderKanban,
    ListChecks,
    NotebookPen,
    Percent,
    Repeat,
    UserRound,
    UserRoundPlus,
    Users,
    Wallet,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import InputError from '@/components/input-error';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { RECURRENCE_LABEL } from '@/types/models';
import type {
    DiscountType,
    InvoiceMode,
    InvoiceType,
    ProjectOption,
    Recurrence,
} from '@/types/models';
import { ItemsEditor } from './items-editor';
import {
    AffixInput,
    ChoiceCards,
    FormSection,
    RatePicker,
    SummaryRow,
} from './parts';
import type { Choice } from './parts';
import { ProductPickerDialog } from './product-picker-dialog';
import { SessionPicker, sessionInProject } from './session-picker';
import {
    blankRow,
    buildSchedulePreview,
    cleanDecimal,
    computeTotals,
    defaultHourlyRate,
    isBlankRow,
    isWithinProject,
    lineTotal,
} from './utils';
import type {
    FormClient,
    FormProduct,
    FormSession,
    InvoiceFormData,
    ItemRow,
} from './utils';

const MODE_OPTIONS: Choice<InvoiceMode>[] = [
    {
        value: 'fixed',
        title: 'Uraian Jasa (Flat)',
        description: 'Harga tetap per pengerjaan',
        icon: FileText,
    },
    {
        value: 'hourly',
        title: 'Per Jam (Hourly)',
        description: 'Jam × tarif — manual atau dari Time Tracker',
        icon: Clock,
    },
];

const TYPE_OPTIONS: Choice<InvoiceType>[] = [
    {
        value: 'full',
        title: 'Bayar Lunas',
        description: 'Sekali bayar penuh',
        icon: Wallet,
    },
    {
        value: 'installment',
        title: 'Cicilan',
        description: 'Dibagi beberapa termin',
        icon: CalendarClock,
    },
];

const RECURRENCE_OPTIONS = Object.entries(RECURRENCE_LABEL) as [
    Recurrence,
    string,
][];

/** Kunci error yang sudah ditampilkan inline (selain items.*). */
const INLINE_ERROR_KEYS = new Set([
    'client_id',
    'client.name',
    'client.phone',
    'client.email',
    'client.address',
    'project_id',
    'invoice_mode',
    'type',
    'issue_date',
    'due_date',
    'notes',
    'discount_type',
    'discount_value',
    'tax_rate',
    'pph_rate',
    'recurrence',
    'recurrence_auto_send',
    'items',
    'installments',
    'installments.count',
    'installments.first_due_date',
    'installments.interval_days',
]);

export type InvoiceFormProps = {
    mode: 'create' | 'edit';
    initial: InvoiceFormData;
    clients: FormClient[];
    products: FormProduct[];
    /** Proyek & sub-proyek (non-arsip) semua client. */
    projects: ProjectOption[];
    /** Sesi yang boleh dipilih (unbilled + yang sudah tertaut ke invoice ini saat edit). */
    sessions: FormSession[];
    submitUrl: string;
    method: 'post' | 'put';
    submitLabel: string;
    cancelHref: string;
    defaultTaxRate?: number;
};

export function InvoiceForm({
    mode,
    initial,
    clients,
    products,
    projects,
    sessions,
    submitUrl,
    method,
    submitLabel,
    cancelHref,
    defaultTaxRate = 0,
}: InvoiceFormProps) {
    const isEdit = mode === 'edit';
    const form = useForm<InvoiceFormData>(initial);
    const { data } = form;
    const errors = form.errors as Record<string, string | undefined>;

    const [newClient, setNewClient] = useState(
        !isEdit && initial.client_id === null,
    );
    const submittedKeys = useRef<string[]>([]);
    const errorAlertRef = useRef<HTMLDivElement>(null);

    const isHourly = data.invoice_mode === 'hourly';
    const isInstallment = data.type === 'installment';

    const sessionMap = useMemo(
        () => new Map(sessions.map((s) => [s.id, s])),
        [sessions],
    );
    const selectedClient =
        data.client_id !== null
            ? clients.find((c) => c.id === data.client_id)
            : undefined;
    const invoiceProject =
        data.project_id !== null
            ? projects.find((p) => p.id === data.project_id)
            : undefined;
    const rateFor = (
        projectId: number | null,
        clientRate = selectedClient?.hourly_rate,
    ) => defaultHourlyRate(projects, projectId, clientRate);
    /** Tarif default baris (sub-proyek baris -> proyek invoice -> client). */
    const rowRate = (row: Pick<ItemRow, 'project_id'>) =>
        rateFor(row.project_id ?? data.project_id);
    const hourlyRate = rateFor(data.project_id);
    // Pilihan sub-proyek per baris hanya bila proyek invoice = proyek utama yang punya sub-proyek.
    const subProjects =
        invoiceProject && invoiceProject.parent_id === null
            ? projects.filter((p) => p.parent_id === invoiceProject.id)
            : [];
    const showItemProjects =
        !newClient && data.client_id !== null && subProjects.length > 0;
    const projectNameOf = (id: number) =>
        projects.find((p) => p.id === id)?.full_name ??
        sessions.find((s) => s.project_id === id)?.project?.name;
    const clientSessions =
        !newClient && data.client_id !== null
            ? sessions.filter((s) => s.client_id === data.client_id)
            : [];
    const selectedSessionIds = useMemo(
        () => new Set(data.items.flatMap((r) => r.session_ids)),
        [data.items],
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
    const productNames = useMemo(
        () => new Map(products.map((p) => [p.id, p.name])),
        [products],
    );

    // ---- Perhitungan (cermin backend) ----
    const subtotal = data.items.reduce(
        (s, r) => s + lineTotal(r, isHourly, sessionMap),
        0,
    );
    const totals = computeTotals(
        subtotal,
        data.discount_type,
        data.discount_value,
        data.tax_rate,
        data.pph_rate,
    );
    const schedule = isInstallment
        ? buildSchedulePreview(
              totals.total,
              data.installments.count,
              data.installments.first_due_date,
              data.installments.interval_days,
          )
        : [];
    const filledRows = data.items.filter((r) => !isBlankRow(r)).length;

    // ---- Helpers item ----
    const setItems = (updater: (items: ItemRow[]) => ItemRow[]) =>
        form.setData((prev) => ({ ...prev, items: updater(prev.items) }));

    /** Tarif baris masih kosong atau masih sama dengan tarif default sebelumnya? */
    const isDefaultPrice = (row: ItemRow, previous: string) =>
        row.session_ids.length === 0 &&
        (toNumber(row.unit_price) === 0 ||
            (previous !== '' &&
                toNumber(row.unit_price) === toNumber(previous)));

    /**
     * Isi tarif per jam default (mode hourly) pada baris manual yang tarifnya
     * kosong / masih tarif default lama. `rate` dihitung per baris.
     */
    const withRate = (
        items: ItemRow[],
        rate: (row: ItemRow) => string,
        previous: (row: ItemRow) => string = () => '',
    ) =>
        items.map((r) => {
            const next = rate(r);

            return next && isDefaultPrice(r, previous(r))
                ? { ...r, unit_price: next }
                : r;
        });

    const changeRow = (index: number, patch: Partial<ItemRow>) =>
        setItems((items) =>
            items.map((r, i) => {
                if (i !== index) {
                    return r;
                }

                const next = { ...r, ...patch };

                // Ganti sub-proyek: tarif default ikut sub-proyek bila belum diubah manual.
                if (
                    isHourly &&
                    'project_id' in patch &&
                    patch.project_id !== r.project_id
                ) {
                    const rate = rowRate(next);

                    if (rate && isDefaultPrice(r, rowRate(r))) {
                        next.unit_price = rate;
                    }
                }

                return next;
            }),
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

    const addRow = (afterIndex?: number, productId: number | null = null) => {
        const row = blankRow({
            product_id: productId,
            unit_price: isHourly ? hourlyRate : '',
        });
        setItems((items) => {
            if (afterIndex === undefined) {
                return [...items, row];
            }

            const next = [...items];
            next.splice(afterIndex + 1, 0, row);

            return next;
        });

        return row.key;
    };

    const addProducts = (picked: FormProduct[]) =>
        setItems((items) => {
            // Ganti baris kosong yang tersisa agar tidak menumpuk baris kosong.
            const base = items.filter((r) => !isBlankRow(r));

            return [
                ...base,
                ...picked.map((p) =>
                    blankRow({
                        product_id: p.id,
                        unit_price: isHourly ? hourlyRate : '',
                    }),
                ),
            ];
        });

    /** Proyek sesi dikirim sebagai proyek baris bila sah untuk proyek invoice. */
    const sessionRowProject = (s: FormSession): number | null => {
        const pid = s.project_id ?? null;

        if (pid === null || data.project_id === null) {
            return pid;
        }

        if (pid === data.project_id) {
            return null;
        }

        return invoiceProject?.parent_id === null &&
            sessionInProject(s, projects, data.project_id)
            ? pid
            : null;
    };

    const sessionRow = (s: FormSession) =>
        blankRow({
            description: s.description || 'Sesi kerja',
            unit_price: cleanDecimal(s.unit_price),
            session_ids: [s.id],
            project_id: sessionRowProject(s),
        });

    const toggleSession = (s: FormSession, checked: boolean) =>
        setItems((items) => {
            if (checked) {
                if (items.some((r) => r.session_ids.includes(s.id))) {
                    return items;
                }

                return [...items.filter((r) => !isBlankRow(r)), sessionRow(s)];
            }

            return items
                .map((r) =>
                    r.session_ids.includes(s.id)
                        ? {
                              ...r,
                              session_ids: r.session_ids.filter(
                                  (id) => id !== s.id,
                              ),
                          }
                        : r,
                )
                .filter(
                    (r, i) =>
                        !(
                            items[i].session_ids.includes(s.id) &&
                            r.session_ids.length === 0
                        ),
                );
        });

    const toggleAllSessions = (list: FormSession[], checked: boolean) => {
        if (checked) {
            const fresh = list.filter((s) => !selectedSessionIds.has(s.id));
            setItems((items) => [
                ...items.filter((r) => !isBlankRow(r)),
                ...fresh.map(sessionRow),
            ]);
        } else {
            const ids = new Set(list.map((s) => s.id));
            setItems((items) =>
                items
                    .map((r) => ({
                        ...r,
                        session_ids: r.session_ids.filter((id) => !ids.has(id)),
                    }))
                    .filter(
                        (r, i) =>
                            !(
                                items[i].session_ids.length > 0 &&
                                r.session_ids.length === 0
                            ),
                    ),
            );
        }
    };

    // ---- Perubahan field yang punya efek samping ----
    const changeMode = (mode: InvoiceMode) =>
        form.setData((prev) => {
            if (mode === 'fixed') {
                // Sesi Time Tracker hanya berlaku di mode per jam.
                return {
                    ...prev,
                    invoice_mode: mode,
                    items: prev.items.filter((r) => r.session_ids.length === 0),
                };
            }

            return {
                ...prev,
                invoice_mode: mode,
                items: withRate(prev.items, rowRate),
            };
        });

    const changeClient = (id: number) => {
        const client = clients.find((c) => c.id === id);
        const rate = defaultHourlyRate(projects, null, client?.hourly_rate);
        form.setData((prev) => {
            // Sesi & proyek milik client lama dilepas saat ganti client.
            const items = prev.items
                .filter((r) => r.session_ids.length === 0)
                .map((r) => ({ ...r, project_id: null }));

            return {
                ...prev,
                client_id: id,
                project_id: null,
                items:
                    prev.invoice_mode === 'hourly'
                        ? withRate(items, () => rate, rowRate)
                        : items,
            };
        });
        form.clearErrors('client_id', 'project_id');
    };

    const changeProject = (id: number | null) => {
        form.setData((prev) => {
            const nextProject =
                id !== null ? projects.find((p) => p.id === id) : undefined;
            // Sub-proyek baris yang tidak lagi berada di bawah proyek baru dilepas.
            const items = prev.items.map((r) => {
                if (r.project_id === null || id === null) {
                    return r;
                }

                const keep =
                    nextProject?.parent_id === null &&
                    r.project_id !== id &&
                    isWithinProject(projects, r.project_id, id);

                return keep ? r : { ...r, project_id: null };
            });

            return {
                ...prev,
                project_id: id,
                items:
                    prev.invoice_mode === 'hourly'
                        ? withRate(
                              items,
                              (r) => rateFor(r.project_id ?? id),
                              (r) => rateFor(r.project_id ?? prev.project_id),
                          )
                        : items,
            };
        });
        form.clearErrors('project_id');
    };

    /** Urutkan baris supaya baris dengan sub-proyek yang sama berdampingan. */
    const sortByProject = () =>
        setItems((items) => {
            const order: (number | null)[] = [];
            items.forEach((r) => {
                if (!order.includes(r.project_id)) {
                    order.push(r.project_id);
                }
            });

            return [...items].sort(
                (a, b) =>
                    order.indexOf(a.project_id) - order.indexOf(b.project_id),
            );
        });

    const switchToNewClient = (on: boolean) => {
        setNewClient(on);
        form.setData((prev) => ({
            ...prev,
            client_id: on ? null : (clients[0]?.id ?? null),
            project_id: null,
            items: on
                ? prev.items.filter((r) => r.session_ids.length === 0)
                : prev.items,
        }));
    };

    // ---- Error mapping (index item yang dikirim → key baris) ----
    const rowError = (key: string, field: string): string | undefined => {
        const idx = submittedKeys.current.indexOf(key);

        if (idx < 0) {
            return undefined;
        }

        const prefix = `items.${idx}.${field}`;

        if (errors[prefix]) {
            return errors[prefix];
        }

        const nested = Object.keys(errors).find((k) =>
            k.startsWith(`${prefix}.`),
        );

        return nested ? errors[nested] : undefined;
    };

    const errorKeys = Object.keys(errors).filter((k) => errors[k]);
    const otherErrors = errorKeys
        .filter((k) => !INLINE_ERROR_KEYS.has(k) && !k.startsWith('items.'))
        .map((k) => errors[k] as string);

    // ---- Submit ----
    const submit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const rows = data.items.filter((r) => !isBlankRow(r));
        submittedKeys.current = rows.map((r) => r.key);

        form.transform((d) => {
            const items = rows.map((r) => ({
                description: r.description,
                unit_price: r.unit_price === '' ? 0 : r.unit_price,
                product_id: r.product_id,
                project_id: r.project_id,
                ...(d.invoice_mode === 'hourly'
                    ? r.session_ids.length > 0
                        ? { session_ids: r.session_ids }
                        : { hours_qty: r.hours_qty }
                    : {}),
            }));

            return {
                ...(newClient && !isEdit
                    ? { client_id: null, client: d.client }
                    : { client_id: d.client_id }),
                project_id: newClient && !isEdit ? null : d.project_id,
                invoice_mode: d.invoice_mode,
                type: d.type,
                issue_date: d.issue_date,
                // Cicilan: jatuh tempo diisi otomatis dari cicilan terakhir.
                due_date: d.type === 'installment' ? '' : d.due_date,
                notes: d.notes,
                discount_type: d.discount_type,
                discount_value: d.discount_value === '' ? 0 : d.discount_value,
                tax_rate: d.tax_rate === '' ? 0 : d.tax_rate,
                pph_rate: d.pph_rate === '' ? 0 : d.pph_rate,
                recurrence: d.recurrence,
                recurrence_auto_send:
                    d.recurrence !== 'none' && d.recurrence_auto_send,
                items,
                ...(d.type === 'installment'
                    ? { installments: d.installments }
                    : {}),
            };
        });

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
    // Ringkasan subtotal per sub-proyek (cermin pengelompokan PDF).
    const projectBreakdown = (() => {
        if (!data.items.some((r) => r.project_id !== null)) {
            return [];
        }

        const groups = new Map<string, { name: string; total: number }>();

        for (const r of data.items) {
            if (isBlankRow(r)) {
                continue;
            }

            const key = r.project_id !== null ? `p-${r.project_id}` : 'invoice';
            const name =
                r.project_id !== null
                    ? (projects.find((p) => p.id === r.project_id)?.name ??
                      projectNameOf(r.project_id) ??
                      'Sub-proyek')
                    : (invoiceProject?.name ?? 'Umum');
            const group = groups.get(key) ?? { name, total: 0 };
            group.total += lineTotal(r, isHourly, sessionMap);
            groups.set(key, group);
        }

        return [...groups.entries()];
    })();
    const projectRowsCount = data.items.filter(
        (r) => r.project_id !== null,
    ).length;
    const clientLabel = newClient
        ? data.client.name.trim() || 'Client baru'
        : (selectedClient?.name ?? '—');

    return (
        <form
            onSubmit={submit}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
        >
            <div className="min-w-0 space-y-6">
                {errorKeys.length > 0 && (
                    <Alert variant="destructive" ref={errorAlertRef}>
                        <AlertCircle className="size-4" />
                        <AlertTitle>Invoice belum bisa disimpan</AlertTitle>
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
                            ? 'Client tidak dapat diubah di mode edit; proyek masih bisa diganti.'
                            : 'Pilih client (dan proyeknya) atau buat client baru.'
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
                                        client yang ada
                                    </>
                                ) : (
                                    <>
                                        <UserRoundPlus className="size-4" />{' '}
                                        Client baru
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
                                    Nama client{' '}
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
                                Client baru otomatis tersimpan saat invoice
                                disimpan.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="client-select">Client</Label>
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
                                    <SelectValue placeholder="Pilih client" />
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
                                    {toNumber(selectedClient.hourly_rate) >
                                        0 && (
                                        <>
                                            {' '}
                                            · Tarif{' '}
                                            {formatIDR(
                                                selectedClient.hourly_rate,
                                            )}
                                            /jam
                                        </>
                                    )}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="invoice-project">
                            Proyek{' '}
                            <span className="font-normal text-muted-foreground">
                                (opsional)
                            </span>
                        </Label>
                        <ProjectSelect
                            id="invoice-project"
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
                                ? 'Proyek bisa dipilih setelah client baru tersimpan.'
                                : invoiceProject
                                  ? invoiceProject.parent_id === null &&
                                    subProjects.length > 0
                                      ? `Termasuk ${subProjects.length} sub-proyek — tiap baris item bisa ditandai sub-proyeknya.`
                                      : invoiceProject.parent_id !== null
                                        ? 'Sub-proyek — semua item masuk ke sub-proyek ini.'
                                        : 'Semua item masuk ke proyek ini.'
                                  : 'Kelompokkan invoice per proyek untuk laporan & filter.'}
                            {!newClient &&
                                invoiceProject &&
                                toNumber(invoiceProject.hourly_rate) > 0 && (
                                    <>
                                        {' '}
                                        · Tarif proyek{' '}
                                        {formatIDR(invoiceProject.hourly_rate)}
                                        /jam
                                    </>
                                )}
                        </p>
                    </div>
                </FormSection>

                {/* ---------- Detail Invoice ---------- */}
                <FormSection
                    icon={CalendarDays}
                    title="Detail Invoice"
                    description="Cara penagihan dan tanggal invoice."
                >
                    <div className="space-y-2">
                        <Label>Mode penagihan</Label>
                        <ChoiceCards
                            label="Mode penagihan"
                            value={data.invoice_mode}
                            onChange={changeMode}
                            options={MODE_OPTIONS}
                        />
                        {isHourly &&
                            data.items.some(
                                (r) => r.session_ids.length > 0,
                            ) && (
                                <p className="text-xs text-muted-foreground">
                                    Beralih ke Flat akan melepas baris dari Time
                                    Tracker.
                                </p>
                            )}
                        <InputError message={errors.invoice_mode} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="issue-date">Tanggal terbit</Label>
                            <Input
                                id="issue-date"
                                type="date"
                                value={data.issue_date}
                                onChange={(e) =>
                                    form.setData('issue_date', e.target.value)
                                }
                                aria-invalid={!!errors.issue_date}
                                required
                            />
                            <InputError message={errors.issue_date} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="due-date">
                                Jatuh tempo{' '}
                                {!isInstallment && (
                                    <span className="font-normal text-muted-foreground">
                                        (opsional)
                                    </span>
                                )}
                            </Label>
                            {isInstallment ? (
                                <p className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                                    Otomatis:{' '}
                                    {formatDate(
                                        schedule[schedule.length - 1]
                                            ?.due_date ?? null,
                                        'dari cicilan terakhir',
                                    )}
                                </p>
                            ) : (
                                <Input
                                    id="due-date"
                                    type="date"
                                    min={data.issue_date || undefined}
                                    value={data.due_date}
                                    onChange={(e) =>
                                        form.setData('due_date', e.target.value)
                                    }
                                    aria-invalid={!!errors.due_date}
                                />
                            )}
                            <InputError message={errors.due_date} />
                        </div>
                    </div>
                </FormSection>

                {/* ---------- Item ---------- */}
                <FormSection
                    icon={ListChecks}
                    title="Item"
                    description={
                        isHourly
                            ? 'Isi jumlah jam manual per baris, atau centang sesi dari Time Tracker.'
                            : 'Tambahkan layanan dengan harga tetap. Enter untuk pindah ke baris berikutnya.'
                    }
                    actions={
                        <ProductPickerDialog
                            products={products}
                            clientId={newClient ? null : data.client_id}
                            usedProductIds={usedProductIds}
                            onAdd={addProducts}
                        />
                    }
                >
                    {isHourly && !newClient && data.client_id !== null && (
                        <SessionPicker
                            sessions={clientSessions}
                            selectedIds={selectedSessionIds}
                            projects={projects}
                            projectId={data.project_id}
                            onToggle={toggleSession}
                            onToggleAll={toggleAllSessions}
                        />
                    )}

                    {data.items.length === 0 && (
                        <EmptyState
                            icon={ListChecks}
                            title="Belum ada item"
                            description={
                                isHourly
                                    ? 'Pilih sesi Time Tracker di atas, pilih produk, atau tambah baris manual.'
                                    : 'Pilih produk atau tambah baris manual untuk mulai.'
                            }
                            className="rounded-lg border border-dashed py-8"
                        />
                    )}

                    {showItemProjects && data.items.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-start gap-2">
                                <FolderKanban className="mt-px size-3.5 shrink-0" />
                                <span>
                                    <span className="font-medium text-foreground">
                                        Kelompokkan per sub-proyek:
                                    </span>{' '}
                                    pilih sub-proyek di tiap baris — invoice &
                                    PDF menampilkan item per sub-proyek lengkap
                                    dengan subtotalnya.
                                </span>
                            </p>
                            {projectRowsCount > 0 && data.items.length > 2 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 shrink-0 text-xs"
                                    onClick={sortByProject}
                                >
                                    Urutkan per sub-proyek
                                </Button>
                            )}
                        </div>
                    )}

                    <ItemsEditor
                        rows={data.items}
                        isHourly={isHourly}
                        sessions={sessionMap}
                        productName={(id) => productNames.get(id)}
                        projectName={projectNameOf}
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

                {/* ---------- Pembayaran ---------- */}
                <FormSection
                    icon={Wallet}
                    title="Pembayaran"
                    description="Skema pembayaran untuk client."
                >
                    <ChoiceCards
                        label="Skema pembayaran"
                        value={data.type}
                        onChange={(v) => form.setData('type', v)}
                        options={TYPE_OPTIONS}
                    />
                    <InputError message={errors.type} />
                    {isInstallment && (
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="inst-count">
                                    Jumlah cicilan
                                </Label>
                                <AffixInput
                                    id="inst-count"
                                    type="number"
                                    inputMode="numeric"
                                    min={2}
                                    max={24}
                                    step={1}
                                    suffix="x"
                                    value={data.installments.count}
                                    onChange={(e) =>
                                        form.setData(
                                            'installments.count',
                                            e.target.value,
                                        )
                                    }
                                    aria-invalid={
                                        !!errors['installments.count']
                                    }
                                    required
                                />
                                <InputError
                                    message={errors['installments.count']}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inst-first">
                                    Cicilan pertama
                                </Label>
                                <Input
                                    id="inst-first"
                                    type="date"
                                    value={data.installments.first_due_date}
                                    onChange={(e) =>
                                        form.setData(
                                            'installments.first_due_date',
                                            e.target.value,
                                        )
                                    }
                                    aria-invalid={
                                        !!errors['installments.first_due_date']
                                    }
                                    required
                                />
                                <InputError
                                    message={
                                        errors['installments.first_due_date']
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inst-interval">Interval</Label>
                                <AffixInput
                                    id="inst-interval"
                                    type="number"
                                    inputMode="numeric"
                                    min={7}
                                    max={365}
                                    step={1}
                                    suffix="hari"
                                    className="pr-12"
                                    value={data.installments.interval_days}
                                    onChange={(e) =>
                                        form.setData(
                                            'installments.interval_days',
                                            e.target.value,
                                        )
                                    }
                                    aria-invalid={
                                        !!errors['installments.interval_days']
                                    }
                                />
                                <InputError
                                    message={
                                        errors['installments.interval_days']
                                    }
                                />
                            </div>
                            <p className="text-xs text-muted-foreground sm:col-span-3">
                                2–24 cicilan, interval minimal 7 hari. Total
                                dibagi rata; cicilan terakhir menampung selisih
                                pembulatan.
                            </p>
                            <InputError
                                message={errors.installments}
                                className="sm:col-span-3"
                            />
                        </div>
                    )}
                </FormSection>

                {/* ---------- Diskon & Pajak ---------- */}
                <FormSection
                    icon={Percent}
                    title="Diskon & Pajak"
                    description="PPN & PPh 23 dihitung dari subtotal setelah diskon (DPP)."
                >
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="discount-value">Diskon</Label>
                            <div className="flex gap-2">
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
                                {data.discount_type === 'amount' &&
                                    toNumber(data.discount_value) > subtotal &&
                                    subtotal > 0 &&
                                    ' (dibatasi sebesar subtotal)'}
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
                            <RatePicker
                                id="tax-rate"
                                label="Pilihan cepat PPN"
                                value={data.tax_rate}
                                onChange={(v) => form.setData('tax_rate', v)}
                                presets={taxPresets}
                                invalid={!!errors.tax_rate}
                            />
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {totals.tax > 0
                                    ? `PPN ${formatIDR(totals.tax)}`
                                    : 'Tanpa PPN'}
                            </p>
                            <InputError message={errors.tax_rate} />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="pph-rate">
                                PPh 23 dipotong klien
                            </Label>
                            <RatePicker
                                id="pph-rate"
                                label="Pilihan cepat PPh 23"
                                value={data.pph_rate}
                                onChange={(v) => form.setData('pph_rate', v)}
                                presets={[0, 2]}
                                max={15}
                                invalid={!!errors.pph_rate}
                            />
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {totals.pph > 0
                                    ? `Dipotong ${formatIDR(totals.pph)} — klien membayar ${formatIDR(totals.total)}`
                                    : 'Tanpa potongan PPh'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Isi bila klien berbentuk badan usaha yang
                                memotong PPh 23 (umumnya 2% untuk jasa). Klien
                                menyetor PPh ke kantor pajak dan memberi bukti
                                potong.
                            </p>
                            <InputError message={errors.pph_rate} />
                        </div>
                    </div>
                </FormSection>

                {/* ---------- Berulang ---------- */}
                <FormSection
                    icon={Repeat}
                    title="Berulang"
                    description="Jadwalkan invoice ini terbit ulang secara berkala."
                >
                    <div className="space-y-2 sm:max-w-xs">
                        <Label htmlFor="recurrence">Frekuensi</Label>
                        <Select
                            value={data.recurrence}
                            onValueChange={(v) =>
                                form.setData('recurrence', v as Recurrence)
                            }
                        >
                            <SelectTrigger
                                id="recurrence"
                                className="w-full"
                                aria-invalid={!!errors.recurrence}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RECURRENCE_OPTIONS.map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.recurrence} />
                    </div>
                    {data.recurrence !== 'none' && (
                        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                            <p className="text-sm text-muted-foreground">
                                Invoice baru dibuat otomatis dari invoice ini
                                setiap periode, mulai dihitung dari tanggal
                                terbit saat invoice dikirim.
                            </p>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="recurrence-auto-send"
                                    checked={data.recurrence_auto_send}
                                    onCheckedChange={(c) =>
                                        form.setData(
                                            'recurrence_auto_send',
                                            c === true,
                                        )
                                    }
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <Label
                                        htmlFor="recurrence-auto-send"
                                        className="cursor-pointer"
                                    >
                                        Kirim otomatis ke client
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Jika tidak dicentang, invoice baru
                                        disimpan sebagai draft untuk Anda kirim
                                        manual.
                                    </p>
                                </div>
                            </div>
                            <InputError message={errors.recurrence_auto_send} />
                        </div>
                    )}
                </FormSection>

                {/* ---------- Catatan ---------- */}
                <FormSection
                    icon={NotebookPen}
                    title="Catatan"
                    description="Opsional — tampil di invoice untuk client."
                >
                    <Label htmlFor="notes" className="sr-only">
                        Catatan
                    </Label>
                    <Textarea
                        id="notes"
                        rows={4}
                        maxLength={5000}
                        value={data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        placeholder="Term & kondisi, petunjuk pembayaran, dll."
                        aria-invalid={!!errors.notes}
                    />
                    <InputError message={errors.notes} />
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
                            label="Client"
                            value={
                                <span className="block max-w-[12rem] truncate">
                                    {clientLabel}
                                </span>
                            }
                        />
                        {invoiceProject && !newClient && (
                            <SummaryRow
                                label="Proyek"
                                value={
                                    <span className="block max-w-[12rem] truncate">
                                        {invoiceProject.full_name}
                                    </span>
                                }
                            />
                        )}
                        <SummaryRow
                            label="Mode"
                            value={isHourly ? 'Per jam' : 'Flat'}
                        />
                        <SummaryRow
                            label="Item"
                            value={`${filledRows} baris`}
                        />
                        {projectBreakdown.length > 0 && (
                            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Per sub-proyek
                                </p>
                                <ul className="space-y-1 text-sm">
                                    {projectBreakdown.map(([key, g]) => (
                                        <li
                                            key={key}
                                            className="flex items-baseline justify-between gap-3"
                                        >
                                            <span className="min-w-0 truncate text-muted-foreground">
                                                {g.name}
                                            </span>
                                            <span className="font-medium whitespace-nowrap tabular-nums">
                                                {formatIDR(g.total)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
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
                            <>
                                <SummaryRow
                                    label="Total tagihan"
                                    value={formatIDR(totals.gross)}
                                />
                                <SummaryRow
                                    label={`PPh 23 (${formatNumber(data.pph_rate)}%) dipotong klien`}
                                    value={
                                        <span className="text-amber-600 dark:text-amber-400">
                                            − {formatIDR(totals.pph)}
                                        </span>
                                    }
                                />
                            </>
                        )}
                        <Separator />
                        <div className="flex items-baseline justify-between gap-4">
                            <span className="text-sm font-medium">
                                {totals.pph > 0 ? 'Total dibayar' : 'Total'}
                            </span>
                            <span className="text-2xl font-semibold tracking-tight tabular-nums">
                                {formatIDR(totals.total)}
                            </span>
                        </div>
                        {data.recurrence !== 'none' && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Repeat className="size-3.5" /> Berulang{' '}
                                {RECURRENCE_LABEL[
                                    data.recurrence
                                ].toLowerCase()}
                                {data.recurrence_auto_send &&
                                    ', kirim otomatis'}
                            </p>
                        )}

                        {isInstallment && (
                            <div className="space-y-2 pt-1">
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Jadwal cicilan
                                </p>
                                <ol className="divide-y rounded-lg border text-sm">
                                    {schedule.map((s) => (
                                        <li
                                            key={s.sequence}
                                            className="flex items-center justify-between gap-3 px-3 py-2"
                                        >
                                            <span className="min-w-0">
                                                <span className="font-medium">
                                                    #{s.sequence}
                                                </span>{' '}
                                                <span className="text-muted-foreground">
                                                    {formatDate(
                                                        s.due_date,
                                                        'tanggal belum diisi',
                                                    )}
                                                </span>
                                            </span>
                                            <span className="font-medium whitespace-nowrap tabular-nums">
                                                {formatIDR(s.amount)}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
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
                                Disimpan sebagai draft. Kirim ke client dari
                                halaman detail invoice.
                            </p>
                        )}
                    </CardFooter>
                </Card>
            </aside>
        </form>
    );
}
