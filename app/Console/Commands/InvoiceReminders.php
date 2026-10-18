<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\PaymentSchedule;
use App\Services\WhatsAppService;
use App\Support\Settings;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Throwable;

/**
 * Pengingat pembayaran via WhatsApp. Di-schedule harian 09:00.
 *
 * 1. Sebelum jatuh tempo: H-N (Settings.reminder_days_before, default "3,1").
 * 2. Setelah jatuh tempo: diulang tiap `reminder_interval_days` hari, maksimal
 *    `reminder_max_count` kali per invoice/cicilan — supaya klien tidak dispam tiap hari.
 *
 * Invoice full diingatkan di level invoice; cicilan di level schedule
 * (tidak dobel untuk invoice yang sama).
 */
class InvoiceReminders extends Command
{
    protected $signature = 'app:invoice-reminders';

    protected $description = 'Send WA reminders before due date and (limited) after due date.';

    public function handle(WhatsAppService $wa): int
    {
        $settings = Settings::current();
        $today = now()->startOfDay();
        $interval = max(1, (int) $settings->reminder_interval_days);
        $maxCount = max(0, (int) $settings->reminder_max_count);
        $sent = 0;

        $upcomingDates = collect($settings->reminderDaysBefore())
            ->map(fn (int $d) => $today->copy()->addDays($d)->toDateString())
            ->all();

        // --- 1. Sebelum jatuh tempo -------------------------------------------------
        if ($upcomingDates !== []) {
            $invoices = Invoice::query()
                ->where('type', 'full')
                ->whereIn('status', ['sent', 'partial'])
                ->whereIn('due_date', $upcomingDates)
                ->with('client')
                ->get();

            foreach ($invoices as $invoice) {
                $sent += (int) $this->send(fn () => $wa->sendReminder($invoice, null, upcoming: true), "Invoice #{$invoice->id}");
            }

            $schedules = PaymentSchedule::query()
                ->where('status', 'pending')
                ->whereIn('due_date', $upcomingDates)
                ->whereHas('invoice', fn ($q) => $q->whereIn('status', ['sent', 'partial', 'overdue']))
                ->with('invoice.client')
                ->get();

            foreach ($schedules as $schedule) {
                $sent += (int) $this->send(fn () => $wa->sendReminder($schedule->invoice, $schedule, upcoming: true), "Schedule #{$schedule->id}");
            }
        }

        // --- 2. Setelah jatuh tempo (dibatasi) --------------------------------------
        if ($maxCount > 0) {
            $invoices = Invoice::query()
                ->where('type', 'full')
                ->whereIn('status', ['sent', 'partial', 'overdue'])
                ->whereNotNull('due_date')
                ->where('due_date', '<', $today->toDateString())
                ->where('reminder_count', '<', $maxCount)
                ->with('client')
                ->get()
                ->filter(fn (Invoice $i) => $this->isDue($i->last_reminded_at, $interval, $today));

            foreach ($invoices as $invoice) {
                if ($this->send(fn () => $wa->sendReminder($invoice), "Invoice #{$invoice->id}")) {
                    $invoice->increment('reminder_count', 1, ['last_reminded_at' => now()]);
                    $sent++;
                }
            }

            $schedules = PaymentSchedule::query()
                ->whereIn('status', ['pending', 'overdue'])
                ->where('due_date', '<', $today->toDateString())
                ->where('reminder_count', '<', $maxCount)
                ->whereHas('invoice', fn ($q) => $q->whereIn('status', ['sent', 'partial', 'overdue']))
                ->with('invoice.client')
                ->get()
                ->filter(fn (PaymentSchedule $s) => $this->isDue($s->last_reminded_at, $interval, $today));

            foreach ($schedules as $schedule) {
                if ($this->send(fn () => $wa->sendReminder($schedule->invoice, $schedule), "Schedule #{$schedule->id}")) {
                    $schedule->increment('reminder_count', 1, ['last_reminded_at' => now()]);
                    $sent++;
                }
            }
        }

        $this->info("Sent {$sent} reminder(s).");

        return self::SUCCESS;
    }

    private function isDue(?CarbonInterface $lastRemindedAt, int $interval, CarbonInterface $today): bool
    {
        return $lastRemindedAt === null
            || $lastRemindedAt->copy()->startOfDay()->addDays($interval)->lte($today);
    }

    private function send(callable $callback, string $label): bool
    {
        try {
            return (bool) $callback();
        } catch (Throwable $e) {
            $this->warn("{$label} reminder failed: {$e->getMessage()}");

            return false;
        }
    }
}
