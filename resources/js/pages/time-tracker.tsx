import { Head, Link, router } from '@inertiajs/react';
import {
    Clock,
    FilePlus2,
    Hourglass,
    ListChecks,
    RefreshCw,
    Timer,
    Wallet,
    WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { ActiveSessionCard } from '@/components/time-tracker/active-session-card';
import { SessionFilters } from '@/components/time-tracker/session-filters';
import {
    SessionsTable,
    sessionSubtotal,
} from '@/components/time-tracker/sessions-table';
import type { StartPayload } from '@/components/time-tracker/start-session-form';
import { StartSessionForm } from '@/components/time-tracker/start-session-form';
import { projectLabel } from '@/components/time-tracker/types';
import type {
    ActiveView,
    LocalActiveWithProject,
    TrackerClient,
    TrackerFilters,
    TrackerSession,
} from '@/components/time-tracker/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    formatDuration,
    formatIDR,
    formatNumber,
    toNumber,
} from '@/lib/format';
import type { QueueOp } from '@/lib/work-session-sync';
import {
    applyLocal,
    flushQueue,
    loadLocalActive,
    loadQueue,
    saveLocalActive,
    saveQueue,
} from '@/lib/work-session-sync';
import type { Paginated, ProjectOption } from '@/types/models';
import type { TimeTrackerTaskOption } from '@/types/tasks';

const SUCCESS_MESSAGE: Record<QueueOp['kind'], string> = {
    start: 'Stopwatch dimulai.',
    pause: 'Sesi dijeda.',
    resume: 'Sesi dilanjutkan.',
    stop: 'Sesi selesai dan siap ditagih.',
    cancel: 'Sesi dibatalkan.',
};

/** Payload start + project_id/task_id (ikut terserialisasi ke antrean localStorage). */
type StartQueuePayload = NonNullable<QueueOp['payload']> & {
    project_id: number | null;
    task_id: number | null;
};

function serverToLocal(a: TrackerSession): LocalActiveWithProject {
    return {
        localOnly: false,
        id: a.id,
        client_id: a.client_id,
        client_name: a.client?.name ?? '',
        project_id: a.project_id,
        project_name: projectLabel(a.project),
        task_id: a.task?.id ?? null,
        task_title: a.task?.title ?? null,
        description: a.description,
        unit_price: toNumber(a.unit_price),
        started_at: a.status === 'running' ? a.started_at : null,
        accumulated_seconds: a.duration_seconds ?? 0,
        status: a.status === 'paused' ? 'paused' : 'running',
    };
}

