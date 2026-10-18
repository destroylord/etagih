@php
    /**
     * Template PDF kuitansi (DomPDF — CSS 2.1, layout pakai tabel, A5 landscape).
     * Variabel dari App\Support\ReceiptPdf::make():
     * $payment, $invoice, $setting, $accent, $logo, $signature, $amountInWords, $needsStamp
     */
    $rp = fn ($v) => 'Rp '.number_format((float) $v, 0, ',', '.');
    $date = fn ($d) => $d ? $d->locale('id')->translatedFormat('j F Y') : '-';

    $companyName = $setting->company_name ?: config('app.name');
    $paidAt = $payment->paid_at ?? $payment->created_at;

    // Metode: QRIS, atau manual → Tunai bila catatan menyebut tunai/cash, selain itu transfer.
    $notes = trim((string) $payment->notes);
    $method = match (true) {
        $payment->method === 'qris' => 'QRIS',
        (bool) preg_match('/\b(tunai|cash)\b/i', $notes) => 'Tunai',
        default => 'Transfer bank',
    };

    // "Untuk pembayaran": invoice + proyek + cicilan ke-N.
    $purpose = 'Pembayaran invoice '.$invoice->invoice_number;
    if ($payment->schedule) {
        $count = $invoice->schedules()->count();
        $purpose .= ' — cicilan ke-'.$payment->schedule->sequence.($count ? ' dari '.$count : '');
    } elseif ($invoice->status === 'paid' && (float) $payment->amount >= (float) $invoice->total) {
        $purpose = 'Pelunasan invoice '.$invoice->invoice_number;
    }
    $project = $invoice->project?->full_name;
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Kuitansi {{ $payment->receipt_number }}</title>
    <style>
        @page { margin: 28px 34px 46px 34px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; line-height: 1.45; color: #1e293b; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        td, th { vertical-align: top; padding: 0; }
        .right { text-align: right; }
        .center { text-align: center; }
        .muted { color: #64748b; }
        .small { font-size: 8.5px; }
        .bold { font-weight: bold; }
        .label { font-size: 7.5px; font-weight: bold; letter-spacing: 1.2px; text-transform: uppercase; color: #64748b; }

        .topbar { position: fixed; top: -28px; left: -34px; right: -34px; height: 6px; background: {{ $accent }}; }
        .footer { position: fixed; bottom: -30px; left: 0; right: 0; height: 20px; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 7px; color: #94a3b8; }

        .brand-name { font-size: 14px; font-weight: bold; color: #0f172a; }
        .logo { max-height: 44px; max-width: 170px; }
        .company-info { margin-top: 4px; font-size: 8px; color: #475569; line-height: 1.45; }
        .doc-title { font-size: 24px; font-weight: bold; letter-spacing: 6px; color: {{ $accent }}; }
        .doc-number { font-size: 10.5px; font-weight: bold; color: #0f172a; margin-top: 2px; }

        .fields { margin-top: 14px; border-top: 1px solid #e2e8f0; }
        .fields td { padding: 7px 0; border-bottom: 1px dotted #cbd5e1; }
        .fields td.key { width: 130px; color: #64748b; padding-right: 8px; }
        .fields td.sep { width: 10px; color: #64748b; }
        .fields .value { font-size: 10.5px; color: #0f172a; }
        .words { padding: 6px 9px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid {{ $accent }}; font-size: 11px; font-weight: bold; font-style: italic; color: #0f172a; }

        .closing { margin-top: 16px; page-break-inside: avoid; }
        .amount-box { display: inline-block; border: 2px solid {{ $accent }}; padding: 8px 16px; font-size: 18px; font-weight: bold; color: #0f172a; }
        .stamp { width: 96px; height: 70px; border: 1.5px dashed #94a3b8; color: #64748b; font-size: 7.5px; text-align: center; padding-top: 18px; line-height: 1.4; }
        .sign { text-align: center; }
        .sign-img { max-height: 56px; max-width: 160px; }
        .sign-space { height: 56px; }
        .sign-line { border-top: 1px solid #0f172a; margin: 3px 10px 0; padding-top: 3px; font-weight: bold; color: #0f172a; font-size: 9.5px; }
    </style>
</head>
<body>
    <div class="topbar"></div>

    <div class="footer">
        {{ $companyName }}@if($setting->company_email) &middot; {{ $setting->company_email }}@endif @if($setting->company_phone) &middot; {{ $setting->company_phone }}@endif
        &middot; Kuitansi ini diterbitkan secara elektronik sebagai bukti penerimaan pembayaran.
    </div>

    {{-- ===== Header ===== --}}
    <table>
        <tr>
            <td style="width: 60%;">
                @if($logo)
                    <img class="logo" src="{{ $logo }}" alt="{{ $companyName }}">
                    <div class="brand-name" style="font-size: 11px; margin-top: 4px;">{{ $companyName }}</div>
                @else
                    <div class="brand-name">{{ $companyName }}</div>
                @endif
                <div class="company-info">
                    @if($setting->company_address){!! nl2br(e($setting->company_address)) !!}<br>@endif
                    @if($setting->company_tax_id)NPWP: {{ $setting->company_tax_id }}@endif
                </div>
            </td>
            <td class="right">
                <div class="doc-title">KUITANSI</div>
                <div class="doc-number">No. {{ $payment->receipt_number ?: '-' }}</div>
                <div class="small muted" style="margin-top: 2px;">Tanggal: {{ $date($paidAt) }}</div>
            </td>
        </tr>
    </table>

    {{-- ===== Isi kuitansi ===== --}}
    <table class="fields">
        <tr>
            <td class="key">Telah terima dari</td>
            <td class="sep">:</td>
            <td class="value bold">{{ $invoice->client->name }}</td>
        </tr>
        <tr>
            <td class="key">Uang sejumlah</td>
            <td class="sep">:</td>
            <td><div class="words">{{ $amountInWords }}</div></td>
        </tr>
        <tr>
            <td class="key">Untuk pembayaran</td>
            <td class="sep">:</td>
            <td class="value">
                {{ $purpose }}
                @if($project)<br><span class="small muted">Proyek: {{ $project }}</span>@endif
            </td>
        </tr>
        <tr>
            <td class="key">Metode pembayaran</td>
            <td class="sep">:</td>
            <td class="value">
                {{ $method }}
                @if($notes !== '')<span class="small muted"> — {{ $notes }}</span>@endif
            </td>
        </tr>
    </table>

    {{-- ===== Nominal + (meterai) + tanda tangan ===== --}}
    <table class="closing">
        <tr>
            <td style="vertical-align: bottom; padding-bottom: 14px;">
                <div class="label" style="margin-bottom: 4px;">Jumlah</div>
                <div class="amount-box">{{ $rp($payment->amount) }}</div>
            </td>
            @if($needsStamp)
                <td style="width: 112px; vertical-align: bottom; padding-bottom: 10px;">
                    <div class="stamp">Tempel<br><strong>e-Meterai</strong><br>Rp10.000</div>
                </td>
            @endif
            <td style="width: 190px;" class="sign">
                <div class="small muted">{{ $date($paidAt) }}</div>
                <div class="small" style="margin-bottom: 4px;">Penerima,</div>
                @if($signature)
                    <img class="sign-img" src="{{ $signature }}" alt="Tanda tangan">
                @else
                    <div class="sign-space"></div>
                @endif
                <div class="sign-line">{{ $setting->signer_name ?: $companyName }}</div>
                <div class="small muted">{{ $setting->signer_title ?: ($setting->signer_name ? $companyName : 'Bagian Keuangan') }}</div>
            </td>
        </tr>
    </table>
</body>
</html>
