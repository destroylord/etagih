import { Form, Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CreditCard,
    FileText,
    KeyRound,
    ShieldCheck,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { dashboard, login } from '@/routes';

const appName = import.meta.env.VITE_APP_NAME || 'eTagih';

const FEATURES = [
    { icon: FileText, text: 'Lihat semua invoice & rinciannya' },
    { icon: CreditCard, text: 'Bayar online lewat QRIS' },
    { icon: ShieldCheck, text: 'Akses aman dengan kunci pribadi' },
];

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Portal Klien" />
            <div className="relative flex min-h-dvh flex-col overflow-hidden bg-muted/40 text-foreground">
                {/* Latar dekoratif */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/10 to-transparent"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute top-[-10rem] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
                />

                <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-5 fill-current" />
                        </span>
                        <span className="font-semibold tracking-tight">
                            {appName}
                        </span>
                    </div>
                    {auth.user ? (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={dashboard()}>Dashboard</Link>
                        </Button>
                    ) : (
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={login()}>Login admin</Link>
                        </Button>
                    )}
                </header>

                <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
                    <div className="w-full max-w-md">
                        <div className="mb-8 text-center">
                            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-background text-primary shadow-sm ring-1 ring-border">
                                <KeyRound className="size-6" />
                            </span>
                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                Portal Klien
                            </h1>
                            <p className="mt-2 text-sm text-balance text-muted-foreground">
                                Masuk dengan kunci akses dari kami untuk melihat
                                invoice, status pembayaran, dan membayar tagihan
                                secara online.
                            </p>
                        </div>

                        <Card className="shadow-lg shadow-primary/5">
                            <CardContent>
                                <Form
                                    action="/client-portal"
                                    method="post"
                                    className="grid gap-4"
                                    resetOnError
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="access_key">
                                                    Kunci akses
                                                </Label>
                                                <Input
                                                    id="access_key"
                                                    name="access_key"
                                                    required
                                                    autoFocus
                                                    autoComplete="off"
                                                    autoCapitalize="none"
                                                    spellCheck={false}
                                                    placeholder="Tempel kunci akses Anda"
                                                    className="h-11 font-mono tracking-wide"
                                                    aria-invalid={
                                                        !!errors.access_key ||
                                                        undefined
                                                    }
                                                    aria-describedby="access_key-help"
                                                />
                                                <InputError
                                                    message={errors.access_key}
                                                />
                                                <p
                                                    id="access_key-help"
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    Kunci berupa 24 karakter
                                                    huruf & angka yang dikirim
                                                    oleh admin.
                                                </p>
                                            </div>
                                            <Button
                                                type="submit"
                                                size="lg"
                                                className="w-full"
                                                disabled={processing}
                                            >
                                                {processing ? (
                                                    <Spinner />
                                                ) : null}
                                                {processing
                                                    ? 'Memeriksa kunci…'
                                                    : 'Buka portal'}
                                                {!processing && <ArrowRight />}
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            </CardContent>
                        </Card>

                        <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-3">
                            {FEATURES.map(({ icon: Icon, text }) => (
                                <li
                                    key={text}
                                    className="flex items-center gap-2 sm:flex-col sm:text-center"
                                >
                                    <Icon
                                        className="size-4 shrink-0 text-primary"
                                        aria-hidden
                                    />
                                    <span className="text-xs">{text}</span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-8 text-center text-xs text-muted-foreground">
                            Belum punya kunci atau kunci tidak berfungsi?
                            Hubungi kami untuk meminta kunci akses baru.
                        </p>
                    </div>
                </main>

                <footer className="relative z-10 py-4 text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} {appName}
                </footer>
            </div>
        </>
    );
}
