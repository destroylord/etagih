<?php

namespace App\Notifications\Tasks;

use App\Models\Task;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * Dasar notifikasi tugas.
 *
 * - Kanal `database` (lonceng di aplikasi) selalu, dikirim langsung (sync).
 * - Kanal `mail` bila pengguna mengizinkan (`users.notify_email`) — lewat antrean.
 * - Pengguna nonaktif tidak pernah diberi notifikasi.
 *
 * Payload database: {type, title, body, url, task_id}. `type` adalah kunci
 * singkat (task_assigned|task_commented|task_due_soon|task_overdue).
 */
abstract class TaskNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Task $task) {}

    /** Kunci singkat jenis notifikasi (disimpan di data.type). */
    abstract public function key(): string;

    abstract public function title(): string;

    abstract public function body(): string;

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User || ! $notifiable->is_active) {
            return [];
        }

        $channels = ['database'];
        if ($notifiable->wantsEmailNotifications() && $notifiable->email) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * Database langsung (lonceng langsung bertambah), email lewat antrean default.
     *
     * @return array<string, string>
     */
    public function viaConnections(): array
    {
        return [
            'database' => 'sync',
            'mail' => (string) config('queue.default'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->key(),
            'title' => $this->title(),
            'body' => $this->body(),
            'url' => '/tasks?task='.$this->task->id,
            'task_id' => $this->task->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $business = self::businessName();
        $name = $notifiable instanceof User ? $notifiable->name : '';

        return (new MailMessage)
            ->subject($this->title())
            ->greeting("Halo {$name},")
            ->line($this->body())
            ->action('Buka tugas', $this->task->url())
            ->line('Anda bisa mematikan email notifikasi di Pengaturan → Profil.')
            ->salutation("Salam,\n{$business}");
    }

    /** Nama bisnis dari Pengaturan → Invoice; fallback nama aplikasi. */
    protected static function businessName(): string
    {
        try {
            $name = Settings::current()->company_name;
        } catch (Throwable) {
            $name = null;
        }

        return is_string($name) && trim($name) !== '' ? trim($name) : (string) config('app.name');
    }

    protected function projectName(): string
    {
        $this->task->loadMissing('project.parent:id,name');

        return $this->task->project->full_name;
    }
}
