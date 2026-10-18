import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    ExternalLink,
    Info,
    Mail,
    MessageCircle,
    RefreshCw,
    XCircle,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type CheckStatus = 'ok' | 'warning' | 'error' | 'info';

type Check = {
    key: string;
    group: string;
    label: string;
    status: CheckStatus;
    value: string;
    message: string;
    fix: string | null;
    docs: string | null;
};

type UpdateInfo = {
    status: 'disabled' | 'unknown' | 'up_to_date' | 'available';
    current: string;
    latest: string | null;
    url: string | null;
    published_at: string | null;
    checked_at: string | null;
    error: string | null;
};

type Props = {
    checks: Check[];
    update: UpdateInfo;
    docsUrl: string;
    userEmail: string | null;
    database: string;
};

const STATUS_META: Record<
    CheckStatus,
    { icon: typeof CheckCircle2; className: string; label: string }
> = {
    ok: {
        icon: CheckCircle2,
        className: 'text-emerald-600 dark:text-emerald-400',
        label: 'OK',
    },
    warning: {
        icon: AlertTriangle,
        className: 'text-amber-600 dark:text-amber-400',
        label: 'Perlu dicek',
    },
    error: {
        icon: XCircle,
        className: 'text-red-600 dark:text-red-400',
        label: 'Bermasalah',
    },
    info: {
        icon: Info,
        className: 'text-muted-foreground',
        label: 'Info',
    },
};

export default function SystemStatusPage({
    checks,
    update,
    docsUrl,
    userEmail,
    database,
}: Props) {
    const groups = checks.reduce<Record<string, Check[]>>((acc, c) => {
        (acc[c.group] ??= []).push(c);

        return acc;
    }, {});
    const count = (s: CheckStatus) =>
        checks.filter((c) => c.status === s).length;
    const errors = count('error');
    const warnings = count('warning');

    return (
        <>
            <Head title="Status sistem" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Status sistem"
                    description="Pemeriksaan instalasi, uji pengiriman, dan backup data."
                />

                <UpdateCard update={update} />

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge
                        variant="outline"
                        className={cn(
                            errors > 0
                                ? 'border-red-300 text-red-700 dark:text-red-400'
                                : warnings > 0
                                  ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                                  : 'border-emerald-300 text-emerald-700 dark:text-emerald-400',
                        )}
                    >
                        {errors > 0
                            ? `${errors} bermasalah`
                            : warnings > 0
                              ? `${warnings} perlu dicek`
                              : 'Semua baik'}
                    </Badge>
                    <span className="text-muted-foreground">
                        {count('ok')} dari {checks.length} pemeriksaan OK.
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() =>
                            router.reload({ only: ['checks', 'update'] })
                        }
                    >
                        <RefreshCw className="size-4" />
                        Periksa ulang
                    </Button>
                </div>

                {Object.entries(groups).map(([group, items]) => (
                    <Card key={group} className="gap-0 py-0">
                        <CardHeader className="border-b py-4">
                            <CardTitle className="text-sm">{group}</CardTitle>
                        </CardHeader>
                        <ul className="divide-y">
                            {items.map((c) => (
                                <CheckRow key={c.key} check={c} />
                            ))}
                        </ul>
                    </Card>
                ))}

                <div className="grid gap-6 lg:grid-cols-2">
                    <TestMailCard email={userEmail} />
                    <TestWhatsappCard />
                </div>

                <BackupCard database={database} docsUrl={docsUrl} />
            </div>
        </>
    );
}

function CheckRow({ check }: { check: Check }) {
    const meta = STATUS_META[check.status];
    const Icon = meta.icon;

    return (
        <li className="flex gap-3 px-6 py-4">
            <Icon
                className={cn('mt-0.5 size-5 shrink-0', meta.className)}
                aria-label={meta.label}
            />
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="font-mono text-xs break-all text-muted-foreground">
                        {check.value}
                    </p>
                </div>
                <p className="text-sm text-muted-foreground">{check.message}</p>
                {check.fix && check.status !== 'ok' && (
                    <p className="text-sm">
                        <span className="font-medium">Cara memperbaiki: </span>
                        {check.fix}
                    </p>
                )}
                {check.docs && check.status !== 'ok' && (
                    <a
                        href={check.docs}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                        Baca panduan
                        <ExternalLink className="size-3" />
                    </a>
                )}
            </div>
        </li>
    );
}

