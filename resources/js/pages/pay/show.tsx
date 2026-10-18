import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    Ban,
    CheckCircle2,
    FileClock,
    QrCode,
    ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBadge } from '@/components/invoice-status-badge';
import { BankTransferCard } from '@/components/pay/bank-transfer-card';
import { CompanyHeader } from '@/components/pay/company-header';
import { InstallmentList } from '@/components/pay/installment-list';
import { InvoiceDetails } from '@/components/pay/invoice-details';
import { PaymentSuccessDialog } from '@/components/pay/payment-success-dialog';
import { QrisPanel } from '@/components/pay/qris-panel';
import type {
    PayCompany,
    PayInvoice,
    QrResult,
    SuccessInfo,
} from '@/components/pay/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
    daysFromToday,
    dueLabel,
    formatDate,
    formatDateTime,
    formatIDR,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const PAYABLE_STATUSES = ['sent', 'partial', 'overdue'];

function xsrfToken(): string {
    const raw =
        (
            document.cookie
                .split('; ')
                .find((c) => c.startsWith('XSRF-TOKEN=')) ?? ''
        ).split('=')[1] ?? '';

    return decodeURIComponent(raw);
}

export default function PayShow({
    invoice,
    company,
    isTesting,
}: {
    invoice: PayInvoice;
    company: PayCompany;
    isTesting: boolean;
}) {
    /** Cicilan yang sedang diminta QR-nya (0 = bayar penuh) — untuk state loading tombol. */
    const [payingScheduleId, setPayingScheduleId] = useState<number | null>(
        null,
    );
    const [qr, setQr] = useState<QrResult | null>(null);
    /** Cicilan milik QR yang sedang tampil (null = bayar sisa tagihan). */
    const [qrScheduleId, setQrScheduleId] = useState<number | null>(null);
    const [payError, setPayError] = useState<string | null>(null);
    const [simulating, setSimulating] = useState(false);
    const [countdown, setCountdown] = useState<number>(0);
    const [success, setSuccess] = useState<SuccessInfo | null>(null);
    const simulateFired = useRef<string | null>(null);
    // Setelah user menutup modal sukses, jangan auto-show lagi saat reload selesai.
    const successDismissed = useRef<boolean>(false);

    const token = invoice.public_token;
    const total = toNumber(invoice.total);
    const paidAmount = toNumber(invoice.paid_amount);
    const remaining = Math.max(0, total - paidAmount);
    const isCancelled = invoice.status === 'cancelled';
    const isDraft = invoice.status === 'draft';
    const isFullyPaid = !isCancelled && remaining <= 0;
    const canPay = PAYABLE_STATUSES.includes(invoice.status) && remaining > 0;
    const isInstallment =
        invoice.type === 'installment' && invoice.schedules.length > 0;
    const paidOnLoad = useRef<boolean>(isFullyPaid);

    const scheduleById = useMemo(
        () => new Map(invoice.schedules.map((s) => [s.id, s])),
        [invoice.schedules],
    );
    const qrSchedule = qrScheduleId
        ? scheduleById.get(qrScheduleId)
        : undefined;
    const qrAmount = qrSchedule ? toNumber(qrSchedule.amount) : remaining;

    const closeSuccessAndReload = () => {
        successDismissed.current = true;
        setSuccess(null);
        router.reload({ only: ['invoice'] });
    };

    const handlePay = async (scheduleId?: number) => {
        setPayingScheduleId(scheduleId ?? 0);
        setPayError(null);
        setQr(null);
        simulateFired.current = null;

        const url = `/pay/${encodeURIComponent(token)}/pay${scheduleId ? `?schedule_id=${scheduleId}` : ''}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
            });
            const data = (await res
                .json()
                .catch(() => ({}))) as Partial<QrResult> & { error?: string };

            if (!res.ok || !data.qris_string) {
                setPayError(
                    data.error ?? 'Gagal membuat QRIS. Silakan coba lagi.',
                );

                // 422 = invoice dibatalkan / lunas / draft — segarkan tampilan.
                if (res.status === 422) {
                    router.reload({ only: ['invoice'] });
                }

                return;
            }

            setQr(data as QrResult);
            setQrScheduleId(scheduleId ?? null);

            if (isTesting) {
                setCountdown(30);
            }
        } catch {
            setPayError(
                'Gagal menghubungi server. Periksa koneksi internet Anda.',
            );
        } finally {
            setPayingScheduleId(null);
        }
    };

    const simulatePayment = useCallback(async () => {
        if (simulateFired.current === 'done') {
            return;
        }

        simulateFired.current = 'done';
        setSimulating(true);
        setPayError(null);

        // Capture nominal SEBELUM state berubah supaya modal sukses akurat.
        const amountJustPaid = qrAmount;
        const scheduleSeq = qrSchedule?.sequence;

        try {
            const res = await fetch(
                `/pay/${encodeURIComponent(token)}/simulate`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': xsrfToken(),
                    },
                },
            );
            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
            };

            if (!res.ok) {
                simulateFired.current = null; // izinkan retry manual setelah gagal
                setPayError(data.error ?? 'Gagal konfirmasi pembayaran.');

                return;
            }

            const newPaid = paidAmount + amountJustPaid;
            const newRemaining = Math.max(0, total - newPaid);
            setSuccess({
                amount: amountJustPaid,
                newPaid,
                newRemaining,
                total,
                invoiceNumber: invoice.invoice_number,
                scheduleSequence: scheduleSeq,
                fullyPaid: newRemaining <= 0,
            });
            setQr(null);
        } catch {
            simulateFired.current = null;
            setPayError('Gagal menghubungi server.');
        } finally {
            setSimulating(false);
        }
    }, [
        token,
        qrAmount,
        qrSchedule?.sequence,
        paidAmount,
        total,
        invoice.invoice_number,
    ]);

    // Mode testing: saat QRIS muncul, hitung mundur sebelum cek konfirmasi.
    useEffect(() => {
        if (!isTesting || !qr) {
            return;
        }

        const id = window.setInterval(() => {
            setCountdown((c) => (c > 0 ? c - 1 : 0));
        }, 1000);

        return () => window.clearInterval(id);
    }, [qr, isTesting]);

    // Auto-cek konfirmasi saat countdown habis (di luar updater supaya reliable).
    useEffect(() => {
        if (
            isTesting &&
            qr &&
            countdown === 0 &&
            simulateFired.current !== 'done'
        ) {
            void simulatePayment();
        }
    }, [countdown, isTesting, qr, simulatePayment]);

    // Nilai terbaru untuk polling tanpa me-restart interval tiap render.
    const pollCtx = useRef({
        status: invoice.status,
        paidAmount,
        qrShown: false,
        qrSeq: undefined as number | undefined,
    });
    useEffect(() => {
        pollCtx.current = {
            status: invoice.status,
            paidAmount,
            qrShown: qr !== null,
            qrSeq: qrSchedule?.sequence,
        };
    }, [invoice.status, paidAmount, qr, qrSchedule?.sequence]);

    // Poll status: webhook QRIS menandai lunas → tampilkan sukses & reload.
    useEffect(() => {
        if (!canPay) {
            return;
        }

        let stopped = false;
        const id = window.setInterval(async () => {
            try {
                const res = await fetch(
                    `/pay/${encodeURIComponent(token)}/status`,
                    {
                        headers: { Accept: 'application/json' },
                    },
                );
                const data = (await res.json()) as {
                    status?: string;
                    paid?: boolean;
                    paid_amount?: number;
                };

                if (stopped) {
                    return;
                }

                const ctx = pollCtx.current;
                const newPaid = toNumber(data.paid_amount);
                const paidIncreased =
                    data.paid_amount !== undefined &&
                    newPaid > ctx.paidAmount + 0.009;
                const statusChanged =
                    !!data.status && data.status !== ctx.status;

                if (data.paid || statusChanged || paidIncreased) {
                    window.clearInterval(id);

                    if (paidIncreased && ctx.qrShown) {
                        const newRemaining = Math.max(0, total - newPaid);
                        setSuccess({
                            amount: newPaid - ctx.paidAmount,
                            newPaid,
                            newRemaining,
                            total,
                            invoiceNumber: invoice.invoice_number,
                            scheduleSequence: ctx.qrSeq,
                            fullyPaid: newRemaining <= 0,
                        });
                        setQr(null);
                    }

                    router.reload({ only: ['invoice'] });
                }
            } catch {
                /* transien — lanjut poll */
            }
        }, 4000);

        return () => {
            stopped = true;
            window.clearInterval(id);
        };
        // status/paidAmount di deps: setelah reload (mis. cicilan terbayar) polling dimulai ulang.
    }, [
        canPay,
        token,
        total,
        invoice.invoice_number,
        invoice.status,
        paidAmount,
    ]);

    // Invoice berubah jadi lunas selama halaman terbuka (mis. webhook) → modal sukses
    // sekali. Invoice yang sudah lunas sejak awal cukup tampil sebagai status lunas.
    useEffect(() => {
        if (
            isFullyPaid &&
            !paidOnLoad.current &&
            !success &&
            !successDismissed.current
        ) {
            setSuccess({
                amount: total,
                newPaid: total,
                newRemaining: 0,
                total,
                invoiceNumber: invoice.invoice_number,
                fullyPaid: true,
            });
        }
    }, [isFullyPaid, success, total, invoice.invoice_number]);

    const dueDiff = daysFromToday(invoice.due_date);
    const isLate = canPay && dueDiff !== null && dueDiff < 0;
    const progress =
        total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;
    const successfulPayments = invoice.payments.filter(
        (p) => p.status === 'success',
    );

    return (
        <>
            <Head title={`Pembayaran ${invoice.invoice_number}`} />
            <div className="min-h-screen bg-muted/40 dark:bg-background">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <CompanyHeader company={company} />
                    </div>

                    {isDraft && (
                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-dashed bg-card p-4 text-sm">
                            <FileClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <p>
                                <span className="font-medium">
                                    Pratinjau draft.
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    Invoice ini belum diterbitkan sehingga belum
                                    bisa dibayar oleh klien.
                                </span>
                            </p>
                        </div>
                    )}

                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                        {/* Kolom pembayaran — tampil pertama di HP */}
                        <aside className="space-y-4 lg:sticky lg:top-6 lg:order-last">
                            <Card className="gap-0 overflow-hidden py-0">
                                <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
                                    <span className="truncate text-sm font-medium">
                                        {invoice.invoice_number}
                                    </span>
                                    <StatusBadge status={invoice.status} />
                                </div>

                                <div className="p-5">
                                    {isCancelled ? (
                                        <div className="text-center">
                                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                                                <Ban className="size-6" />
                                            </span>
                                            <h1 className="mt-3 text-lg font-semibold">
                                                Invoice dibatalkan
                                            </h1>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Invoice ini sudah dibatalkan
                                                {invoice.cancelled_at
                                                    ? ` pada ${formatDate(invoice.cancelled_at)}`
                                                    : ''}{' '}
                                                dan tidak perlu dibayar.
                                            </p>
                                            {invoice.cancel_reason && (
                                                <p className="mt-3 rounded-lg bg-muted p-3 text-left text-sm">
                                                    <span className="block text-xs text-muted-foreground">
                                                        Alasan
                                                    </span>
                                                    {invoice.cancel_reason}
                                                </p>
                                            )}
                                            <p className="mt-3 text-xs text-muted-foreground">
                                                Ada pertanyaan? Hubungi{' '}
                                                {company.company_name ||
                                                    'penerbit invoice'}
                                                .
                                            </p>
                                        </div>
                                    ) : isFullyPaid ? (
                                        <div className="text-center">
                                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                                <CheckCircle2 className="size-6" />
                                            </span>
                                            <h1 className="mt-3 text-lg font-semibold">
                                                Invoice lunas
                                            </h1>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Terima kasih! Pembayaran sebesar{' '}
                                                <span className="font-medium text-foreground tabular-nums">
                                                    {formatIDR(total)}
                                                </span>{' '}
                                                sudah kami terima.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <h1 className="text-sm text-muted-foreground">
                                                {paidAmount > 0
                                                    ? 'Sisa tagihan'
                                                    : 'Total tagihan'}
                                            </h1>
                                            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                                                {formatIDR(remaining)}
                                            </p>
                                            {invoice.due_date && (
                                                <p
                                                    className={cn(
                                                        'mt-1 text-sm',
                                                        isLate
                                                            ? 'font-medium text-red-600 dark:text-red-400'
                                                            : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {canPay
                                                        ? dueLabel(
                                                              invoice.due_date,
                                                          )
                                                        : 'Jatuh tempo'}{' '}
                                                    ·{' '}
                                                    {formatDate(
                                                        invoice.due_date,
                                                    )}
                                                </p>
                                            )}

                                            {paidAmount > 0 && (
                                                <div className="mt-4">
                                                    <div
                                                        className="h-2 overflow-hidden rounded-full bg-muted"
                                                        role="progressbar"
                                                        aria-valuenow={progress}
                                                        aria-valuemin={0}
                                                        aria-valuemax={100}
                                                        aria-label="Progres pembayaran"
                                                    >
                                                        <div
                                                            className="h-full rounded-full bg-emerald-500"
                                                            style={{
                                                                width: `${progress}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <p className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                                                        <span>
                                                            Dibayar{' '}
                                                            {formatIDR(
                                                                paidAmount,
                                                            )}
                                                        </span>
                                                        <span>
                                                            dari{' '}
                                                            {formatIDR(total)}
                                                        </span>
                                                    </p>
                                                </div>
                                            )}

                                            {isInstallment ? (
                                                <div className="mt-5">
                                                    <InstallmentList
                                                        schedules={
                                                            invoice.schedules
                                                        }
                                                        canPay={canPay}
                                                        payingScheduleId={
                                                            payingScheduleId
                                                        }
                                                        activeScheduleId={
                                                            qr
                                                                ? qrScheduleId
                                                                : null
                                                        }
                                                        onPay={(id) =>
                                                            void handlePay(id)
                                                        }
                                                    />
                                                </div>
                                            ) : (
                                                canPay &&
                                                !qr && (
                                                    <Button
                                                        type="button"
                                                        size="lg"
                                                        className="mt-5 h-12 w-full text-base"
                                                        onClick={() =>
                                                            void handlePay()
                                                        }
                                                        disabled={
                                                            payingScheduleId !==
                                                            null
                                                        }
                                                    >
                                                        {payingScheduleId !==
                                                        null ? (
                                                            <Spinner />
                                                        ) : (
                                                            <QrCode />
                                                        )}
                                                        {payingScheduleId !==
                                                        null
                                                            ? 'Membuat QRIS…'
                                                            : 'Bayar dengan QRIS'}
                                                    </Button>
                                                )
                                            )}
                                        </>
                                    )}
                                </div>
                            </Card>

                            {payError && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                >
                                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                    <span>{payError}</span>
                                </div>
                            )}

                            {qr && canPay && (
                                <QrisPanel
                                    qr={qr}
                                    amount={qrAmount}
                                    label={
                                        qrSchedule
                                            ? `Cicilan ke-${qrSchedule.sequence}`
                                            : `Invoice ${invoice.invoice_number}`
                                    }
                                    invoiceNumber={invoice.invoice_number}
                                    isTesting={isTesting}
                                    countdown={countdown}
                                    simulating={simulating}
                                    regenerating={payingScheduleId !== null}
                                    onSimulate={() => void simulatePayment()}
                                    onRegenerate={() =>
                                        void handlePay(
                                            qrScheduleId ?? undefined,
                                        )
                                    }
                                    onClose={() => setQr(null)}
                                />
                            )}

                            {canPay && company.bank_account_info && (
                                <BankTransferCard
                                    info={company.bank_account_info}
                                    phone={company.company_phone}
                                />
                            )}

                            {canPay && (
                                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                                    <ShieldCheck className="size-3.5" />{' '}
                                    Pembayaran QRIS diproses aman oleh payment
                                    gateway.
                                </p>
                            )}
                        </aside>

                        {/* Detail invoice */}
                        <main className="min-w-0 space-y-6">
                            <InvoiceDetails
                                invoice={invoice}
                                company={company}
                            />

                            {successfulPayments.length > 0 && (
                                <Card className="gap-0 py-0">
                                    <h2 className="border-b px-5 py-3 text-sm font-semibold sm:px-6">
                                        Riwayat pembayaran
                                    </h2>
                                    <ul className="divide-y">
                                        {successfulPayments.map((p) => {
                                            const seq = p.schedule_id
                                                ? scheduleById.get(
                                                      p.schedule_id,
                                                  )?.sequence
                                                : undefined;

                                            return (
                                                <li
                                                    key={p.id}
                                                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-medium">
                                                            {p.method === 'qris'
                                                                ? 'QRIS'
                                                                : 'Transfer / manual'}
                                                            {seq
                                                                ? ` · Cicilan ke-${seq}`
                                                                : ''}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDateTime(
                                                                p.paid_at ??
                                                                    p.created_at,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium tabular-nums">
                                                            {formatIDR(
                                                                p.amount,
                                                            )}
                                                        </span>
                                                        <CheckCircle2
                                                            className="size-4 text-emerald-600 dark:text-emerald-400"
                                                            aria-label="Berhasil"
                                                        />
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </Card>
                            )}
                        </main>
                    </div>

                    <footer className="mt-10 space-y-2 text-center text-xs text-muted-foreground">
                        {company.invoice_footer_text && (
                            <p className="whitespace-pre-line">
                                {company.invoice_footer_text}
                            </p>
                        )}
                        <p>
                            {company.company_name || 'Invoice'} ·{' '}
                            {invoice.invoice_number}
                        </p>
                    </footer>
                </div>
            </div>

            <PaymentSuccessDialog
                success={success}
                onClose={closeSuccessAndReload}
            />
        </>
    );
}
