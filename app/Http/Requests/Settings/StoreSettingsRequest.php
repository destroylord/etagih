<?php

namespace App\Http\Requests\Settings;

use App\Http\Controllers\QrisController;
use Illuminate\Foundation\Http\FormRequest;

class StoreSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'company_name' => ['nullable', 'string', 'max:255'],
            'company_address' => ['nullable', 'string', 'max:5000'],
            'company_email' => ['nullable', 'email', 'max:255'],
            'company_phone' => ['nullable', 'string', 'max:32'],
            'bank_account_info' => ['nullable', 'string', 'max:5000'],
            'invoice_footer_text' => ['nullable', 'string', 'max:5000'],
            'app_invoice_prefix' => ['required', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/'],
            'default_hourly_rate' => ['required', 'numeric', 'min:0'],
            'default_tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],

            'reminder_days_before' => ['nullable', 'string', 'max:32', 'regex:/^\s*\d{1,2}(\s*,\s*\d{1,2})*\s*$/'],
            'reminder_interval_days' => ['nullable', 'integer', 'min:1', 'max:60'],
            'reminder_max_count' => ['nullable', 'integer', 'min:0', 'max:30'],

            'wa_template_invoice' => ['nullable', 'string', 'max:5000'],
            'wa_template_payment_received' => ['nullable', 'string', 'max:5000'],
            'wa_template_reminder' => ['nullable', 'string', 'max:5000'],
            'wa_template_reminder_upcoming' => ['nullable', 'string', 'max:5000'],

            'company_logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'company_tax_id' => ['nullable', 'string', 'max:64'],

            'invoice_terms' => ['nullable', 'string', 'max:5000'],
            'signature' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'signer_name' => ['nullable', 'string', 'max:255'],
            'signer_title' => ['nullable', 'string', 'max:255'],
            'pdf_accent_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'pdf_watermark' => ['nullable', 'in:logo,text,none'],
            'pdf_watermark_text' => ['nullable', 'string', 'max:60'],
            'stamp_duty_enabled' => ['sometimes', 'boolean'],

            ...QrisController::styleRules('qris_style'),
        ];
    }
}
