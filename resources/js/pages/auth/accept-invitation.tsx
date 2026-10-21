import { Form, Head } from '@inertiajs/react';
import { Building2, Clock } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/invitation';

type Props = {
    email: string;
    token: string;
    name: string | null;
    businessName: string;
    expired: boolean;
    message: string | null;
    passwordRules: string;
};

export default function AcceptInvitation({
    email,
    token,
    name,
    businessName,
    expired,
    message,
    passwordRules,
}: Props) {
    return (
        <>
            <Head title="Terima undangan" />

            <div className="mb-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                <Building2
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
                <div className="min-w-0">
                    <div className="font-medium break-words">
                        {businessName}
                    </div>
                    <div className="text-muted-foreground">
                        {name
                            ? `Halo ${name}, buat password untuk mulai memakai eTagih.`
                            : 'Undangan bergabung ke tim di eTagih.'}
                    </div>
                </div>
            </div>

            {expired ? (
                <div className="grid gap-6">
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <p>
                            {message ??
                                'Undangan sudah kedaluwarsa. Minta admin mengirim ulang undangan.'}
                        </p>
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                        Sudah punya password?{' '}
                        <TextLink href={login()}>Masuk</TextLink>
                    </div>
                </div>
            ) : (
                <Form
                    {...store.form()}
                    transform={(data) => ({ ...data, token, email })}
                    resetOnSuccess={['password', 'password_confirmation']}
                >
                    {({ processing, errors }) => (
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="username"
                                    value={email}
                                    className="mt-1 block w-full"
                                    readOnly
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    autoComplete="new-password"
                                    className="mt-1 block w-full"
                                    autoFocus
                                    placeholder="Password"
                                    passwordrules={passwordRules}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Ulangi password
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    autoComplete="new-password"
                                    className="mt-1 block w-full"
                                    placeholder="Ulangi password"
                                    passwordrules={passwordRules}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="mt-2 w-full"
                                disabled={processing}
                                data-test="accept-invitation-button"
                            >
                                {processing && <Spinner />}
                                Buat password & masuk
                            </Button>
                        </div>
                    )}
                </Form>
            )}
        </>
    );
}

AcceptInvitation.layout = {
    title: 'Terima undangan',
    description: 'Buat password untuk akun Anda',
};
