/**
 * Tipe data Tugas, Anggota Proyek, Tagihan Tugas & Notifikasi
 * (backend: App\Http\Controllers\TaskController, App\Support\TaskPayload,
 * ProjectController::show, InvoiceController::billableTasks,
 * NotificationController, HandleInertiaRequests).
 *
 * Semua tanggal "date" berupa "YYYY-MM-DD"; "datetime" berupa ISO-8601.
 */

import type { Paginated } from './models';

// ---- Enum ---------------------------------------------------------------------

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export const TASK_STATUSES: TaskStatus[] = [
    'todo',
    'in_progress',
    'review',
    'done',
];
export const TASK_PRIORITIES: TaskPriority[] = [
    'low',
    'normal',
    'high',
    'urgent',
];

/** Sama dengan Task::STATUS_LABELS (juga dikirim sebagai prop `statusLabels`). */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
    todo: 'To do',
    in_progress: 'Dikerjakan',
    review: 'Review',
    done: 'Selesai',
};

/** Sama dengan Task::PRIORITY_LABELS (juga dikirim sebagai prop `priorityLabels`). */
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
    low: 'Rendah',
    normal: 'Normal',
    high: 'Tinggi',
    urgent: 'Mendesak',
};

// ---- Tugas --------------------------------------------------------------------

export type UserRef = { id: number; name: string };

/** Satu baris tugas (daftar, papan, "Tugas saya"). TaskPayload::row(). */
export type Task = {
    id: number;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    project: {
        id: number;
        /** null = proyek utama */
        parent_id: number | null;
        /** "Toko Online › Aplikasi Mobile" */
        full_name: string;
        client: { id: number; name: string };
    };
    assignee: UserRef | null;
    /** id pembuat tugas (null bila penggunanya dihapus) */
    created_by: number | null;
    /** "YYYY-MM-DD" */
    start_date: string | null;
    /** "YYYY-MM-DD" */
    due_date: string | null;
    estimate_minutes: number | null;
    /** Total menit dari sesi Time Tracker selesai/ditagih. */
    logged_minutes: number;
    billable: boolean;
    /** Decimal string, mis. "1500000.00" */
    fixed_price: string | null;
    /** Lewat tenggat & belum selesai. */
    is_overdue: boolean;
    /** Sudah masuk item invoice (tidak bisa dihapus). */
    is_billed: boolean;
    checklist_total: number;
    checklist_done: number;
    comments_count: number;
    /** Urutan dalam kolom status (global per status). */
    position: number;
    /** ISO datetime saat status menjadi `done`. */
    completed_at: string | null;
    /** Stopwatch pengguna yang login sedang berjalan/dijeda untuk tugas ini. */
    has_running_session: boolean;
    can: { update: boolean; delete: boolean };
};

export type TaskChecklistItem = {
    id: number;
    body: string;
    is_done: boolean;
    position: number;
};

export type TaskComment = {
    id: number;
    body: string;
    /** null bila penulisnya sudah dihapus */
    user: UserRef | null;
    created_at: string | null;
    can_delete: boolean;
};

export type TaskSession = {
    id: number;
    user: UserRef | null;
    description: string;
    status: 'running' | 'paused' | 'completed' | 'billed' | 'cancelled';
    started_at: string | null;
    ended_at: string | null;
    /** Detik (untuk sesi aktif = berjalan sejauh ini). */
    duration_seconds: number;
    billed: boolean;
};

export type TaskActivity = {
    type: 'created' | 'completed' | 'billed';
    at: string | null;
    /** Nama pengguna (bila diketahui). */
    user: string | null;
    invoice_number?: string;
};

/**
 * Detail tugas untuk panel samping: GET /tasks/{id} (route `tasks.show`)
 * → `{ task: TaskDetail }` (JSON).
 */
export type TaskDetail = Omit<Task, 'can'> & {
    description: string | null;
    creator: UserRef | null;
    created_at: string | null;
    updated_at: string | null;
    invoice: { id: number; invoice_number: string; status: string } | null;
    checklist: TaskChecklistItem[];
    comments: TaskComment[];
    /** 20 sesi terakhir. */
    sessions: TaskSession[];
    activity: TaskActivity[];
    /** Pengguna aktif yang boleh ditugaskan di proyek tugas ini (admin + anggota). */
    assignable_users: UserRef[];
    can: {
        update: boolean;
        delete: boolean;
        comment: boolean;
        start_timer: boolean;
    };
};

export type TaskShowResponse = { task: TaskDetail };

// ---- Halaman tasks/index -----------------------------------------------------

export type TaskView = 'mine' | 'board' | 'list';

export type TaskFilters = {
    project_id: number | null;
    client_id: number | null;
    /** 'me' | 'none' (tanpa penerima) | id pengguna sebagai string */
    assignee_id: string | null;
    priority: TaskPriority | null;
    status: TaskStatus | null;
    due: 'overdue' | 'today' | 'week' | null;
    q: string | null;
};

/** view = 'mine': tugas saya yang terbuka per kelompok tenggat + selesai 7 hari terakhir. */
export type MyTaskGroups = {
    overdue: Task[];
    today: Task[];
    /** besok s.d. 7 hari ke depan */
    week: Task[];
    later: Task[];
    no_date: Task[];
    done_recent: Task[];
};

/**
 * view = 'board': kolom per status, urut `position`. Maks. 500 tugas; kolom
 * "done" hanya yang selesai 30 hari terakhir (kecuali filter status=done).
 * Proyek yang diarsipkan tidak ditampilkan.
 */
export type TaskBoardColumns = Record<TaskStatus, Task[]>;

