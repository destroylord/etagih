<?php

namespace App\Notifications;

use App\Models\User;
use App\Support\Settings;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * Email undangan anggota tim. Tautan memakai token dari broker `invites`
 * (berlaku 7 hari, lihat config/auth.php).
 */
class UserInvitation extends Notification
{
    use Queueable;

    public const VALID_DAYS = 7;

    public function __construct(
        public readonly string $token,
        public readonly ?string $inviterName = null,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $business = self::businessName();
        $role = User::ROLE_LABELS[$notifiable->role];
        $inviter = $this->inviterName ?: 'Admin';

        return (new MailMessage)
            ->subject("Undangan bergabung ke {$business} di eTagih")
            ->greeting("Halo {$notifiable->name},")
            ->line("{$inviter} mengundang Anda bergabung ke {$business} di eTagih sebagai {$role}.")
            ->line('Klik tombol di bawah untuk menerima undangan dan membuat password akun Anda.')
            ->action('Terima undangan & buat password', $this->url($notifiable))
            ->line('Tautan ini berlaku '.self::VALID_DAYS.' hari. Jika sudah kedaluwarsa, minta admin mengirim ulang undangan.')
            ->line('Jika Anda tidak merasa diundang, abaikan email ini.')
            ->salutation("Salam,\n{$business}");
    }

    public function url(User $notifiable): string
    {
        return route('invitation.accept', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }

    /** Nama bisnis dari Pengaturan → Invoice; fallback nama aplikasi. */
    public static function businessName(): string
    {
        try {
            $name = Settings::current()->company_name;
        } catch (Throwable) {
            $name = null;
        }

        return is_string($name) && trim($name) !== '' ? trim($name) : (string) config('app.name');
    }
}
