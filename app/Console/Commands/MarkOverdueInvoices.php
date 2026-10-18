<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\PaymentSchedule;
use Illuminate\Console\Command;

class MarkOverdueInvoices extends Command
{
    protected $signature = 'invoices:mark-overdue';

    protected $description = 'Mark invoices + schedules overdue when past due_date AND status still non-paid.';

    public function handle(): int
    {
        $today = now()->toDateString();

        $invoiceCount = Invoice::query()
            ->whereIn('status', ['sent', 'partial'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->update(['status' => 'overdue']);

        $scheduleCount = PaymentSchedule::query()
            ->where('status', 'pending')
            ->where('due_date', '<', $today)
            ->update(['status' => 'overdue']);

        $this->info("Marked {$invoiceCount} invoice(s) overdue, {$scheduleCount} schedule(s) overdue.");

        return self::SUCCESS;
    }
}
