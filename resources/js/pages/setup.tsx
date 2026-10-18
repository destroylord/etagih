import { Head, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    Check,
    UserRound,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
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
import { cn } from '@/lib/utils';

type Props = {
    requiresToken: boolean;
    token: string;
    appVersion: string;
    defaults: {
        company_name: string;
        company_email: string;
        company_phone: string;
        app_invoice_prefix: string;
        default_tax_rate: number;
    };
};

const ACCOUNT_FIELDS = [
    'token',
    'name',
    'email',
    'password',
    'password_confirmation',
] as const;

const STEPS = [
    { title: 'Akun pemilik', icon: UserRound },
    { title: 'Profil bisnis', icon: Building2 },
] as const;

export default function Setup({
    requiresToken,
    token,
    appVersion,
    defaults,
}: Props) {
    const [step, setStep] = useState<1 | 2>(1);
    const form = useForm({
        token,
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        company_name: defaults.company_name,
        company_email: defaults.company_email,
        company_phone: defaults.company_phone,
        app_invoice_prefix: defaults.app_invoice_prefix,
        default_tax_rate: String(defaults.default_tax_rate ?? 0),
    });
    const { data, setData, errors } = form;

    // Validasi ringan di browser sebelum pindah ke langkah 2.
    const goNext = (e: FormEvent) => {
        e.preventDefault();
        form.clearErrors();
        const local: Partial<Record<(typeof ACCOUNT_FIELDS)[number], string>> =
            {};

        if (requiresToken && !data.token.trim()) {
            local.token = 'Token setup wajib diisi.';
        }

        if (!data.name.trim()) {
            local.name = 'Nama wajib diisi.';
        }

        if (!/^\S+@\S+\.\S+$/.test(data.email)) {
            local.email = 'Email tidak valid.';
        }

        if (data.password.length < 8) {
            local.password = 'Password minimal 8 karakter.';
        }

        if (data.password !== data.password_confirmation) {
            local.password_confirmation = 'Konfirmasi password tidak sama.';
        }

        if (Object.keys(local).length > 0) {
            form.setError(local);

            return;
        }

        setStep(2);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/setup', {
            preserveScroll: true,
            onError: (errs) => {
                if (ACCOUNT_FIELDS.some((f) => f in errs)) {
                    setStep(1);
                }
            },
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    };

    return (
        <>
            <Head title="Instalasi" />

            <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-6 md:p-10">
                <div className="w-full max-w-lg">
                    <div className="mb-8 flex flex-col items-center gap-3 text-center">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <AppLogoIcon className="size-7 fill-current" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Selamat datang di eTagih
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Dua langkah singkat untuk mulai menagih klien
                                Anda.
                            </p>
                        </div>
                    </div>

                    <ol className="mb-6 flex items-center gap-3">
                        {STEPS.map((s, i) => {
                            const n = (i + 1) as 1 | 2;
                            const done = step > n;
                            const active = step === n;

                            return (
                                <li
                                    key={s.title}
                                    className="flex flex-1 items-center gap-3"
                                >
                                    <span
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                                            active &&
                                                'border-primary bg-primary text-primary-foreground',
                                            done &&
                                                'border-primary text-primary',
                                            !active &&
                                                !done &&
                                                'text-muted-foreground',
                                        )}
                                    >
                                        {done ? (
                                            <Check className="size-4" />
                                        ) : (
                                            n
                                        )}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-sm font-medium',
                                            !active && 'text-muted-foreground',
                                        )}
                                    >
                                        {s.title}
                                    </span>
                                    {i < STEPS.length - 1 && (
                                        <span className="h-px flex-1 bg-border" />
                                    )}
                                </li>
                            );
                        })}
                    </ol>

                    <Card>
                        {step === 1 ? (
                            <form onSubmit={goNext} noValidate>
                                <CardHeader>
                                    <CardTitle>Akun pemilik</CardTitle>
                                    <CardDescription>
                                        Akun ini memiliki akses penuh. Anda bisa
                                        menambah admin & staf nanti.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="mt-6 grid gap-5">
                                    {requiresToken && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="token">
                                                Token setup
                                            </Label>
                                            <Input
                                                id="token"
                                                value={data.token}
                                                onChange={(e) =>
                                                    setData(
                                                        'token',
                                                        e.target.value,
                                                    )
                                                }
                                                autoComplete="off"
                                                placeholder="Nilai SETUP_TOKEN di .env server"
                                            />
                                            <InputError
                                                message={errors.token}
                                            />
                                        </div>
                                    )}
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nama</Label>
                                        <Input
                                            id="name"
                                            value={data.name}
                                            onChange={(e) =>
                                                setData('name', e.target.value)
                                            }
                                            autoFocus
                                            autoComplete="name"
                                            placeholder="Nama lengkap"
                                        />
                                        <InputError message={errors.name} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">
                                            Email login
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={data.email}
                                            onChange={(e) =>
                                                setData('email', e.target.value)
                                            }
                                            autoComplete="email"
                                            placeholder="anda@bisnis.com"
                                        />
                                        <InputError message={errors.email} />
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="password">
                                                Password
                                            </Label>
                                            <PasswordInput
                                                id="password"
                                                value={data.password}
                                                onChange={(e) =>
                                                    setData(
                                                        'password',
                                                        e.target.value,
                                                    )
                                                }
                                                autoComplete="new-password"
                                                placeholder="Min. 8 karakter"
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="password_confirmation">
                                                Ulangi password
                                            </Label>
                                            <PasswordInput
                                                id="password_confirmation"
                                                value={
                                                    data.password_confirmation
                                                }
                                                onChange={(e) =>
                                                    setData(
                                                        'password_confirmation',
                                                        e.target.value,
                                                    )
                                                }
                                                autoComplete="new-password"
                                            />
                                            <InputError
                                                message={
                                                    errors.password_confirmation
                                                }
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full">
                                        Lanjut
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </CardContent>
                            </form>
                        ) : (
                            <form onSubmit={submit} noValidate>
                                <CardHeader>
                                    <CardTitle>Profil bisnis</CardTitle>
                                    <CardDescription>
                                        Tampil di invoice, email, dan pesan
                                        WhatsApp. Logo, rekening, dan QRIS bisa
                                        diatur setelah ini.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="mt-6 grid gap-5">
                                    <div className="grid gap-2">
                                        <Label htmlFor="company_name">
                                            Nama bisnis
                                        </Label>
                                        <Input
                                            id="company_name"
                                            value={data.company_name}
                                            onChange={(e) =>
                                                setData(
                                                    'company_name',
                                                    e.target.value,
                                                )
                                            }
                                            autoFocus
                                            placeholder="CV Contoh Kreatif"
                                        />
                                        <InputError
                                            message={errors.company_name}
                                        />
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="company_email">
                                                Email bisnis{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    (opsional)
                                                </span>
                                            </Label>
                                            <Input
                                                id="company_email"
                                                type="email"
                                                value={data.company_email}
                                                onChange={(e) =>
                                                    setData(
                                                        'company_email',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="billing@bisnis.com"
                                            />
                                            <InputError
                                                message={errors.company_email}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="company_phone">
                                                Telepon / WA{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    (opsional)
                                                </span>
                                            </Label>
                                            <Input
                                                id="company_phone"
                                                value={data.company_phone}
                                                onChange={(e) =>
                                                    setData(
                                                        'company_phone',
                                                        e.target.value,
                                                    )
                                                }
                                                inputMode="tel"
                                                placeholder="0812xxxxxxx"
                                            />
                                            <InputError
                                                message={errors.company_phone}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="app_invoice_prefix">
                                                Prefix nomor invoice
                                            </Label>
                                            <Input
                                                id="app_invoice_prefix"
                                                value={data.app_invoice_prefix}
                                                onChange={(e) =>
                                                    setData(
                                                        'app_invoice_prefix',
                                                        e.target.value.toUpperCase(),
                                                    )
                                                }
                                                maxLength={20}
                                                placeholder="INV"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Contoh:{' '}
                                                {data.app_invoice_prefix ||
                                                    'INV'}
                                                -… pada nomor invoice.
                                            </p>
                                            <InputError
                                                message={
                                                    errors.app_invoice_prefix
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="default_tax_rate">
                                                PPN default (%)
                                            </Label>
                                            <Input
                                                id="default_tax_rate"
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.01"
                                                value={data.default_tax_rate}
                                                onChange={(e) =>
                                                    setData(
                                                        'default_tax_rate',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Isi 0 bila tidak memungut PPN,
                                                atau 11 / 12.
                                            </p>
                                            <InputError
                                                message={
                                                    errors.default_tax_rate
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setStep(1)}
                                            disabled={form.processing}
                                        >
                                            <ArrowLeft className="size-4" />
                                            Kembali
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1"
                                            disabled={form.processing}
                                        >
                                            {form.processing && <Spinner />}
                                            Selesai & masuk
                                        </Button>
                                    </div>
                                </CardContent>
                            </form>
                        )}
                    </Card>

                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        eTagih {appVersion} · Halaman ini hanya muncul sekali,
                        sebelum akun pertama dibuat.
                    </p>
                </div>
            </div>
        </>
    );
}