/** Opsi proyek di halaman tugas (proyek terlihat & tidak diarsipkan). */
export type TaskProjectOption = {
    id: number;
    parent_id: number | null;
    name: string;
    full_name: string;
    client: { id: number; name: string };
    /**
     * Anggota proyek utama. Penerima tugas yang valid = pengguna role
     * owner/admin ATAU id-nya ada di sini.
     */
    member_ids: number[];
};

export type TaskUserOption = {
    id: number;
    name: string;
    role: 'owner' | 'admin' | 'staff';
};

export type TaskCounts = {
    todo: number;
    in_progress: number;
    review: number;
    done: number;
    mine_open: number;
    mine_overdue: number;
};

type TaskIndexBase = {
    filters: TaskFilters;
    projects: TaskProjectOption[];
    users: TaskUserOption[];
    statusLabels: Record<TaskStatus, string>;
    priorityLabels: Record<TaskPriority, string>;
    counts: TaskCounts;
};

/** Props halaman `tasks/index` (diskriminasi lewat `view`). */
export type TaskIndexProps = TaskIndexBase &
    (
        | { view: 'mine'; tasks: MyTaskGroups }
        | { view: 'board'; tasks: TaskBoardColumns }
        | { view: 'list'; tasks: Paginated<Task> }
    );

/** Body POST /tasks (tasks.store) & PUT /tasks/{id} (tasks.update; boleh sebagian). */
export type TaskFormData = {
    project_id: number | null;
    title: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee_id?: number | null;
    start_date?: string | null;
    due_date?: string | null;
    estimate_minutes?: number | null;
    billable?: boolean;
    fixed_price?: string | number | null;
};

/**
 * Body PATCH /tasks/{id}/move (tasks.move). Pakai `before_id` (taruh sebelum
 * tugas itu) — andal walau papan difilter; `position` = indeks di seluruh
 * kolom; tanpa keduanya = akhir kolom.
 */
export type TaskMoveData = {
    status: TaskStatus;
    before_id?: number | null;
    position?: number | null;
};

/** Ringkasan tugas di halaman proyek (prop `taskSummary`). */
export type TaskSummary = {
    todo: number;
    in_progress: number;
    review: number;
    done: number;
    total: number;
    open: number;
    overdue: number;
};

// ---- Anggota proyek ----------------------------------------------------------

/** Prop `members` / `assignableUsers` di halaman `projects/show`. */
export type ProjectMember = {
    id: number;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'staff';
};

/** Body PUT /projects/{id}/members (projects.members.sync, admin). */
export type ProjectMembersSyncData = { user_ids: number[] };

// ---- Time Tracker ------------------------------------------------------------

/** Prop `tasks` di halaman `time-tracker` (tugas terbuka, milik saya lebih dulu, maks. 200). */
export type TimeTrackerTaskOption = {
    id: number;
    title: string;
    status: TaskStatus;
    project_id: number;
    client_id: number;
    project_name: string;
    assignee_id: number | null;
    due_date: string | null;
};

// ---- Tagihan tugas -----------------------------------------------------------

/** Baris saran untuk item invoice (kirim sebagai bagian dari `items[]`). */
export type BillableTaskLine = {
    task_id: number;
    project_id: number;
    description: string;
    unit_price: number;
    /** Hanya untuk mode hourly. */
    session_ids?: number[];
    /** Hanya mode hourly: null = jam dari session_ids; angka = jam manual. */
    hours_qty?: number | null;
};

/**
 * GET /invoices/billable-tasks?client_id=&invoice_id= (invoices.billable-tasks)
 * → `{ tasks: BillableTask[] }`. Tugas selesai, billable, belum ditagih
 * (atau sudah di invoice_id yang sedang diedit).
 */
export type BillableTask = {
    id: number;
    title: string;
    project_id: number;
    project_full_name: string;
    completed_at: string | null;
    fixed_price: number | null;
    /** Sesi Time Tracker tugas yang belum ditagih. */
    session_ids: number[];
    total_seconds: number;
    hours: number;
    /** Tarif saran: sub-proyek → proyek → klien → default. */
    unit_price: number;
    invoice_id: number | null;
    suggested: {
        /** Untuk invoice mode `fixed`: harga = fixed_price atau jam × tarif. */
        fixed: BillableTaskLine;
        /** Untuk invoice mode `hourly`: sesi × tarif, atau 1 jam × harga tetap. */
        hourly: BillableTaskLine;
    };
};

export type BillableTasksResponse = { tasks: BillableTask[] };

// ---- Notifikasi --------------------------------------------------------------

export type AppNotificationType =
    'task_assigned' | 'task_commented' | 'task_due_soon' | 'task_overdue';

export type AppNotification = {
    /** UUID */
    id: string;
    type: AppNotificationType | string;
    title: string;
    body: string;
    /** mis. "/tasks?task=12" */
    url: string | null;
    read_at: string | null;
    created_at: string | null;
};

/** GET /notifications (notifications.index) → JSON. Maks. 30 terbaru. */
export type NotificationsResponse = {
    unread_count: number;
    notifications: AppNotification[];
};

/**
 * Tambahan pada shared prop `auth` (HandleInertiaRequests):
 *   auth.can                 → AuthCan | null
 *   auth.unreadNotifications → number
 *   auth.user.notify_email   → boolean (preferensi email notifikasi; ubah via PATCH settings/profile)
 */
export type AuthCan = {
    manageClients: boolean;
    manageProjects: boolean;
    manageMembers: boolean;
    createSubProjects: boolean;
    createTasks: boolean;
};
