import { Head, useForm } from '@inertiajs/react';
import {
    BellRing,
    Building2,
    CreditCard,
    FileText,
    Hash,
    MessageCircle,
    Percent,
    QrCode,
    Save,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo } from 'react';
import AlertError from '@/components/alert-error';
import { LogoUpload } from '@/components/settings/logo-upload';
import { PdfPreviewDialog } from '@/components/settings/pdf-preview-dialog';
import { QrisAccounts } from '@/components/settings/qris-accounts';
import type { QrisAccountRow } from '@/components/settings/qris-accounts';
import {
    QRIS_STYLE_DEFAULTS,
    QrisStyleEditor,
} from '@/components/settings/qris-style-editor';
import type { QrisStyleValue } from '@/components/settings/qris-style-editor';
import { Field, SettingsSection } from '@/components/settings/settings-section';
import { WaTemplateField } from '@/components/settings/wa-template-field';
import {
    DEFAULT_TEMPLATES,
    PLACEHOLDERS,
    sampleValues,
} from '@/components/settings/wa-templates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatIDR, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type Settings = {
    company_name: string | null;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_logo_path: string | null;
    bank_account_info: string | null;
    invoice_footer_text: string | null;
    app_invoice_prefix: string | null;
    default_hourly_rate: string | number | null;
    default_tax_rate?: string | number | null;
    reminder_days_before?: string | null;
    reminder_interval_days?: number | null;
    reminder_max_count?: number | null;
    wa_template_invoice: string | null;
    wa_template_payment_received: string | null;
    wa_template_reminder: string | null;
    wa_template_reminder_upcoming?: string | null;
    company_tax_id?: string | null;
    invoice_terms?: string | null;
    signature_path?: string | null;
    signer_name?: string | null;
    signer_title?: string | null;
    pdf_accent_color?: string | null;
    pdf_watermark?: 'logo' | 'text' | 'none' | null;
    pdf_watermark_text?: string | null;
    stamp_duty_enabled?: boolean | null;
};

const ACCENT_PRESETS = [
    { value: '#1e3a8a', label: 'Biru tua' },
    { value: '#0f766e', label: 'Teal' },
    { value: '#166534', label: 'Hijau' },
    { value: '#7c2d12', label: 'Cokelat' },
    { value: '#6b21a8', label: 'Ungu' },
    { value: '#0f172a', label: 'Hitam' },
];

const WATERMARK_OPTIONS = [
    { value: 'logo', label: 'Logo', hint: 'Logo samar di tengah halaman' },
    { value: 'text', label: 'Teks', hint: 'Nama perusahaan / teks bebas' },
    { value: 'none', label: 'Tanpa', hint: 'Tanpa watermark' },
] as const;

const SECTIONS = [
    { id: 'profil', label: 'Profil' },
    { id: 'penomoran', label: 'Penomoran & Tarif' },
    { id: 'pajak', label: 'Pajak' },
    { id: 'pembayaran', label: 'Pembayaran' },
    { id: 'qris', label: 'QRIS' },
    { id: 'pdf', label: 'PDF & Tanda Tangan' },
    { id: 'pengingat', label: 'Pengingat' },
    { id: 'template', label: 'Template WA' },
];

const QUICK_DAYS = [7, 3, 1];

function parseDays(value: string): number[] {
    return [
        ...new Set(
            value
                .split(',')
                .map((d) => parseInt(d.trim(), 10))
                .filter((d) => Number.isFinite(d) && d > 0),
        ),
    ].sort((a, b) => b - a);
}

