<?php

namespace App\Http\Controllers;

use App\Services\WhatsAppService;
use App\Support\BackupBuilder;
use App\Support\SystemStatus;
use App\Support\UpdateChecker;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Pengaturan → Status sistem: pemeriksaan instalasi, uji kirim email/WA, dan backup.
 */
class SystemController extends Controller
{
    public function show(Request $request, SystemStatus $status, UpdateChecker $updates): Response
    {
        // ?refresh=1 → paksa cek ulang versi terbaru ke GitHub.
        $update = $request->boolean('refresh') ? $updates->refresh() : $updates->check();

        return Inertia::render('settings/system', [
            'checks' => $status->checks(),
            'update' => $update,
            'docsUrl' => SystemStatus::docsUrl(),
            'userEmail' => $request->user()?->email,
            'database' => $this->databaseLabel(),
        ]);
    }

    public function testMail(Request $request): RedirectResponse
    {
        $email = (string) $request->user()?->email;
        $app = (string) config('app.name');

        try {
            Mail::raw(
                "Halo,\n\nIni email uji dari {$app} (".config('app.url').").\n".
                'Bila email ini sampai, pengiriman email invoice sudah siap dipakai.',
                fn ($message) => $message->to($email)->subject("Email uji {$app}"),
            );
        } catch (Throwable $e) {
            Log::warning('Test mail failed', ['error' => $e->getMessage()]);

            return back()->with('error', 'Email uji gagal dikirim: '.$e->getMessage());
        }

        $note = in_array(config('mail.default'), ['log', 'array'], true)
            ? ' (MAIL_MAILER='.config('mail.default').': email hanya ditulis ke log)'
            : '';

        return back()->with('success', "Email uji dikirim ke {$email}{$note}.");
    }

    public function testWhatsapp(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:32', 'regex:/^[0-9+\-\s()]{8,}$/'],
        ], [
            'phone.regex' => 'Nomor WhatsApp tidak valid.',
        ]);

        if (blank(config('services.wa.api_key'))) {
            return back()->with('error', 'WA_API_KEY belum diisi di .env.');
        }

        $app = (string) config('app.name');
        $ok = WhatsAppService::fromConfig()->sendText(
            $data['phone'],
            "Pesan uji dari {$app}. Bila pesan ini sampai, notifikasi WhatsApp sudah siap dipakai.",
        );

        return $ok
            ? back()->with('success', 'Pesan WA uji dikirim ke '.$data['phone'].'.')
            : back()->with('error', 'Pesan WA uji gagal. Pastikan token Fonnte benar dan device terhubung (detail di storage/logs).');
    }

    public function backup(): BinaryFileResponse
    {
        @set_time_limit(300);

        $path = (new BackupBuilder)->build();

        return response()
            ->download($path, BackupBuilder::filename(), ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend();
    }

    private function databaseLabel(): string
    {
        return (string) config('database.default');
    }
}
