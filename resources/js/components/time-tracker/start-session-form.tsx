import { Link, usePage } from '@inertiajs/react';
import { Lock, Play, Timer } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { ProjectSelect } from '@/components/projects/project-select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatIDR, toNumber } from '@/lib/format';
import type { ProjectOption } from '@/types/models';
import type { TimeTrackerTaskOption } from '@/types/tasks';
import type { TrackerClient } from './types';

export type StartPayload = {
    clientId: number;
    clientName: string;
    projectId: number | null;
    /** Nama lengkap proyek, mis. "Toko Online › Aplikasi Mobile". */
    projectName: string | null;
    description: string;
    unitPrice: number;
    notes: string | null;
    /** Tugas yang dikerjakan (klien & proyek mengikuti tugas). */
    task: { id: number; title: string } | null;
};

const NO_TASK = 'none';

type RateSource = 'default' | 'client' | 'project' | 'parent';

const RATE_HINT: Record<RateSource, string> = {
    default: '',
    client: 'Tarif diambil dari pengaturan client.',
    project: 'Tarif diambil dari pengaturan proyek.',
    parent: 'Tarif diambil dari proyek induk.',
};

/**
 * Tarif efektif: sub-proyek → proyek induk → client → default.
 */
function resolveRate(
    clients: TrackerClient[],
    projects: ProjectOption[],
    clientId: number | null,
    projectId: number | null,
    defaultRate: number,
): { rate: number; source: RateSource } {
    const project = projects.find((p) => p.id === projectId);

    if (project) {
        const own = project.hourly_rate ? toNumber(project.hourly_rate) : 0;

        if (own > 0) {
            return { rate: own, source: 'project' };
        }

        const parent = projects.find((p) => p.id === project.parent_id);
        const parentRate = parent?.hourly_rate
            ? toNumber(parent.hourly_rate)
            : 0;

        if (parentRate > 0) {
            return { rate: parentRate, source: 'parent' };
        }
    }

    const c = clients.find((x) => x.id === clientId);
    const clientRate = c?.hourly_rate ? toNumber(c.hourly_rate) : 0;

    return clientRate > 0
        ? { rate: clientRate, source: 'client' }
        : { rate: defaultRate, source: 'default' };
}

