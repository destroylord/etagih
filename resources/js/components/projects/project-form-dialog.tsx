import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toNumber } from '@/lib/format';
import { PROJECT_STATUS_LABEL } from '@/types/models';
import type { Project, ProjectStatus } from '@/types/models';

type ProjectFormData = {
    client_id: number | '';
    parent_id: number | '';
    name: string;
    description: string;
    status: ProjectStatus;
    hourly_rate: string;
};

const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30';

/**
 * Tambah / edit proyek atau sub-proyek. Render dengan `key` baru tiap dibuka.
 *
 * Contoh:
 *  - Proyek baru untuk klien:     <ProjectFormDialog clientId={5} ... />
 *  - Sub-proyek di bawah "Toko Online": <ProjectFormDialog clientId={5} parentId={tokoOnline.id} ... />
 *  - Edit:                        <ProjectFormDialog project={p} ... />
 *  - Pilih klien di dialog:       <ProjectFormDialog clients={[...]} ... />
 */
export function ProjectFormDialog({
    open,
    onOpenChange,
    project = null,
    clientId = null,
    parentId = null,
    clients = [],
    parentOptions = [],
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project?: Project | null;
    clientId?: number | null;
    parentId?: number | null;
    /** Tampilkan pilihan klien (bila clientId tidak diberikan). */
    clients?: { id: number; name: string }[];
    /** Proyek utama yang bisa dipilih sebagai induk (milik klien yang sama). */
    parentOptions?: { id: number; name: string; client_id: number }[];
}) {
    const isEdit = !!project;
    const form = useForm<ProjectFormData>({
        client_id: project?.client_id ?? clientId ?? '',
        parent_id: project?.parent_id ?? parentId ?? '',
        name: project?.name ?? '',
        description: project?.description ?? '',
        status: project?.status ?? 'active',
        hourly_rate:
            project?.hourly_rate !== null && project?.hourly_rate !== undefined
                ? String(toNumber(project.hourly_rate))
                : '',
    });
    const { data, setData, errors, processing } = form;

    const isSub = data.parent_id !== '';
    const lockedParent = !isEdit && parentId !== null;
    const availableParents = parentOptions.filter(
        (p) => p.client_id === data.client_id && p.id !== project?.id,
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (isEdit && project) {
            form.put(`/projects/${project.id}`, options);
        } else {
            form.post('/projects', options);
        }
    };

    const title = isEdit
        ? isSub
            ? 'Edit sub-proyek'
            : 'Edit proyek'
        : isSub
          ? 'Tambah sub-proyek'
          : 'Tambah proyek';

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => !processing && onOpenChange(v)}
        >
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {isSub
                                ? 'Sub-proyek berada di bawah satu proyek utama, mis. Toko Online → Aplikasi Mobile.'
                                : 'Proyek mengelompokkan invoice & jam kerja klien. Bisa punya sub-proyek.'}
                        </DialogDescription>
                    </DialogHeader>

                    {!isEdit && clientId === null && (
                        <div className="grid gap-2">
                            <Label htmlFor="project_client">Klien</Label>
                            <select
                                id="project_client"
                                className={selectClass}
                                value={data.client_id}
                                onChange={(e) => {
                                    setData((d) => ({
                                        ...d,
                                        client_id: e.target.value
                                            ? Number(e.target.value)
                                            : '',
                                        parent_id: '',
                                    }));
                                }}
                                required
                            >
                                <option value="">Pilih klien…</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.client_id} />
                        </div>
                    )}

                    {!lockedParent &&
                        (availableParents.length > 0 || isSub) && (
                            <div className="grid gap-2">
                                <Label htmlFor="project_parent">Jenis</Label>
                                <select
                                    id="project_parent"
                                    className={selectClass}
                                    value={data.parent_id}
                                    onChange={(e) =>
                                        setData(
                                            'parent_id',
                                            e.target.value
                                                ? Number(e.target.value)
                                                : '',
                                        )
                                    }
                                >
                                    <option value="">Proyek utama</option>
                                    {availableParents.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            Sub-proyek dari {p.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.parent_id} />
                            </div>
                        )}

                    <div className="grid gap-2">
                        <Label htmlFor="project_name">Nama</Label>
                        <Input
                            id="project_name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder={
                                isSub
                                    ? 'mis. Aplikasi Mobile'
                                    : 'mis. Toko Online'
                            }
                            autoFocus
                            required
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="project_rate">Tarif per jam</Label>
                            <Input
                                id="project_rate"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={data.hourly_rate}
                                onChange={(e) =>
                                    setData('hourly_rate', e.target.value)
                                }
                                placeholder={
                                    isSub
                                        ? 'Ikut proyek / klien'
                                        : 'Ikut tarif klien'
                                }
                            />
                            <InputError message={errors.hourly_rate} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="project_status">Status</Label>
                            <select
                                id="project_status"
                                className={selectClass}
                                value={data.status}
                                onChange={(e) =>
                                    setData(
                                        'status',
                                        e.target.value as ProjectStatus,
                                    )
                                }
                            >
                                {(
                                    Object.keys(
                                        PROJECT_STATUS_LABEL,
                                    ) as ProjectStatus[]
                                ).map((s) => (
                                    <option key={s} value={s}>
                                        {PROJECT_STATUS_LABEL[s]}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.status} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project_description">
                            Catatan (opsional)
                        </Label>
                        <Textarea
                            id="project_description"
                            rows={3}
                            value={data.description}
                            onChange={(e) =>
                                setData('description', e.target.value)
                            }
                        />
                        <InputError message={errors.description} />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={processing}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                processing ||
                                !data.name.trim() ||
                                data.client_id === ''
                            }
                        >
                            {processing && <Spinner />}
                            {isEdit ? 'Simpan' : 'Tambah'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
