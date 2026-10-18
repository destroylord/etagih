<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'company_name' => 'PT. eTagih',
            'company_email' => 'billing@etagih.test',
            'company_phone' => '+62 21 0000000',
            'company_address' => 'Jakarta, Indonesia',
            'invoice_prefix' => 'INV',
            'invoice_next_number' => '1',
            'invoice_padding' => '4',
            'invoice_reset_period' => 'yearly',
            'default_tax_percent' => '0',
            'default_currency' => 'IDR',
            'default_payment_terms_days' => '14',
            'default_schedule_type' => 'full',
            'default_pic_user_id' => '',
            'default_notes' => '',
            'default_footer' => 'Terima kasih atas kepercayaan Anda.',
        ];

        $existing = Setting::query()->first();
        $payload = array_merge($defaults, $existing?->only(array_keys($defaults)) ?? []);

        if ($existing) {
            $existing->update($payload);
        } else {
            Setting::create($payload);
        }
    }
}