/** Form mulai stopwatch — tampil saat tidak ada sesi aktif. */
export function StartSessionForm({
    clients,
    projects,
    tasks = [],
    defaultRate,
    busy,
    onStart,
    initialClientId = null,
    initialProjectId = null,
}: {
    clients: TrackerClient[];
    projects: ProjectOption[];
    /** Tugas terbuka yang bisa dipilih (opsional). */
    tasks?: TimeTrackerTaskOption[];
    defaultRate: number;
    busy: boolean;
    onStart: (payload: StartPayload) => void;
    /** Prefill dari query string (?client_id=&project_id=). */
    initialClientId?: number | null;
    initialProjectId?: number | null;
}) {
    // Prefill: proyek valid menentukan client; client harus ada di daftar.
    const [initial] = useState(() => {
        const project = projects.find((p) => p.id === initialProjectId);
        const cid =
            project?.client_id ??
            (clients.some((c) => c.id === initialClientId)
                ? initialClientId
                : null);
        const pid = project && project.client_id === cid ? project.id : null;

        return {
            clientId: cid,
            projectId: pid,
            ...resolveRate(clients, projects, cid, pid, defaultRate),
        };
    });

    const [clientId, setClientId] = useState(
        initial.clientId ? String(initial.clientId) : '',
    );
    const [projectId, setProjectId] = useState<number | null>(
        initial.projectId,
    );
    const [description, setDescription] = useState('');
    const [rate, setRate] = useState(String(initial.rate || ''));
    const [rateSource, setRateSource] = useState<RateSource>(initial.source);
    /** User sudah mengubah tarif manual → jangan ditimpa prefill. */
    const [rateEdited, setRateEdited] = useState(false);
    const [notes, setNotes] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [taskId, setTaskId] = useState<number | null>(null);

    const userId = (usePage().props.auth?.user as { id?: number } | null)?.id;
    const task =
        taskId !== null ? tasks.find((t) => t.id === taskId) : undefined;
    const myTasks = tasks.filter(
        (t) => userId !== undefined && t.assignee_id === userId,
    );
    const otherTasks = tasks.filter((t) => !myTasks.includes(t));
    const taskGroups = [
        { label: 'Ditugaskan ke saya', items: myTasks },
        {
            label: myTasks.length > 0 ? 'Task lain' : 'Task',
            items: otherTasks,
        },
    ].filter((g) => g.items.length > 0);

    const applyRate = (cid: number | null, pid: number | null) => {
        if (rateEdited) {
            return;
        }

        const r = resolveRate(clients, projects, cid, pid, defaultRate);
        setRate(String(r.rate || ''));
        setRateSource(r.source);
    };

    const pickClient = (id: string) => {
        setClientId(id);
        setProjectId(null);
        applyRate(Number(id), null);
    };

    const pickProject = (id: number | null) => {
        setProjectId(id);
        applyRate(clientId ? Number(clientId) : null, id);
    };

    /** Pilih tugas: klien, proyek & uraian mengikuti tugas (klien/proyek dikunci). */
    const pickTask = (value: string) => {
        const next =
            value === NO_TASK
                ? undefined
                : tasks.find((t) => t.id === Number(value));
        const previousTitle = task?.title;
        setTaskId(next ? next.id : null);

        if (!next) {
            if (description === previousTitle) {
                setDescription('');
            }

            return;
        }

        setClientId(String(next.client_id));
        setProjectId(next.project_id);
        applyRate(next.client_id, next.project_id);

        if (description.trim() === '' || description === previousTitle) {
            setDescription(next.title);
        }
    };

    const canSubmit =
        !!clientId &&
        description.trim() !== '' &&
        rate !== '' &&
        toNumber(rate) >= 0 &&
        !busy;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!canSubmit) {
            return;
        }

        const c = clients.find((x) => x.id === Number(clientId));
        const p = projects.find((x) => x.id === projectId);
        onStart({
            clientId: Number(clientId),
            clientName: c?.name ?? '',
            projectId: p ? p.id : (task?.project_id ?? null),
            projectName: p ? p.full_name : (task?.project_name ?? null),
            description: description.trim(),
            unitPrice: toNumber(rate),
            notes: notes.trim() || null,
            task: task ? { id: task.id, title: task.title } : null,
        });
        setTaskId(null);
        setDescription('');
        setNotes('');
        setShowNotes(false);
    };

    if (clients.length === 0) {
        return (
            <Card className="flex-col items-start justify-between gap-4 border-dashed p-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Timer className="size-5 shrink-0" />
                    Tambahkan client terlebih dahulu sebelum mulai mencatat
                    waktu.
                </div>
                <Button variant="outline" asChild>
                    <Link href="/clients">Kelola client</Link>
                </Button>
            </Card>
        );
    }

    return (
        <Card className="gap-0 py-0">
            <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Timer className="size-4" />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold">
                            Mulai sesi kerja
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Tidak ada stopwatch berjalan. Pilih client lalu
                            mulai.
                        </p>
                    </div>
                </div>

                {tasks.length > 0 && (
                    <div className="grid gap-2 md:max-w-xl">
                        <Label htmlFor="tt-task">
                            Task{' '}
                            <span className="font-normal text-muted-foreground">
                                (opsional)
                            </span>
                        </Label>
                        <Select
                            value={taskId !== null ? String(taskId) : NO_TASK}
                            onValueChange={pickTask}
                        >
                            <SelectTrigger id="tt-task" className="w-full">
                                <SelectValue placeholder="Tanpa task" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_TASK}>
                                    Tanpa task
                                </SelectItem>
                                {taskGroups.map((g) => (
                                    <SelectGroup key={g.label}>
                                        <SelectLabel>{g.label}</SelectLabel>
                                        {g.items.map((t) => (
                                            <SelectItem
                                                key={t.id}
                                                value={String(t.id)}
                                            >
                                                <span className="truncate">
                                                    {t.title}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    · {t.project_name}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        {task && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Lock className="size-3 shrink-0" />
                                Client &amp; proyek mengikuti task ini.
                            </p>
                        )}
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_10rem]">
                    <div className="grid gap-2">
                        <Label htmlFor="tt-client">Client</Label>
                        <Select
                            value={clientId}
                            onValueChange={pickClient}
                            disabled={!!task}
                        >
                            <SelectTrigger id="tt-client" className="w-full">
                                <SelectValue placeholder="Pilih client" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tt-project">
                            Proyek / sub-proyek{' '}
                            <span className="font-normal text-muted-foreground">
                                (opsional)
                            </span>
                        </Label>
                        <ProjectSelect
                            id="tt-project"
                            projects={projects}
                            clientId={clientId ? Number(clientId) : null}
                            value={projectId}
                            onChange={(id) => pickProject(id)}
                            disabled={!!task}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tt-desc">Pekerjaan</Label>
                        <Input
                            id="tt-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Contoh: Revisi landing page"
                            maxLength={255}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tt-rate">Tarif per jam</Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                                Rp
                            </span>
                            <Input
                                id="tt-rate"
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1000"
                                value={rate}
                                onChange={(e) => {
                                    setRate(e.target.value);
                                    setRateEdited(true);
                                }}
                                className="pl-9 tabular-nums"
                            />
                        </div>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    {rateEdited
                        ? 'Tarif diisi manual.'
                        : rateSource === 'default'
                          ? `Tarif default ${formatIDR(defaultRate)}/jam.`
                          : RATE_HINT[rateSource]}{' '}
                    Durasi dibulatkan ke atas saat sesi diselesaikan.
                </p>

                {showNotes ? (
                    <div className="grid gap-2">
                        <Label htmlFor="tt-notes">Catatan</Label>
                        <Textarea
                            id="tt-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={1000}
                        />
                    </div>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {!showNotes ? (
                        <Button
                            type="button"
                            variant="link"
                            className="h-auto justify-start px-0 text-muted-foreground"
                            onClick={() => setShowNotes(true)}
                        >
                            + Tambah catatan
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button
                        type="submit"
                        disabled={!canSubmit}
                        className="h-11 sm:h-9 sm:min-w-32"
                    >
                        <Play /> Mulai
                    </Button>
                </div>
            </form>
        </Card>
    );
}
