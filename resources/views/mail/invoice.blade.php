@php
    $company = $setting->company_name ?: config('app.name');
    $fmt = fn ($n) => 'Rp '.number_format((float) $n, 0, ',', '.');
@endphp
<!DOCTYPE html>
<html lang="id">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
        <td style="padding:28px 32px;border-bottom:1px solid #e4e4e7;">
            <div style="font-size:18px;font-weight:bold;">{{ $company }}</div>
        </td>
    </tr>
    <tr>
        <td style="padding:28px 32px;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 16px;">Halo {{ $invoice->client->name }},</p>
            @if ($isReminder)
                <p style="margin:0 0 16px;">Ini pengingat bahwa invoice berikut belum lunas.</p>
            @else
                <p style="margin:0 0 16px;">Berikut invoice dari {{ $company }}. File PDF invoice terlampir di email ini.</p>
            @endif

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#fafafa;border-radius:8px;">
                <tr><td style="padding:12px 16px;color:#71717a;">Nomor</td><td style="padding:12px 16px;text-align:right;font-weight:bold;">{{ $invoice->invoice_number }}</td></tr>
                @if ($invoice->project)
                    <tr><td style="padding:0 16px 12px;color:#71717a;">Proyek</td><td style="padding:0 16px 12px;text-align:right;">{{ $invoice->project->full_name }}</td></tr>
                @endif
                @if ($invoice->due_date)
                    <tr><td style="padding:0 16px 12px;color:#71717a;">Jatuh tempo</td><td style="padding:0 16px 12px;text-align:right;">{{ $invoice->due_date->translatedFormat('d M Y') }}</td></tr>
                @endif
                <tr><td style="padding:0 16px 12px;color:#71717a;">Total</td><td style="padding:0 16px 12px;text-align:right;">{{ $fmt($invoice->total) }}</td></tr>
                <tr><td style="padding:0 16px 12px;color:#71717a;">Sisa tagihan</td><td style="padding:0 16px 12px;text-align:right;font-weight:bold;">{{ $fmt($invoice->remainingAmount()) }}</td></tr>
            </table>

            <p style="margin:0 0 24px;text-align:center;">
                <a href="{{ $invoice->publicUrl() }}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Lihat &amp; Bayar Invoice</a>
            </p>

            @if ($setting->bank_account_info)
                <p style="margin:0 0 8px;color:#71717a;font-size:12px;">Transfer bank:</p>
                <p style="margin:0 0 16px;white-space:pre-line;font-size:13px;">{{ $setting->bank_account_info }}</p>
            @endif

            <p style="margin:0;">Terima kasih.</p>
        </td>
    </tr>
    @if ($setting->invoice_footer_text)
        <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa;text-align:center;white-space:pre-line;">{{ $setting->invoice_footer_text }}</td>
        </tr>
    @endif
</table>
</body>
</html>