export default function TimeTracker({
    sessions,
    active,
    clients,
    projects = [],
    tasks = [],
    filters,
    defaultRate,
    totals,
}: {
    sessions: Paginated<TrackerSession>;
    active: TrackerSession | null;
    clients: TrackerClient[];
    projects?: ProjectOption[];
    /** Tugas terbuka (milik saya lebih dulu) untuk pilihan di form mulai. */
    tasks?: TimeTrackerTaskOption[];
    filters: TrackerFilters;
    defaultRate: number;
    totals?: {
        unbilledSeconds: number;
        unbilledAmount: number;
        unbilledCount: number;
        trackedSeconds: number;
    };
}) {
    const [busy, setBusy] = useState(false);

    // Offline / queue state.
    const [online, setOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    );
    const [queueLen, setQueueLen] = useState<number>(() =>
        typeof window !== 'undefined' ? loadQueue().length : 0,
    );
    const [localActive, setLocalActive] =
        useState<LocalActiveWithProject | null>(() =>
            typeof window !== 'undefined' ? loadLocalActive() : null,
        );
    const [syncMsg, setSyncMsg] = useState<string | null>(null);
    /** Stop/cancel sudah diantrikan tapi belum terkirim. */
    const [endPending, setEndPending] = useState<boolean>(() =>
        typeof window !== 'undefined'
            ? loadQueue().some(
                  (op) => op.kind === 'stop' || op.kind === 'cancel',
              )
            : false,
    );

    /** Snapshot optimistik selama reload pasca-sync (undefined = tidak dipakai). */
    const [bridge, setBridge] = useState<
        LocalActiveWithProject | null | undefined
    >(undefined);

    const pending = !online || queueLen > 0;

    // Sesi yang ditampilkan: mirror lokal kalau ada antrean, snapshot saat
    // menunggu reload, selain itu data server.
    const effectiveActive: ActiveView | null = useMemo(() => {
        const local = pending && localActive ? localActive : bridge;

        if (local !== undefined) {
            if (local === null) {
                return null;
            }

            return {
                id: local.id,
                clientName: local.client_name,
                project: local.project_id
                    ? {
                          id: local.project_id,
                          label: local.project_name ?? 'Proyek',
                      }
                    : null,
                description: local.description,
                unitPrice: local.unit_price,
                status: local.status,
                segmentStartedAt: local.started_at,
                accumulatedSeconds: local.accumulated_seconds,
                notes: null,
                task: local.task_id
                    ? { id: local.task_id, title: local.task_title ?? 'Task' }
                    : null,
                localOnly: local.localOnly,
            };
        }

        if (
            !active ||
            (active.status !== 'running' && active.status !== 'paused')
        ) {
            return null;
        }

        return {
            id: active.id,
            clientName: active.client?.name ?? '',
            project: active.project
                ? {
                      id: active.project.id,
                      label:
                          projectLabel(active.project) ?? active.project.name,
                  }
                : null,
            description: active.description,
            unitPrice: toNumber(active.unit_price),
            status: active.status,
            segmentStartedAt:
                active.status === 'running' ? active.started_at : null,
            accumulatedSeconds: active.duration_seconds ?? 0,
            notes: active.notes,
            task: active.task ?? null,
            localOnly: false,
        };
    }, [pending, localActive, bridge, active]);

    const doFlush = useCallback(async (kind?: QueueOp['kind']) => {
        setBusy(true);
        setSyncMsg(null);
        const snapshot = loadLocalActive();
        const endQueued = loadQueue().some(
            (op) => op.kind === 'stop' || op.kind === 'cancel',
        );

        try {
            const result = await flushQueue();
            setQueueLen(result.remaining);

            if (result.flushed > 0) {
                // Tahan tampilan optimistik sampai prop server baru tiba (hindari kedip).
                setBridge(endQueued ? null : snapshot);
                router.reload({
                    only: ['sessions', 'active'],
                    onFinish: () => setBridge(undefined),
                });
            }

            if (result.remaining === 0) {
                setEndPending(false);
            }

            setLocalActive(loadLocalActive());

            if (result.error) {
                setSyncMsg(result.error);

                // remaining 0 + error = konflik; server menang, tampilkan alasannya.
                if (result.remaining === 0) {
                    toast.error(result.error);

                    if (result.flushed === 0) {
                        router.reload({ only: ['sessions', 'active'] });
                    }
                }
            } else if (kind && result.remaining === 0 && result.flushed > 0) {
                toast.success(SUCCESS_MESSAGE[kind]);
            }
        } finally {
            setBusy(false);
        }
    }, []);

    // Auto-flush saat koneksi kembali + sinkron flag online.
    useEffect(() => {
        const goOnline = () => {
            setOnline(true);
            void doFlush();
        };
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, [doFlush]);

    /**
     * Semua mutasi lewat sini: tulis op ke queue + update mirror lokal
     * (optimistik), lalu coba flush langsung. Gagal → tetap di queue.
     */
    const mutate = useCallback(
        (
            kind: QueueOp['kind'],
            payload?: QueueOp['payload'],
            project?: {
                id: number | null;
                name: string | null;
                task?: { id: number; title: string } | null;
            },
        ) => {
            const full: QueueOp = {
                kind,
                at: new Date().toISOString(),
                payload,
            };
            const q = loadQueue();
            q.push(full);
            saveQueue(q);
            setQueueLen(q.length);

            // Sesi aktif dari server belum punya mirror lokal → seed dulu supaya
            // flush tahu id sesi yang dituju (pause/resume/stop/cancel).
            let current = loadLocalActive();

            if (
                !current &&
                kind !== 'start' &&
                active &&
                (active.status === 'running' || active.status === 'paused')
            ) {
                current = serverToLocal(active);
            }

            let next: LocalActiveWithProject | null = applyLocal(full, current);

            // applyLocal('start') tidak kenal proyek → tempelkan sendiri.
            if (next && kind === 'start' && project) {
                next = {
                    ...next,
                    project_id: project.id,
                    project_name: project.name,
                    task_id: project.task?.id ?? null,
                    task_title: project.task?.title ?? null,
                };
            }

            saveLocalActive(next);
            setLocalActive(next);

            if (kind === 'stop' || kind === 'cancel') {
                setEndPending(true);
            }

            void doFlush(kind);
        },
        [doFlush, active],
    );

    const startSession = (p: StartPayload) => {
        const payload: StartQueuePayload = {
            client_id: p.clientId,
            client_name: p.clientName,
            project_id: p.projectId,
            description: p.description,
            unit_price: p.unitPrice,
            notes: p.notes,
            task_id: p.task?.id ?? null,
        };
        mutate('start', payload, {
            id: p.projectId,
            name: p.projectName,
            task: p.task,
        });
    };

    const applyFilter = (patch: Partial<TrackerFilters>) => {
        router.get(
            '/time-tracker',
            { ...filters, ...patch },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilter = () => {
        router.get(
            '/time-tracker',
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    // Ringkasan sesuai filter dihitung server (seluruh halaman). Fallback ke
    // perhitungan dari halaman ini bila prop tidak ada.
    const pageSummary = useMemo(() => {
        let unbilledSeconds = 0;
        let unbilledAmount = 0;
        let unbilledCount = 0;
        let trackedSeconds = 0;

        for (const s of sessions.data) {
            if (s.status === 'completed' || s.status === 'billed') {
                trackedSeconds += s.duration_seconds ?? 0;
            }

            if (s.status === 'completed') {
                unbilledSeconds += s.duration_seconds ?? 0;
                unbilledAmount += sessionSubtotal(s);
                unbilledCount++;
            }
        }

        return {
            unbilledSeconds,
            unbilledAmount,
            unbilledCount,
            trackedSeconds,
        };
    }, [sessions.data]);

    const summary = totals ?? pageSummary;
    const scopeHint =
        totals || sessions.last_page <= 1
            ? 'Sesuai filter'
            : 'Dari sesi di halaman ini';
    const hasFilter = Object.values(filters).some((v) => v);

    const invoiceParams = new URLSearchParams({ mode: 'hourly' });

    if (filters.client_id) {
        invoiceParams.set('client_id', filters.client_id);
    }

    if (filters.project_id) {
        invoiceParams.set('project_id', filters.project_id);
    }

    const invoiceHref = `/invoices/create?${invoiceParams.toString()}`;

    return (
        <>
            <Head title="Time Tracker" />
            <PageContainer>
                <PageHeader
                    title="Time Tracker"
                    description="Catat jam kerja per client, jeda kapan saja, tetap aman saat offline."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={invoiceHref}>
                                <FilePlus2 /> Buat invoice dari sesi
                            </Link>
                        </Button>
                    }
                />

                {/* Offline / antrean sinkronisasi */}
                {pending && (
                    <div
                        role="status"
                        className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                        <div className="flex items-start gap-2">
                            <WifiOff className="mt-0.5 size-4 shrink-0" />
                            <div>
                                <p className="font-medium">
                                    {online
                                        ? 'Menunggu sinkronisasi'
                                        : 'Anda sedang offline'}
                                </p>
                                <p className="text-xs opacity-90">
                                    {queueLen > 0
                                        ? `${queueLen} aksi tersimpan di perangkat ini dan akan dikirim otomatis saat koneksi tersedia.`
                                        : 'Stopwatch tetap berjalan. Perubahan akan disinkronkan saat online.'}
                                    {syncMsg ? ` (${syncMsg})` : ''}
                                </p>
                            </div>
                        </div>
                        {queueLen > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void doFlush()}
                                disabled={busy || !online}
                                className="shrink-0"
                            >
                                <RefreshCw
                                    className={busy ? 'animate-spin' : ''}
                                />{' '}
                                Sinkronkan sekarang
                            </Button>
                        )}
                    </div>
                )}

                {/* Stopwatch aktif / form mulai */}
                {effectiveActive ? (
                    <ActiveSessionCard
                        active={effectiveActive}
                        busy={busy}
                        endPending={endPending}
                        onAction={(k) => mutate(k)}
                    />
                ) : (
                    <StartSessionForm
                        clients={clients}
                        projects={projects}
                        tasks={tasks}
                        initialClientId={
                            filters.client_id ? Number(filters.client_id) : null
                        }
                        initialProjectId={
                            filters.project_id
                                ? Number(filters.project_id)
                                : null
                        }
                        defaultRate={defaultRate}
                        busy={busy}
                        onStart={startSession}
                    />
                )}

                {/* Ringkasan */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    <StatCard
                        label="Total sesi"
                        value={formatNumber(sessions.total)}
                        hint={hasFilter ? 'Sesuai filter' : 'Semua waktu'}
                        icon={ListChecks}
                    />
                    <StatCard
                        label="Jam belum ditagih"
                        value={formatDuration(summary.unbilledSeconds)}
                        hint={`${summary.unbilledCount} sesi · ${scopeHint.toLowerCase()}`}
                        icon={Hourglass}
                        tone={
                            summary.unbilledSeconds > 0 ? 'warning' : 'default'
                        }
                    />
                    <StatCard
                        label="Nilai belum ditagih"
                        className="col-span-2 sm:col-span-1"
                        value={formatIDR(summary.unbilledAmount)}
                        hint={
                            summary.unbilledAmount > 0 ? (
                                <Link
                                    href={invoiceHref}
                                    className="font-medium text-primary underline-offset-2 hover:underline"
                                >
                                    Tagihkan sekarang →
                                </Link>
                            ) : (
                                scopeHint
                            )
                        }
                        icon={Wallet}
                        tone={
                            summary.unbilledAmount > 0 ? 'success' : 'default'
                        }
                    />
                </div>

                {/* Riwayat */}
                <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold">
                            <Clock className="size-4 text-muted-foreground" />{' '}
                            Riwayat sesi
                        </h2>
                        {summary.trackedSeconds > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {formatDuration(summary.trackedSeconds)}{' '}
                                tercatat
                                {!totals && sessions.last_page > 1
                                    ? ' di halaman ini'
                                    : ''}
                            </span>
                        )}
                    </div>
                    <SessionFilters
                        filters={filters}
                        clients={clients}
                        projects={projects}
                        onChange={applyFilter}
                        onReset={resetFilter}
                    />
                    {sessions.data.length === 0 ? (
                        <EmptyState
                            icon={Timer}
                            title={
                                hasFilter
                                    ? 'Tidak ada sesi yang cocok'
                                    : 'Belum ada sesi kerja'
                            }
                            description={
                                hasFilter
                                    ? 'Coba ubah atau reset filter untuk melihat sesi lainnya.'
                                    : 'Mulai stopwatch di atas untuk mencatat jam kerja pertama Anda.'
                            }
                            action={
                                hasFilter ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={resetFilter}
                                    >
                                        Reset filter
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <>
                            <SessionsTable sessions={sessions.data} />
                            <DataPagination paginator={sessions} noun="sesi" />
                        </>
                    )}
                </Card>
            </PageContainer>
        </>
    );
}