function todayCompact(): string {
    const d = new Date();

    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default function SettingsInvoice({
    settings,
    defaultTerms = '',
    qrisStyle,
    qrisAccounts = [],
    qrisEnvFallback = false,
}: {
    settings: Settings;
    defaultTerms?: string;
    qrisStyle?: QrisStyleValue;
    qrisAccounts?: QrisAccountRow[];
    qrisEnvFallback?: boolean;
}) {
    const form = useForm({
        company_name: settings.company_name ?? '',
        company_address: settings.company_address ?? '',
        company_email: settings.company_email ?? '',
        company_phone: settings.company_phone ?? '',
        bank_account_info: settings.bank_account_info ?? '',
        invoice_footer_text: settings.invoice_footer_text ?? '',
        app_invoice_prefix: settings.app_invoice_prefix ?? 'INV',
        default_hourly_rate: String(
            toNumber(settings.default_hourly_rate ?? 50000),
        ),
        default_tax_rate: String(toNumber(settings.default_tax_rate ?? 0)),

        reminder_days_before: settings.reminder_days_before ?? '3,1',
        reminder_interval_days: String(settings.reminder_interval_days ?? 3),
        reminder_max_count: String(settings.reminder_max_count ?? 5),

        wa_template_invoice: settings.wa_template_invoice ?? '',
        wa_template_payment_received:
            settings.wa_template_payment_received ?? '',
        wa_template_reminder: settings.wa_template_reminder ?? '',
        wa_template_reminder_upcoming:
            settings.wa_template_reminder_upcoming ?? '',

        company_tax_id: settings.company_tax_id ?? '',
        invoice_terms: settings.invoice_terms ?? '',
        signer_name: settings.signer_name ?? '',
        signer_title: settings.signer_title ?? '',
        pdf_accent_color: settings.pdf_accent_color ?? '#1e3a8a',
        pdf_watermark: (settings.pdf_watermark ?? 'logo') as
            'logo' | 'text' | 'none',
        pdf_watermark_text: settings.pdf_watermark_text ?? '',
        stamp_duty_enabled: settings.stamp_duty_enabled ?? true,

        qris_style: (qrisStyle ?? QRIS_STYLE_DEFAULTS) as QrisStyleValue,

        company_logo: null as File | null,
        remove_logo: false,
        signature: null as File | null,
        remove_signature: false,
    });
    const { data, setData, errors } = form;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/settings/invoice', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                // Logo sudah diproses server — kosongkan input file & jadikan data sekarang sebagai acuan "tersimpan".
                const reset = {
                    company_logo: null,
                    remove_logo: false,
                    signature: null,
                    remove_signature: false,
                };
                form.setDefaults({ ...data, ...reset });
                form.setData((d) => ({ ...d, ...reset }));
            },
        });
    };

    const sample = useMemo(
        () => sampleValues(data.company_name, data.app_invoice_prefix),
        [data.company_name, data.app_invoice_prefix],
    );
    const days = parseDays(data.reminder_days_before);
    const daysValid =
        data.reminder_days_before.trim() === '' ||
        /^\s*\d{1,2}(\s*,\s*\d{1,2})*\s*$/.test(data.reminder_days_before);
    const maxCount = toNumber(data.reminder_max_count);
    const interval = Math.max(1, toNumber(data.reminder_interval_days));
    const prefixValid = /^[A-Z0-9]{1,10}$/.test(data.app_invoice_prefix);

    const toggleDay = (d: number) => {
        const next = days.includes(d)
            ? days.filter((x) => x !== d)
            : [...days, d];
        setData('reminder_days_before', next.sort((a, b) => b - a).join(','));
    };

    // Isian form saat ini (belum disimpan) untuk pratinjau PDF.
    const buildPreviewData = () => {
        const fd = new FormData();
        const fields = [
            'company_name',
            'company_address',
            'company_email',
            'company_phone',
            'company_tax_id',
            'bank_account_info',
            'invoice_footer_text',
            'invoice_terms',
            'signer_name',
            'signer_title',
            'pdf_accent_color',
            'pdf_watermark',
            'pdf_watermark_text',
        ] as const;

        for (const key of fields) {
            fd.append(key, String(data[key] ?? ''));
        }

        if (data.company_logo) {
            fd.append('company_logo', data.company_logo);
        }

        if (data.signature) {
            fd.append('signature', data.signature);
        }

        fd.append('remove_logo', data.remove_logo ? '1' : '0');
        fd.append('remove_signature', data.remove_signature ? '1' : '0');

        return fd;
    };

    const errorList = Object.values(errors);

    return (
        <>
            <Head title="Pengaturan Invoice" />
            <h1 className="sr-only">Pengaturan Invoice</h1>

            <form onSubmit={submit} className="space-y-6" noValidate>
                <header className="space-y-3">
                    <div>
                        <h2 className="text-base font-medium">
                            Invoice & perusahaan
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Profil yang tampil di invoice, penomoran, pajak,
                            pembayaran, pengingat otomatis & template WhatsApp.
                        </p>
                    </div>
                    <nav
                        aria-label="Bagian pengaturan"
                        className="flex flex-wrap gap-1.5"
                    >
                        {SECTIONS.map((s) => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                {s.label}
                            </a>
                        ))}
                    </nav>
                </header>

                {errorList.length > 0 && (
                    <AlertError
                        errors={errorList}
                        title="Pengaturan belum bisa disimpan:"
                    />
                )}

                {/* Profil Perusahaan */}
                <SettingsSection
                    id="profil"
                    icon={Building2}
                    title="Profil perusahaan"
                    description="Ditampilkan di invoice PDF dan halaman pembayaran klien."
                >
                    <Field label="Logo">
                        <LogoUpload
                            currentPath={settings.company_logo_path}
                            file={data.company_logo}
                            removed={data.remove_logo}
                            onFileChange={(f) => setData('company_logo', f)}
                            onRemoveChange={(r) => setData('remove_logo', r)}
                            error={errors.company_logo}
                        />
                    </Field>
                    <Field
                        label="Nama perusahaan"
                        htmlFor="company_name"
                        error={errors.company_name}
                    >
                        <Input
                            id="company_name"
                            value={data.company_name}
                            onChange={(e) =>
                                setData('company_name', e.target.value)
                            }
                            placeholder="PT Contoh Kreatif"
                            autoComplete="organization"
                        />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Email"
                            htmlFor="company_email"
                            error={errors.company_email}
                        >
                            <Input
                                id="company_email"
                                type="email"
                                value={data.company_email}
                                onChange={(e) =>
                                    setData('company_email', e.target.value)
                                }
                                placeholder="halo@perusahaan.id"
                                autoComplete="email"
                            />
                        </Field>
                        <Field
                            label="Telepon / WhatsApp"
                            htmlFor="company_phone"
                            error={errors.company_phone}
                        >
                            <Input
                                id="company_phone"
                                type="tel"
                                value={data.company_phone}
                                onChange={(e) =>
                                    setData('company_phone', e.target.value)
                                }
                                placeholder="0812xxxxxxx"
                                autoComplete="tel"
                            />
                        </Field>
                    </div>
                    <Field
                        label="NPWP"
                        htmlFor="company_tax_id"
                        error={errors.company_tax_id}
                        hint="Opsional. Dicetak di kop invoice — disarankan bila menagih PPN."
                    >
                        <Input
                            id="company_tax_id"
                            value={data.company_tax_id}
                            onChange={(e) =>
                                setData('company_tax_id', e.target.value)
                            }
                            placeholder="00.000.000.0-000.000"
                        />
                    </Field>
                    <Field
                        label="Alamat"
                        htmlFor="company_address"
                        error={errors.company_address}
                    >
                        <Textarea
                            id="company_address"
                            rows={3}
                            value={data.company_address}
                            onChange={(e) =>
                                setData('company_address', e.target.value)
                            }
                        />
                    </Field>
                </SettingsSection>

                {/* Penomoran & Tarif */}
                <SettingsSection
                    id="penomoran"
                    icon={Hash}
                    title="Penomoran & tarif"
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Prefix nomor invoice"
                            htmlFor="app_invoice_prefix"
                            error={
                                errors.app_invoice_prefix ??
                                (!prefixValid
                                    ? 'Wajib diisi, hanya huruf A–Z dan angka, maks. 10 karakter.'
                                    : undefined)
                            }
                            hint={
                                <>
                                    Contoh nomor:{' '}
                                    <span className="font-mono text-foreground">
                                        {data.app_invoice_prefix || 'PREFIX'}-
                                        {todayCompact()}-0001
                                    </span>
                                </>
                            }
                        >
                            <Input
                                id="app_invoice_prefix"
                                value={data.app_invoice_prefix}
                                onChange={(e) =>
                                    setData(
                                        'app_invoice_prefix',
                                        e.target.value
                                            .toUpperCase()
                                            .replace(/[^A-Z0-9]/g, ''),
                                    )
                                }
                                maxLength={10}
                                className="font-mono uppercase"
                                aria-invalid={!prefixValid}
                            />
                        </Field>
                        <Field
                            label="Tarif per jam default"
                            htmlFor="default_hourly_rate"
                            error={errors.default_hourly_rate}
                            hint={`${formatIDR(data.default_hourly_rate)}/jam · bisa diganti per client & per item.`}
                        >
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="default_hourly_rate"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1000"
                                    value={data.default_hourly_rate}
                                    onChange={(e) =>
                                        setData(
                                            'default_hourly_rate',
                                            e.target.value,
                                        )
                                    }
                                    className="pl-9 tabular-nums"
                                />
                            </div>
                        </Field>
                    </div>
                </SettingsSection>

                {/* Pajak */}
                <SettingsSection id="pajak" icon={Percent} title="Pajak">
                    <Field
                        label="PPN default"
                        htmlFor="default_tax_rate"
                        error={errors.default_tax_rate}
                        hint="Terisi otomatis saat membuat invoice baru dan bisa diubah per invoice. Isi 0 jika tidak memungut PPN."
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-32">
                                <Input
                                    id="default_tax_rate"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={data.default_tax_rate}
                                    onChange={(e) =>
                                        setData(
                                            'default_tax_rate',
                                            e.target.value,
                                        )
                                    }
                                    className="pr-8 tabular-nums"
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                    %
                                </span>
                            </div>
                            {[0, 11, 12].map((r) => (
                                <Button
                                    key={r}
                                    type="button"
                                    size="sm"
                                    variant={
                                        toNumber(data.default_tax_rate) === r
                                            ? 'secondary'
                                            : 'ghost'
                                    }
                                    onClick={() =>
                                        setData('default_tax_rate', String(r))
                                    }
                                >
                                    {r === 0 ? 'Tanpa PPN' : `${r}%`}
                                </Button>
                            ))}
                        </div>
                    </Field>
                </SettingsSection>

                {/* Pembayaran */}
                <SettingsSection
                    id="pembayaran"
                    icon={CreditCard}
                    title="Pembayaran"
                    description="QRIS dibuat otomatis. Rekening bank ditampilkan sebagai alternatif di halaman pembayaran."
                >
                    <Field
                        label="Informasi rekening bank"
                        htmlFor="bank_account_info"
                        error={errors.bank_account_info}
                        hint="Opsional. Kosongkan jika hanya menerima QRIS."
                    >
                        <Textarea
                            id="bank_account_info"
                            rows={4}
                            value={data.bank_account_info}
                            onChange={(e) =>
                                setData('bank_account_info', e.target.value)
                            }
                            placeholder={'BCA 123-456-7890\na.n. Nama Anda'}
                        />
                    </Field>
                    <Field
                        label="Pesan penutup"
                        htmlFor="invoice_footer_text"
                        error={errors.invoice_footer_text}
                        hint="Tampil di invoice & halaman pembayaran, mis. ucapan terima kasih. Syarat pembayaran diatur di bagian PDF di bawah."
                    >
                        <Textarea
                            id="invoice_footer_text"
                            rows={2}
                            value={data.invoice_footer_text}
                            onChange={(e) =>
                                setData('invoice_footer_text', e.target.value)
                            }
                        />
                    </Field>
                </SettingsSection>

                {/* QRIS */}
                <SettingsSection
                    id="qris"
                    icon={QrCode}
                    title="QRIS"
                    description="QRIS statis toko yang didaftarkan ke QRISLY, dan tampilan kode QR yang dilihat klien di halaman bayar."
                >
                    <Field label="QRIS terdaftar">
                        <QrisAccounts
                            accounts={qrisAccounts}
                            envFallback={qrisEnvFallback}
                        />
                    </Field>
                    <Field
                        label="Tampilan kode QR"
                        hint="Berlaku untuk QR di halaman bayar, gambar QR yang diunduh klien, dan QR link pembayaran di PDF."
                    >
                        <QrisStyleEditor
                            value={data.qris_style}
                            onChange={(v) => setData('qris_style', v)}
                            hasLogo={
                                !!data.company_logo ||
                                (!!settings.company_logo_path &&
                                    !data.remove_logo)
                            }
                            errors={errors as Record<string, string>}
                        />
                    </Field>
                </SettingsSection>

                {/* PDF & Tanda Tangan */}
                <SettingsSection
                    id="pdf"
                    icon={FileText}
                    title="Tampilan PDF & tanda tangan"
                    description="Warna, watermark, syarat & ketentuan, dan tanda tangan yang dicetak di setiap invoice."
                >
                    <Field
                        label="Warna aksen"
                        htmlFor="pdf_accent_color"
                        error={errors.pdf_accent_color}
                        hint="Dipakai untuk judul, header tabel, dan total."
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            {ACCENT_PRESETS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    title={c.label}
                                    aria-label={c.label}
                                    aria-pressed={
                                        data.pdf_accent_color.toLowerCase() ===
                                        c.value
                                    }
                                    onClick={() =>
                                        setData('pdf_accent_color', c.value)
                                    }
                                    className={cn(
                                        'size-7 rounded-full ring-offset-2 ring-offset-background transition',
                                        data.pdf_accent_color.toLowerCase() ===
                                            c.value
                                            ? 'ring-2 ring-foreground'
                                            : 'hover:scale-110',
                                    )}
                                    style={{ backgroundColor: c.value }}
                                />
                            ))}
                            <div className="ml-1 flex items-center gap-2">
                                <input
                                    id="pdf_accent_color"
                                    type="color"
                                    value={data.pdf_accent_color}
                                    onChange={(e) =>
                                        setData(
                                            'pdf_accent_color',
                                            e.target.value,
                                        )
                                    }
                                    className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
                                    aria-label="Pilih warna sendiri"
                                />
                                <code className="text-xs text-muted-foreground">
                                    {data.pdf_accent_color}
                                </code>
                            </div>
                        </div>
                    </Field>

                    <Field label="Watermark" error={errors.pdf_watermark}>
                        <div
                            role="radiogroup"
                            aria-label="Watermark"
                            className="grid gap-2 sm:grid-cols-3"
                        >
                            {WATERMARK_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={
                                        data.pdf_watermark === o.value
                                    }
                                    onClick={() =>
                                        setData('pdf_watermark', o.value)
                                    }
                                    className={cn(
                                        'rounded-lg border px-3 py-2.5 text-left transition-colors',
                                        data.pdf_watermark === o.value
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'hover:bg-muted/50',
                                    )}
                                >
                                    <div className="text-sm font-medium">
                                        {o.label}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {o.hint}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {data.pdf_watermark === 'logo' && (
                            <p className="text-xs text-muted-foreground">
                                Hasil terbaik dengan logo PNG berlatar
                                transparan. Bila belum ada logo, otomatis
                                memakai teks nama perusahaan.
                            </p>
                        )}
                        {data.pdf_watermark === 'text' && (
                            <Input
                                id="pdf_watermark_text"
                                value={data.pdf_watermark_text}
                                maxLength={60}
                                onChange={(e) =>
                                    setData(
                                        'pdf_watermark_text',
                                        e.target.value,
                                    )
                                }
                                placeholder={
                                    data.company_name || 'Nama perusahaan'
                                }
                                aria-label="Teks watermark"
                            />
                        )}
                        <p className="text-xs text-muted-foreground">
                            Invoice draft & dibatalkan selalu diberi watermark
                            status (DRAFT / DIBATALKAN); invoice lunas diberi
                            cap LUNAS.
                        </p>
                    </Field>

                    <Field
                        label="Syarat & ketentuan"
                        htmlFor="invoice_terms"
                        error={errors.invoice_terms}
                        hint="Satu baris = satu poin bernomor. Kosongkan untuk memakai syarat standar. Catatan khusus per invoice diisi di form invoice."
                    >
                        <Textarea
                            id="invoice_terms"
                            rows={5}
                            value={data.invoice_terms}
                            onChange={(e) =>
                                setData('invoice_terms', e.target.value)
                            }
                            placeholder={defaultTerms}
                        />
                        {defaultTerms && (
                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setData('invoice_terms', defaultTerms)
                                    }
                                >
                                    Isi dengan syarat standar
                                </Button>
                            </div>
                        )}
                    </Field>

                    <Field label="Tanda tangan" error={errors.signature}>
                        <LogoUpload
                            noun="tanda tangan"
                            maxMb={2}
                            sizeHint="Disarankan PNG berlatar transparan (tanda tangan di kertas putih → foto → hapus latar)."
                            transparentPreview
                            currentPath={settings.signature_path ?? null}
                            file={data.signature}
                            removed={data.remove_signature}
                            onFileChange={(f) => setData('signature', f)}
                            onRemoveChange={(r) =>
                                setData('remove_signature', r)
                            }
                        />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Nama penanda tangan"
                            htmlFor="signer_name"
                            error={errors.signer_name}
                        >
                            <Input
                                id="signer_name"
                                value={data.signer_name}
                                onChange={(e) =>
                                    setData('signer_name', e.target.value)
                                }
                                placeholder="Nama lengkap"
                            />
                        </Field>
                        <Field
                            label="Jabatan"
                            htmlFor="signer_title"
                            error={errors.signer_title}
                        >
                            <Input
                                id="signer_title"
                                value={data.signer_title}
                                onChange={(e) =>
                                    setData('signer_title', e.target.value)
                                }
                                placeholder="Direktur / Finance"
                            />
                        </Field>
                    </div>

                    <Field
                        label="Bea meterai kuitansi"
                        error={errors.stamp_duty_enabled}
                    >
                        <label className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                            <Checkbox
                                id="stamp_duty_enabled"
                                checked={data.stamp_duty_enabled}
                                onCheckedChange={(v) =>
                                    setData('stamp_duty_enabled', v === true)
                                }
                                className="mt-0.5"
                            />
                            <span className="text-sm">
                                Tampilkan kotak &ldquo;Tempel e-Meterai
                                Rp10.000&rdquo; pada kuitansi &gt; Rp5 juta
                                <span className="block text-xs text-muted-foreground">
                                    UU 10/2020: dokumen penerimaan uang di atas
                                    Rp5.000.000 wajib bermeterai Rp10.000.
                                </span>
                            </span>
                        </label>
                    </Field>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                            Pratinjau langsung memakai isian di halaman ini —
                            tidak perlu disimpan dulu. Data invoice memakai
                            invoice terbaru (atau contoh).
                        </p>
                        <PdfPreviewDialog buildFormData={buildPreviewData} />
                    </div>
                </SettingsSection>

                {/* Pengingat Otomatis */}
                <SettingsSection
                    id="pengingat"
                    icon={BellRing}
                    title="Pengingat otomatis"
                    description="Pengingat WhatsApp dikirim otomatis untuk invoice & cicilan yang belum dibayar."
                >
                    <Field
                        label="Sebelum jatuh tempo"
                        htmlFor="reminder_days_before"
                        error={
                            errors.reminder_days_before ??
                            (!daysValid
                                ? 'Format: angka hari dipisah koma, mis. 3,1'
                                : undefined)
                        }
                        hint="Jumlah hari sebelum jatuh tempo, pisahkan dengan koma. Kosongkan untuk menonaktifkan."
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                id="reminder_days_before"
                                value={data.reminder_days_before}
                                onChange={(e) =>
                                    setData(
                                        'reminder_days_before',
                                        e.target.value.replace(/[^\d,\s]/g, ''),
                                    )
                                }
                                placeholder="3,1"
                                className="w-32 font-mono"
                                aria-invalid={!daysValid}
                            />
                            {QUICK_DAYS.map((d) => (
                                <Button
                                    key={d}
                                    type="button"
                                    size="sm"
                                    variant={
                                        days.includes(d) ? 'secondary' : 'ghost'
                                    }
                                    aria-pressed={days.includes(d)}
                                    onClick={() => toggleDay(d)}
                                >
                                    H-{d}
                                </Button>
                            ))}
                        </div>
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Ulangi setelah lewat jatuh tempo"
                            htmlFor="reminder_interval_days"
                            error={errors.reminder_interval_days}
                            hint="Jeda antar pengingat (1–60 hari)."
                        >
                            <div className="relative">
                                <Input
                                    id="reminder_interval_days"
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={data.reminder_interval_days}
                                    onChange={(e) =>
                                        setData(
                                            'reminder_interval_days',
                                            e.target.value,
                                        )
                                    }
                                    className="pr-14 tabular-nums"
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                    hari
                                </span>
                            </div>
                        </Field>
                        <Field
                            label="Maksimal pengingat terlambat"
                            htmlFor="reminder_max_count"
                            error={errors.reminder_max_count}
                            hint="Per invoice/cicilan. Isi 0 untuk mematikan."
                        >
                            <div className="relative">
                                <Input
                                    id="reminder_max_count"
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={data.reminder_max_count}
                                    onChange={(e) =>
                                        setData(
                                            'reminder_max_count',
                                            e.target.value,
                                        )
                                    }
                                    className="pr-12 tabular-nums"
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                    kali
                                </span>
                            </div>
                        </Field>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                            Ringkasan jadwal
                        </p>
                        <ul className="mt-1.5 list-inside list-disc space-y-1">
                            <li>
                                {days.length > 0 ? (
                                    <>
                                        Pengingat dikirim{' '}
                                        <strong>
                                            {days
                                                .map((d) => `H-${d}`)
                                                .join(', ')}
                                        </strong>{' '}
                                        sebelum jatuh tempo.
                                    </>
                                ) : (
                                    'Tidak ada pengingat sebelum jatuh tempo.'
                                )}
                            </li>
                            <li>
                                {maxCount > 0 ? (
                                    <>
                                        Setelah lewat jatuh tempo: setiap{' '}
                                        <strong>{interval} hari</strong>,
                                        maksimal <strong>{maxCount}×</strong>.
                                    </>
                                ) : (
                                    'Pengingat setelah jatuh tempo dimatikan.'
                                )}
                            </li>
                        </ul>
                    </div>
                </SettingsSection>

                {/* Template WhatsApp */}
                <SettingsSection
                    id="template"
                    icon={MessageCircle}
                    title="Template WhatsApp"
                    description="Klik placeholder untuk menyisipkannya di posisi kursor. Biarkan kosong untuk memakai template default."
                >
                    <WaTemplateField
                        id="wa_template_invoice"
                        label="Invoice baru"
                        description="Dikirim saat invoice diterbitkan ke client."
                        value={data.wa_template_invoice}
                        onChange={(v) => setData('wa_template_invoice', v)}
                        placeholders={PLACEHOLDERS.invoice}
                        defaultTemplate={DEFAULT_TEMPLATES.invoice}
                        sample={sample}
                        error={errors.wa_template_invoice}
                    />
                    <Divider />
                    <WaTemplateField
                        id="wa_template_payment_received"
                        label="Pembayaran diterima"
                        description="Dikirim setelah pembayaran berhasil dicatat."
                        value={data.wa_template_payment_received}
                        onChange={(v) =>
                            setData('wa_template_payment_received', v)
                        }
                        placeholders={PLACEHOLDERS.payment_received}
                        defaultTemplate={DEFAULT_TEMPLATES.payment_received}
                        sample={sample}
                        error={errors.wa_template_payment_received}
                    />
                    <Divider />
                    <WaTemplateField
                        id="wa_template_reminder_upcoming"
                        label="Pengingat sebelum jatuh tempo"
                        description="Dikirim pada H-N sesuai jadwal pengingat di atas."
                        value={data.wa_template_reminder_upcoming}
                        onChange={(v) =>
                            setData('wa_template_reminder_upcoming', v)
                        }
                        placeholders={PLACEHOLDERS.reminder}
                        defaultTemplate={DEFAULT_TEMPLATES.reminder_upcoming}
                        sample={sample}
                        error={errors.wa_template_reminder_upcoming}
                    />
                    <Divider />
                    <WaTemplateField
                        id="wa_template_reminder"
                        label="Pengingat terlambat"
                        description="Dikirim berulang setelah lewat jatuh tempo."
                        value={data.wa_template_reminder}
                        onChange={(v) => setData('wa_template_reminder', v)}
                        placeholders={PLACEHOLDERS.reminder}
                        defaultTemplate={DEFAULT_TEMPLATES.reminder}
                        sample={sample}
                        error={errors.wa_template_reminder}
                    />
                </SettingsSection>

                {/* Bar simpan */}
                <div
                    className={cn(
                        // Mobile: tepat di atas bottom nav.
                        'sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 md:bottom-0',
                    )}
                >
                    <p
                        className="text-xs text-muted-foreground"
                        aria-live="polite"
                    >
                        {form.recentlySuccessful
                            ? 'Tersimpan.'
                            : form.isDirty
                              ? 'Ada perubahan yang belum disimpan.'
                              : 'Semua perubahan tersimpan.'}
                    </p>
                    <Button
                        type="submit"
                        disabled={form.processing || !prefixValid || !daysValid}
                    >
                        {form.processing ? <Spinner /> : <Save />}
                        {form.processing ? 'Menyimpan…' : 'Simpan pengaturan'}
                    </Button>
                </div>
            </form>
        </>
    );
}

function Divider() {
    return <div className="border-t" role="separator" />;
}
