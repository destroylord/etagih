import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useMemo } from 'react';
import InputError from '@/components/input-error';
import { RupiahInput } from '@/components/tasks/rupiah-input';
import {
    assignableFor,
    groupProjectsByClient,
    useAuthUserId,
} from '@/components/tasks/task-utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ResponsiveDialog,
    ResponsiveDialogBody,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { store, update } from '@/routes/tasks';
import {
    TASK_PRIORITIES,
    TASK_PRIORITY_LABEL,
    TASK_STATUSES,
    TASK_STATUS_LABEL,
} from '@/types/tasks';
import type {
    Task,
    TaskPriority,
    TaskProjectOption,
    TaskStatus,
    TaskUserOption,
    UserRef,
} from '@/types/tasks';

export const selectClass =
    'h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:h-9 dark:bg-input/30 [&_option]:bg-background';

type FormState = {
    project_id: number | '';
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee_id: number | '';
    start_date: string;
    due_date: string;
    estimate_hours: string;
    estimate_mins: string;
    billable: boolean;
    fixed_price: string;
};

export type TaskFormTask = Pick<
    Task,
    | 'id'
    | 'title'
    | 'status'
    | 'priority'
    | 'project'
    | 'assignee'
    | 'start_date'
    | 'due_date'
    | 'estimate_minutes'
    | 'billable'
    | 'fixed_price'
> & { description?: string | null };

/**
 * Buat / edit tugas. Render dengan `key` baru tiap dibuka agar form ter-reset.
 *
 *   <TaskFormDialog open onOpenChange={…} projects={projects} users={users} />
 *   <TaskFormDialog task={detail} assignableUsers={detail.assignable_users} … />
 *   <TaskFormDialog defaultProjectId={project.id} lockProject … />
 */
