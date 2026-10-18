@php
    $fmt = fn ($n) => 'Rp '.number_format((float) $n, 0, ',', '.');
    $color = $accepted ? '#047857' : '#b91c1c';
@endphp
<!DOCTYPE html>
<html lang="id">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
        <td style="padding:24px 32px;border-bottom:4px solid {{ $color }};">
            <div style="font-size:18px;font-weight:bold;color:{{ $color }};">
                Penawaran {{ $accepted ? 'diterima' : 'ditolak' }}
            </div>
        </td>
    </tr>
    <tr>
        <td style="padding:28px 32px;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 16px;">
                <strong>{{ $quote->client->name }}</strong> {{ $accepted ? 'menerima' : 'menolak' }} penawaran
                <strong>{{ $quote->quote_number }}</strong> senilai {{ $fmt($quote->total) }}.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#fafafa;border-radius:8px;">
                @if ($accepted && $quote->accepted_by)
                    <tr><td style="padding:12px 16px;color:#71717a;">Disetujui oleh</td><td style="padding:12px 16px;text-align:right;">{{ $quote->accepted_by }}</td></tr>
                @endif
                @if ($accepted && $quote->response_note)
                    <tr><td style="padding:12px 16px;color:#71717a;">Catatan klien</td><td style="padding:12px 16px;text-align:right;white-space:pre-line;">{{ $quote->response_note }}</td></tr>
                @endif
                @if (! $accepted)
                    <tr><td style="padding:12px 16px;color:#71717a;">Alasan</td><td style="padding:12px 16px;text-align:right;white-space:pre-line;">{{ $quote->decline_reason ?: '—' }}</td></tr>
                @endif
            </table>

            <p style="margin:0 0 16px;text-align:center;">
                <a href="{{ $adminUrl }}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Buka penawaran</a>
            </p>
            @if ($accepted)
                <p style="margin:0;color:#71717a;font-size:13px;text-align:center;">Langkah berikutnya: klik <strong>Ubah jadi invoice</strong> di halaman penawaran.</p>
            @endif
        </td>
    </tr>
</table>
</body>
</html>
