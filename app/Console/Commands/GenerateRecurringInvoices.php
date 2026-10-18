<?php

namespace App\Console\Commands;

use App\Actions\Invoice\DuplicateInvoice;
use App\Actions\Invoice\SendInvoice;
use App\Models\Invoice;
use App\Support\Recurrence;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Throwable;

/**
 * Buat invoice baru dari invoice berulang (template) yang jadwalnya sudah tiba.
 * Di-schedule harian di routes/console.php.
 */
class GenerateRecurringInvoices extends Command
{
    protected $signature = 'invoices:generate-recurring';

    protected $description = 'Generate invoices from recurring templates whose next date has arrived.';

    /** Batas susulan per template per run (mis. server mati beberapa bulan). */
    private const MAX_CATCH_UP = 12;

    public function handle(DuplicateInvoice $duplicator, SendInvoice $sender): int
    {
        $today = now()->toDateString();
        $created = 0;

        $templates = Invoice::query()
            ->where('recurrence', '!=', 'none')
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->whereNotNull('recurrence_next_date')
            ->where('recurrence_next_date', '<=', $today)
            ->get();

        foreach ($templates as $template) {
            $runs = 0;
            while ($template->recurrence_next_date && $template->recurrence_next_date->toDateString() <= $today && $runs < self::MAX_CATCH_UP) {
                $issueDate = Carbon::parse($template->recurrence_next_date);

                try {
                    $copy = $duplicator->execute($template, $issueDate, $template->id);
                    if ($template->recurrence_auto_send) {
                        $sender->execute($copy);
                    }
                    $created++;
                } catch (Throwable $e) {
                    $this->warn("Invoice #{$template->id} recurring failed: {$e->getMessage()}");
                    break;
                }

                $template->update([
                    'recurrence_next_date' => Recurrence::next($template->recurrence, $issueDate),
                ]);
                $runs++;
            }
        }

        $this->info("Generated {$created} recurring invoice(s).");

        return self::SUCCESS;
    }
}