export function TaskFormDialog({
    open,
    onOpenChange,
    task = null,
    projects,
    users,
    assignableUsers,
    defaultProjectId = null,
    defaultStatus,
    lockProject = false,
    only,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: TaskFormTask | null;
    projects: TaskProjectOption[];
    users: TaskUserOption[];
    /** Penerima valid dari detail tugas (dipakai bila proyek tidak ada di `projects`). */
    assignableUsers?: UserRef[];
    defaultProjectId?: number | null;
    /** Status awal tugas baru (mis. dari tombol "+ Tambah" kolom papan). */
    defaultStatus?: TaskStatus;
    lockProject?: boolean;
    /** Props Inertia yang dimuat ulang setelah simpan. */
    only?: string[];
    onSaved?: () => void;
}) {
    const isEdit = !!task;
    const me = useAuthUserId();
    const initialProject = task?.project.id ?? defaultProjectId ?? '';
    const initialProjectOption = projects.find((p) => p.id === initialProject);
    const meAllowed =
        me !== null &&
        assignableFor(users, initialProjectOption).some((u) => u.id === me);

    const estimate = task?.estimate_minutes ?? null;
    const form = useForm<FormState>({
        project_id: initialProject,
        title: task?.title ?? '',
        description: task?.description ?? '',
        status: task?.status ?? defaultStatus ?? 'todo',
        priority: task?.priority ?? 'normal',
        assignee_id: task
            ? (task.assignee?.id ?? '')
            : meAllowed && me !== null
              ? me
              : '',
        start_date: task?.start_date ?? '',
        due_date: task?.due_date ?? '',
        estimate_hours:
            estimate !== null ? String(Math.floor(estimate / 60)) : '',
        estimate_mins: estimate !== null ? String(estimate % 60) : '',
        billable: task?.billable ?? true,
        fixed_price:
            task?.fixed_price !== null && task?.fixed_price !== undefined
                ? String(Math.round(Number(task.fixed_price)))
                : '',
    });
    const { data, setData, errors, processing } = form;

    const groups = useMemo(() => groupProjectsByClient(projects), [projects]);
    const selectedProject = projects.find((p) => p.id === data.project_id);
    const assigneeOptions: UserRef[] = useMemo(() => {
        let list: UserRef[];

        if (selectedProject) {
            list = assignableFor(users, selectedProject);
        } else if (assignableUsers && task?.project.id === data.project_id) {
            list = assignableUsers;
        } else {
            list = users;
        }

        // Pastikan penerima saat ini tetap tampil walau tidak ada di daftar.
        if (
            task?.assignee &&
            data.assignee_id === task.assignee.id &&
            !list.some((u) => u.id === task.assignee?.id)
        ) {
            list = [task.assignee, ...list];
        }

        return list;
    }, [
        selectedProject,
        users,
        assignableUsers,
        task,
        data.project_id,
        data.assignee_id,
    ]);

    const lockedProjectLabel =
        lockProject && (selectedProject?.full_name ?? task?.project.full_name);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        form.transform((d) => {
            const hasEstimate =
                d.estimate_hours !== '' || d.estimate_mins !== '';
            const estimateMinutes = hasEstimate
                ? Math.max(0, Math.round(Number(d.estimate_hours || 0) * 60)) +
                  Math.max(0, Math.round(Number(d.estimate_mins || 0)))
                : null;

            return {
                project_id: d.project_id === '' ? null : d.project_id,
                title: d.title.trim(),
                description: d.description.trim() === '' ? null : d.description,
                ...(isEdit || defaultStatus ? { status: d.status } : {}),
                priority: d.priority,
                assignee_id: d.assignee_id === '' ? null : d.assignee_id,
                start_date: d.start_date || null,
                due_date: d.due_date || null,
                estimate_minutes: estimateMinutes,
                billable: d.billable,
                fixed_price: d.fixed_price === '' ? null : d.fixed_price,
            };
        });

        const options = {
            preserveScroll: true,
            preserveState: true,
            ...(only ? { only } : {}),
            onSuccess: () => {
                onOpenChange(false);
                onSaved?.();
            },
        };

        if (isEdit && task) {
            form.put(update.url(task.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    const onProjectChange = (value: string) => {
        const id = value ? Number(value) : '';
        const next = projects.find((p) => p.id === id);
        const allowed = assignableFor(users, next);

        setData((d) => ({
            ...d,
            project_id: id,
            // Kosongkan penerima bila tidak berhak di proyek baru.
            assignee_id:
                d.assignee_id !== '' &&
                !allowed.some((u) => u.id === d.assignee_id)
                    ? ''
                    : d.assignee_id,
        }));
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={(v) => !processing && onOpenChange(v)}
        >
            <ResponsiveDialogContent className="sm:max-w-2xl">
                <form
                    onSubmit={submit}
                    className="flex flex-col gap-4"
                    noValidate
                >
                    <ResponsiveDialogHeader>
                        <ResponsiveDialogTitle>
                            {isEdit ? 'Edit task' : 'Task baru'}
                        </ResponsiveDialogTitle>
                        <ResponsiveDialogDescription>
                            {isEdit
                                ? 'Ubah detail task. Perubahan langsung terlihat oleh anggota proyek.'
                                : 'Catat pekerjaan untuk proyek klien dan tentukan penanggung jawabnya.'}
                        </ResponsiveDialogDescription>
                    </ResponsiveDialogHeader>

                    <ResponsiveDialogBody className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="task_title">Judul</Label>
                            <Input
                                id="task_title"
                                value={data.title}
                                onChange={(e) =>
                                    setData('title', e.target.value)
                                }
                                placeholder="mis. Desain halaman checkout"
                                className="h-11 md:h-9"
                                maxLength={255}
                                autoFocus
                                required
                            />
                            <InputError message={errors.title} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="task_project">Proyek</Label>
                                {lockedProjectLabel ? (
                                    <p
                                        id="task_project"
                                        className="flex h-11 items-center truncate rounded-md border bg-muted/40 px-3 text-sm md:h-9"
                                    >
                                        {lockedProjectLabel}
                                    </p>
                                ) : (
                                    <select
                                        id="task_project"
                                        className={selectClass}
                                        value={data.project_id}
                                        onChange={(e) =>
                                            onProjectChange(e.target.value)
                                        }
                                        required
                                    >
                                        <option value="">Pilih proyek…</option>
                                        {task &&
                                            !selectedProject &&
                                            data.project_id ===
                                                task.project.id && (
                                                <option value={task.project.id}>
                                                    {task.project.full_name}
                                                </option>
                                            )}
                                        {groups.map((g) => (
                                            <optgroup
                                                key={g.client.id}
                                                label={g.client.name}
                                            >
                                                {g.projects.map((p) => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}
                                                    >
                                                        {p.parent_id
                                                            ? `↳ ${p.full_name}`
                                                            : p.full_name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                )}
                                <InputError message={errors.project_id} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="task_assignee">
                                    Penanggung jawab
                                </Label>
                                <select
                                    id="task_assignee"
                                    className={selectClass}
                                    value={data.assignee_id}
                                    onChange={(e) =>
                                        setData(
                                            'assignee_id',
                                            e.target.value
                                                ? Number(e.target.value)
                                                : '',
                                        )
                                    }
                                >
                                    <option value="">Belum ditentukan</option>
                                    {assigneeOptions.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                            {u.id === me ? ' (Saya)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.assignee_id} />
                            </div>
                        </div>

                        <div
                            className={cn(
                                'grid gap-4',
                                isEdit ? 'grid-cols-2' : 'sm:grid-cols-2',
                            )}
                        >
                            {isEdit && (
                                <div className="grid gap-2">
                                    <Label htmlFor="task_status">Status</Label>
                                    <select
                                        id="task_status"
                                        className={selectClass}
                                        value={data.status}
                                        onChange={(e) =>
                                            setData(
                                                'status',
                                                e.target.value as TaskStatus,
                                            )
                                        }
                                    >
                                        {TASK_STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {TASK_STATUS_LABEL[s]}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.status} />
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="task_priority">Prioritas</Label>
                                <select
                                    id="task_priority"
                                    className={selectClass}
                                    value={data.priority}
                                    onChange={(e) =>
                                        setData(
                                            'priority',
                                            e.target.value as TaskPriority,
                                        )
                                    }
                                >
                                    {TASK_PRIORITIES.map((p) => (
                                        <option key={p} value={p}>
                                            {TASK_PRIORITY_LABEL[p]}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.priority} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid min-w-0 gap-2">
                                <Label htmlFor="task_start">
                                    Tanggal mulai
                                </Label>
                                <Input
                                    id="task_start"
                                    type="date"
                                    className="h-11 md:h-9"
                                    value={data.start_date}
                                    onChange={(e) =>
                                        setData('start_date', e.target.value)
                                    }
                                />
                                <InputError message={errors.start_date} />
                            </div>
                            <div className="grid min-w-0 gap-2">
                                <Label htmlFor="task_due">Tenggat</Label>
                                <Input
                                    id="task_due"
                                    type="date"
                                    className="h-11 md:h-9"
                                    value={data.due_date}
                                    min={data.start_date || undefined}
                                    onChange={(e) =>
                                        setData('due_date', e.target.value)
                                    }
                                />
                                <InputError message={errors.due_date} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <fieldset className="grid min-w-0 gap-2">
                                <legend className="mb-2 text-sm leading-none font-medium">
                                    Estimasi
                                </legend>
                                <div className="flex items-center gap-2">
                                    <div className="relative min-w-0 flex-1">
                                        <Input
                                            id="task_estimate_h"
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            placeholder="0"
                                            aria-label="Estimasi jam"
                                            className="h-11 pr-10 md:h-9"
                                            value={data.estimate_hours}
                                            onChange={(e) =>
                                                setData(
                                                    'estimate_hours',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                            jam
                                        </span>
                                    </div>
                                    <div className="relative min-w-0 flex-1">
                                        <Input
                                            id="task_estimate_m"
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            max={59}
                                            placeholder="0"
                                            aria-label="Estimasi menit"
                                            className="h-11 pr-14 md:h-9"
                                            value={data.estimate_mins}
                                            onChange={(e) =>
                                                setData(
                                                    'estimate_mins',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                            menit
                                        </span>
                                    </div>
                                </div>
                                <InputError
                                    message={
                                        (errors as Record<string, string>)
                                            .estimate_minutes
                                    }
                                />
                            </fieldset>

                            <div className="grid min-w-0 gap-2">
                                <Label htmlFor="task_fixed_price">
                                    Harga tetap{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (opsional)
                                    </span>
                                </Label>
                                <RupiahInput
                                    id="task_fixed_price"
                                    placeholder="0"
                                    className="h-11 md:h-9"
                                    value={data.fixed_price}
                                    onValueChange={(v) =>
                                        setData('fixed_price', v)
                                    }
                                />
                                <InputError message={errors.fixed_price} />
                            </div>
                        </div>

                        <label
                            htmlFor="task_billable"
                            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3"
                        >
                            <Checkbox
                                id="task_billable"
                                checked={data.billable}
                                onCheckedChange={(v) =>
                                    setData('billable', v === true)
                                }
                                className="mt-0.5"
                            />
                            <span className="grid gap-1">
                                <span className="text-sm font-medium">
                                    Bisa ditagih
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Task selesai akan disarankan saat membuat
                                    invoice untuk klien ini — pakai harga tetap
                                    bila diisi, atau jam × tarif.
                                </span>
                            </span>
                        </label>

                        <div className="grid gap-2">
                            <Label htmlFor="task_description">Deskripsi</Label>
                            <Textarea
                                id="task_description"
                                rows={4}
                                value={data.description}
                                onChange={(e) =>
                                    setData('description', e.target.value)
                                }
                                placeholder="Detail pekerjaan, tautan, catatan untuk tim…"
                            />
                            <InputError message={errors.description} />
                        </div>
                    </ResponsiveDialogBody>

                    <ResponsiveDialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={processing}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {isEdit ? 'Simpan' : 'Buat task'}
                        </Button>
                    </ResponsiveDialogFooter>
                </form>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
