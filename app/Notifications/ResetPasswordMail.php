<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;

/**
 * Isi email reset password (Bahasa Indonesia). Didaftarkan lewat
 * `ResetPassword::toMailUsing()` di AppServiceProvider sehingga notifikasi
 * bawaan Laravel/Fortify tetap dipakai, hanya isinya yang diganti.
 */
class ResetPasswordMail
{
    public static function build(object $notifiable, string $token): MailMessage
    {
        $email = method_exists($notifiable, 'getEmailForPasswordReset')
            ? $notifiable->getEmailForPasswordReset()
            : null;

        $url = route('password.reset', ['token' => $token, 'email' => $email]);
        $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);
        $name = isset($notifiable->name) && is_string($notifiable->name) ? $notifiable->name : null;

        return (new MailMessage)
            ->subject('Atur ulang password eTagih')
            ->greeting($name ? "Halo {$name}," : 'Halo,')
            ->line('Kami menerima permintaan untuk mengatur ulang password akun eTagih Anda.')
            ->action('Atur ulang password', $url)
            ->line("Tautan ini berlaku {$minutes} menit.")
            ->line('Jika Anda tidak meminta reset password, abaikan email ini — password Anda tidak berubah.')
            ->salutation("Salam,\n".UserInvitation::businessName());
    }
}
