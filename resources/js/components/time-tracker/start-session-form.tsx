import { Link } from '@inertiajs/react';
import { Play, Timer } from 'lucide-react';
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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatIDR, toNumber } from '@/lib/format';
import type { ProjectOption } from '@/types/models';
import type { TrackerClient } from './types';

export type StartPayload = {
    clientId: number;
    clientName: string;
    projectId: number | null;
    /** Nama lengkap proyek, mis. "Gym › Allstar". */
    projectName: string | null;
    description: string;
    unitPrice: number;
    notes: string | null;
};

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
    defaultRate,
    busy,
    onStart,
    initialClientId = null,
    initialProjectId = null,
}: {
    clients: TrackerClient[];
    projects: ProjectOption[];
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
            projectId: p ? p.id : null,
            projectName: p ? p.full_name : null,
            description: description.trim(),
            unitPrice: toNumber(rate),
            notes: notes.trim() || null,
        });
        setDescription('');
        setNotes('');
        setShowNotes(false);
    };

    if (clients.length === 0) {
        return (
            <Card className="flex-row items-center justify-between gap-4 border-dashed p-5">
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

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_10rem]">
                    <div className="grid gap-2">
                        <Label htmlFor="tt-client">Client</Label>
                        <Select value={clientId} onValueChange={pickClient}>
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
                        className="sm:min-w-32"
                    >
                        <Play /> Mulai
                    </Button>
                </div>
            </form>
        </Card>
    );
}