function UpdateCard({ update }: { update: UpdateInfo }) {
    const [checking, setChecking] = useState(false);
    const available = update.status === 'available';

    const recheck = () =>
        router.get(
            '/settings/system',
            { refresh: 1 },
            {
                preserveScroll: true,
                only: ['update', 'checks'],
                onStart: () => setChecking(true),
                onFinish: () => setChecking(false),
            },
        );

    return (
        <Card
            className={cn(
                available &&
                    'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5',
            )}
        >
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                    eTagih {update.current}
                    {available && (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                            Versi {update.latest} tersedia
                        </Badge>
                    )}
                    {update.status === 'up_to_date' && (
                        <Badge variant="secondary">Terbaru</Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    {update.status === 'disabled'
                        ? 'Cek update otomatis nonaktif.'
                        : update.status === 'unknown'
                          ? `Belum bisa memeriksa versi terbaru. ${update.error ?? ''}`
                          : update.checked_at
                            ? `Terakhir dicek ${formatDateTime(update.checked_at)}.`
                            : null}
                    {available &&
                        update.published_at &&
                        ` Dirilis ${formatDate(update.published_at)}.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                {update.url && (
                    <Button
                        variant={available ? 'default' : 'outline'}
                        size="sm"
                        asChild
                    >
                        <a href={update.url} target="_blank" rel="noreferrer">
                            Catatan rilis
                            <ExternalLink className="size-4" />
                        </a>
                    </Button>
                )}
                {update.status !== 'disabled' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={recheck}
                        disabled={checking}
                    >
                        {checking ? (
                            <Spinner />
                        ) : (
                            <RefreshCw className="size-4" />
                        )}
                        Cek sekarang
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function TestMailCard({ email }: { email: string | null }) {
    const [processing, setProcessing] = useState(false);

    const send = () =>
        router.post(
            '/settings/system/test-mail',
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="size-4" />
                    Uji email
                </CardTitle>
                <CardDescription>
                    Kirim email uji ke{' '}
                    <span className="font-medium text-foreground">
                        {email ?? 'akun Anda'}
                    </span>
                    .
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" onClick={send} disabled={processing}>
                    {processing && <Spinner />}
                    Kirim email uji
                </Button>
            </CardContent>
        </Card>
    );
}

function TestWhatsappCard() {
    const form = useForm({ phone: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/settings/system/test-whatsapp', { preserveScroll: true });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <MessageCircle className="size-4" />
                    Uji WhatsApp
                </CardTitle>
                <CardDescription>
                    Kirim pesan uji lewat Fonnte ke nomor berikut.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="grid gap-2">
                    <Label htmlFor="test-phone" className="sr-only">
                        Nomor WhatsApp
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="test-phone"
                            value={form.data.phone}
                            onChange={(e) =>
                                form.setData('phone', e.target.value)
                            }
                            inputMode="tel"
                            placeholder="0812xxxxxxx"
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={form.processing || !form.data.phone}
                        >
                            {form.processing && <Spinner />}
                            Kirim WA uji
                        </Button>
                    </div>
                    <InputError message={form.errors.phone} />
                </form>
            </CardContent>
        </Card>
    );
}

function BackupCard({
    database,
    docsUrl,
}: {
    database: string;
    docsUrl: string;
}) {
    const isSqlite = database === 'sqlite';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Download className="size-4" />
                    Backup data
                </CardTitle>
                <CardDescription>
                    Unduh arsip .zip berisi{' '}
                    {isSqlite ? 'salinan database SQLite' : 'database.sql'},
                    semua file upload (logo, tanda tangan, QRIS), dan README.txt
                    berisi cara restore. File .env tidak ikut — simpan terpisah
                    di tempat aman.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
                <Button asChild>
                    <a href="/settings/system/backup">
                        <Download className="size-4" />
                        Unduh backup
                    </a>
                </Button>
                <a
                    href={`${docsUrl}/penggunaan/operasional#backup--restore`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    Cara restore
                    <ExternalLink className="size-3" />
                </a>
            </CardContent>
        </Card>
    );
}

SystemStatusPage.layout = {
    breadcrumbs: [
        {
            title: 'Status sistem',
            href: '/settings/system',
        },
    ],
};
