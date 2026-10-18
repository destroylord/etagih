@php
    /**
     * Template PDF penawaran harga (DomPDF — CSS 2.1, layout pakai tabel).
     * Variabel dari App\Support\QuotePdf::make():
     * $quote, $setting, $accent, $logo, $signature, $linkQr, $terms, $amountInWords
     */
    $rp = fn ($v) => 'Rp '.number_format((float) $v, 0, ',', '.');
    $num = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',');
    $date = fn ($d) => $d ? $d->locale('id')->translatedFormat('j F Y') : '-';

    $status = $quote->status;
    $isExpired = $status === 'expired' || ($status === 'sent' && $quote->isPastValidity());
    $isAccepted = in_array($status, ['accepted', 'converted'], true);
    $statusLabels = [
        'draft' => 'Draft', 'sent' => 'Menunggu Persetujuan', 'accepted' => 'Diterima',
        'declined' => 'Ditolak', 'expired' => 'Kedaluwarsa', 'converted' => 'Diterima',
    ];
    $statusColor = match (true) {
        $isAccepted => '#047857',
        $status === 'declined', $isExpired => '#b91c1c',
        default => '#334155',
    };

    $companyName = $setting->company_name ?: config('app.name');
    $statusWatermark = match (true) {
        $status === 'draft' => 'DRAFT',
        $status === 'declined' => 'DITOLAK',
        $isExpired => 'KEDALUWARSA',
        default => null,
    };

    $watermarkMode = $setting->pdf_watermark ?: 'logo';
    if ($watermarkMode === 'logo' && ! $logo) {
        $watermarkMode = 'text';
    }
    $watermarkText = $setting->pdf_watermark_text ?: $companyName;
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Penawaran {{ $quote->quote_number }}</title>
    <style>
        @page { margin: 34px 42px 64px 42px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; line-height: 1.45; color: #1e293b; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        td, th { vertical-align: top; padding: 0; }
        .right { text-align: right; }
        .center { text-align: center; }
        .muted { color: #64748b; }
        .small { font-size: 8.5px; }
        .bold { font-weight: bold; }
        .accent { color: {{ $accent }}; }
        .label { font-size: 7.5px; font-weight: bold; letter-spacing: 1.2px; text-transform: uppercase; color: #64748b; }

        .topbar { position: fixed; top: -34px; left: -42px; right: -42px; height: 7px; background: {{ $accent }}; }
        .footer { position: fixed; bottom: -44px; left: 0; right: 0; height: 30px; border-top: 1px solid #e2e8f0; padding-top: 7px; font-size: 7.5px; color: #94a3b8; }
        .wm { position: fixed; top: 345px; left: 0; right: 0; text-align: center; z-index: -10; }
        .wm-logo { width: 330px; opacity: 0.055; }
        .wm-text { font-size: 58px; font-weight: bold; color: {{ $accent }}; opacity: 0.05; letter-spacing: 6px; transform: rotate(-30deg); }
        .wm-status { position: fixed; top: 340px; left: -40px; right: -40px; text-align: center; z-index: -9; font-size: 70px; font-weight: bold; letter-spacing: 8px; transform: rotate(-30deg); opacity: 0.11; }

        .brand-name { font-size: 17px; font-weight: bold; color: #0f172a; }
        .logo { max-height: 58px; max-width: 210px; }
        .company-info { margin-top: 7px; font-size: 8.5px; color: #475569; line-height: 1.5; }
        .doc-title { font-size: 22px; font-weight: bold; letter-spacing: 3px; color: {{ $accent }}; }
        .doc-number { font-size: 11px; font-weight: bold; color: #0f172a; margin-top: 2px; }
        .status-pill { display: inline-block; margin-top: 7px; padding: 3px 9px; border: 1px solid {{ $statusColor }}; color: {{ $statusColor }}; border-radius: 9px; font-size: 7.5px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }

        .meta { margin-top: 18px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
        .meta td { padding: 9px 10px; border-right: 1px solid #e2e8f0; }
        .meta td.last { border-right: 0; }
        .meta .value { font-size: 10px; font-weight: bold; color: #0f172a; margin-top: 2px; }

        .parties { margin-top: 18px; }
        .party-name { font-size: 11.5px; font-weight: bold; color: #0f172a; margin: 4px 0 2px; }
        .due-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid {{ $accent }}; padding: 11px 13px; }
        .due-amount { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 3px; }

        .items { margin-top: 20px; }
        .items th { background: {{ $accent }}; color: #ffffff; font-size: 7.5px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding: 8px 9px; text-align: left; }
        .items th.right { text-align: right; }
        .items td { padding: 8px 9px; border-bottom: 1px solid #e2e8f0; }
        .items tr.zebra td { background: #f8fafc; }
        .items tr.group td { background: #eef2f7; font-weight: bold; color: #0f172a; padding: 6px 9px; border-bottom: 1px solid #dbe2ea; }
        .items .no { width: 26px; color: #94a3b8; }

        .summary { margin-top: 16px; page-break-inside: avoid; }
        .totals td { padding: 5px 10px; }
        .totals .sep td { border-top: 1px solid #e2e8f0; }
        .totals .grand td { background: {{ $accent }}; color: #ffffff; font-size: 12px; font-weight: bold; padding: 9px 10px; }
        .words { margin-top: 10px; padding: 8px 10px; background: #f8fafc; border: 1px dashed #cbd5e1; font-size: 8.5px; font-style: italic; color: #334155; }
        .link-box { border: 1px solid #e2e8f0; padding: 10px 12px; }
        .link-box .title { font-size: 9px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
        .qr { width: 78px; height: 78px; }

        .closing { margin-top: 22px; page-break-inside: avoid; }
        .terms { margin: 0; padding-left: 14px; color: #475569; font-size: 8.5px; }
        .terms li { margin-bottom: 3px; }
        .note { color: #334155; font-size: 9px; margin-bottom: 10px; }
        .sign { text-align: center; }
        .sign-img { max-height: 70px; max-width: 190px; }
        .sign-space { height: 70px; }
        .sign-line { border-top: 1px solid #0f172a; margin: 4px 18px 0; padding-top: 4px; font-weight: bold; color: #0f172a; font-size: 10px; }

        .notice { margin-top: 14px; padding: 9px 12px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 9px; }
        .notice-ok { margin-top: 14px; padding: 9px 12px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #065f46; font-size: 9px; }
        .stamp { display: inline-block; padding: 5px 14px; border: 3px solid #047857; color: #047857; font-size: 15px; font-weight: bold; letter-spacing: 4px; transform: rotate(-8deg); }
    </style>
</head>
<body>

    <div class="topbar"></div>

    @if($statusWatermark)
        <div class="wm-status" style="color: {{ $statusWatermark === 'DRAFT' ? '#64748b' : '#dc2626' }};">{{ $statusWatermark }}</div>
    @elseif($watermarkMode === 'logo')
        <div class="wm"><img class="wm-logo" src="{{ $logo }}" alt=""></div>
    @elseif($watermarkMode === 'text')
        <div class="wm"><div class="wm-text">{{ $watermarkText }}</div></div>
    @endif

    <div class="footer">
        <table>
            <tr>
                <td style="width: 70%;">
                    {{ $companyName }}@if($setting->company_email) &middot; {{ $setting->company_email }}@endif @if($setting->company_phone) &middot; {{ $setting->company_phone }}@endif
                    <br>Penawaran ini bukan tagihan. Invoice diterbitkan setelah penawaran disetujui.
                </td>
                <td class="right"></td>
            </tr>
        </table>
    </div>

    {{-- ===== Header ===== --}}
    <table>
        <tr>
            <td style="width: 55%;">
                @if($logo)
                    <img class="logo" src="{{ $logo }}" alt="{{ $companyName }}">
                    <div class="brand-name" style="font-size: 12px; margin-top: 6px;">{{ $companyName }}</div>
                @else
                    <div class="brand-name">{{ $companyName }}</div>
                @endif
                <div class="company-info">
                    @if($setting->company_address){!! nl2br(e($setting->company_address)) !!}<br>@endif
                    @if($setting->company_phone)Telp. {{ $setting->company_phone }}@endif
                    @if($setting->company_phone && $setting->company_email) &nbsp;|&nbsp; @endif
                    @if($setting->company_email){{ $setting->company_email }}@endif
                    @if($setting->company_tax_id)<br>NPWP: {{ $setting->company_tax_id }}@endif
                </div>
            </td>
            <td class="right">
                <div class="doc-title">PENAWARAN HARGA</div>
                <div class="doc-number"># {{ $quote->quote_number }}</div>
                <div class="status-pill">{{ $isExpired ? 'Kedaluwarsa' : ($statusLabels[$status] ?? $status) }}</div>
            </td>
        </tr>
    </table>

    {{-- ===== Meta ===== --}}
    <table class="meta">
        <tr>
            <td style="width: 33%;">
                <div class="label">Tanggal Penawaran</div>
                <div class="value">{{ $date($quote->issue_date) }}</div>
            </td>
            <td style="width: 33%;">
                <div class="label">Berlaku Sampai</div>
                <div class="value">{{ $quote->valid_until ? $date($quote->valid_until) : 'Tidak dibatasi' }}</div>
            </td>
            <td class="last" style="width: 34%;">
                <div class="label">Proyek</div>
                <div class="value">{{ $quote->project ? $quote->project->full_name : '-' }}</div>
            </td>
        </tr>
    </table>

    @if($status === 'declined')
        <div class="notice">
            <strong>Penawaran ini ditolak</strong>@if($quote->declined_at) pada {{ $date($quote->declined_at) }}@endif.
            @if($quote->decline_reason)<br>Alasan: {{ $quote->decline_reason }}@endif
        </div>
    @elseif($isExpired)
        <div class="notice"><strong>Masa berlaku penawaran ini sudah habis.</strong> Hubungi kami untuk penawaran terbaru.</div>
    @elseif($isAccepted && $quote->accepted_at)
        <div class="notice-ok">
            <strong>Penawaran disetujui</strong> pada {{ $date($quote->accepted_at) }}@if($quote->accepted_by) oleh {{ $quote->accepted_by }}@endif.
        </div>
    @endif

    {{-- ===== Para pihak ===== --}}
    <table class="parties">
        <tr>
            <td style="width: 55%; padding-right: 20px;">
                <div class="label">Ditujukan Kepada</div>
                <div class="party-name">{{ $quote->client->name }}</div>
                <div class="muted" style="font-size: 9px;">
                    @if($quote->client->address){!! nl2br(e($quote->client->address)) !!}<br>@endif
                    @if($quote->client->phone){{ $quote->client->phone }}<br>@endif
                    @if($quote->client->email){{ $quote->client->email }}@endif
                </div>
            </td>
            <td style="width: 45%;">
                @if($isAccepted)
                    <div class="center" style="padding-top: 10px;"><span class="stamp">DITERIMA</span></div>
                @else
                    <div class="due-box">
                        <div class="label">Nilai Penawaran</div>
                        <div class="due-amount">{{ $rp($quote->total) }}</div>
                        <div class="muted small" style="margin-top: 2px;">
                            @if($quote->valid_until)Berlaku sampai {{ $date($quote->valid_until) }}@else Harga dapat berubah sewaktu-waktu @endif
                        </div>
                    </div>
                @endif
            </td>
        </tr>
    </table>

    {{-- ===== Rincian item ===== --}}
    <table class="items">
        <thead>
            <tr>
                <th class="no">No</th>
                <th>Deskripsi</th>
                <th class="right" style="width: 50px;">Qty</th>
                <th class="right" style="width: 92px;">Harga Satuan</th>
                <th class="right" style="width: 100px;">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            @php
                $no = 0;
                $byProject = $quote->items->contains(fn ($i) => $i->project_id !== null);
                $groups = $byProject
                    ? $quote->items->groupBy(fn ($i) => $i->project_id ?: 'quote')
                    : $quote->items->groupBy(fn ($i) => $i->product_id ?: 'manual');
            @endphp
            @foreach($groups as $key => $group)
                @php
                    $groupName = $byProject
                        ? ($group->first()->project?->name ?? ($quote->project?->name ?? 'Umum'))
                        : $group->first()->product?->name;
                @endphp
                @if($groupName)
                    <tr class="group">
                        <td colspan="4">{{ $groupName }}</td>
                        <td class="right">@if($byProject){{ $rp($group->sum(fn ($i) => (float) $i->line_total)) }}@endif</td>
                    </tr>
                @endif
                @foreach($group as $item)
                    @php $no++; @endphp
                    <tr class="{{ $no % 2 === 0 ? 'zebra' : '' }}">
                        <td class="no">{{ $no }}</td>
                        <td style="{{ $groupName ? 'padding-left: 18px;' : '' }}">
                            @if($byProject && $item->product)<span class="bold">{{ $item->product->name }}</span> — @endif{!! nl2br(e($item->description)) !!}
                        </td>
                        <td class="right">{{ $num($item->quantity) }}</td>
                        <td class="right">{{ $rp($item->unit_price) }}</td>
                        <td class="right bold">{{ $rp($item->line_total) }}</td>
                    </tr>
                @endforeach
            @endforeach
        </tbody>
    </table>

    {{-- ===== Ringkasan ===== --}}
    <table class="summary">
        <tr>
            <td style="width: 53%; padding-right: 22px;">
                @if($linkQr)
                    <div class="link-box">
                        <table>
                            <tr>
                                <td>
                                    <div class="title">Setujui Penawaran Online</div>
                                    <div class="small">
                                        Scan kode QR atau buka link berikut untuk menerima atau menolak penawaran:<br>
                                        <span class="accent">{{ $quote->publicUrl() }}</span>
                                    </div>
                                </td>
                                <td style="width: 86px;" class="right"><img class="qr" src="{{ $linkQr }}" alt="QR"></td>
                            </tr>
                        </table>
                    </div>
                @endif
                <div class="words"><span class="bold" style="font-style: normal;">Terbilang:</span> {{ $amountInWords }}</div>
            </td>
            <td style="width: 47%;">
                <table class="totals">
                    <tr><td class="muted">Subtotal</td><td class="right">{{ $rp($quote->subtotal) }}</td></tr>
                    @if((float) $quote->discount > 0)
                        <tr>
                            <td class="muted">Diskon @if($quote->discount_type === 'percent')({{ $num($quote->discount_value) }}%)@endif</td>
                            <td class="right">- {{ $rp($quote->discount) }}</td>
                        </tr>
                    @endif
                    @php $hasPph = (float) $quote->pph_amount > 0; @endphp
                    @if(((float) $quote->tax_amount > 0 || $hasPph) && (float) $quote->discount > 0)
                        <tr class="sep"><td class="muted">Dasar Pengenaan Pajak</td><td class="right">{{ $rp((float) $quote->subtotal - (float) $quote->discount) }}</td></tr>
                    @endif
                    @if((float) $quote->tax_amount > 0)
                        <tr><td class="muted">PPN {{ $num($quote->tax_rate) }}%</td><td class="right">{{ $rp($quote->tax_amount) }}</td></tr>
                    @endif
                    @if($hasPph)
                        <tr class="sep"><td class="muted">Total sebelum PPh</td><td class="right">{{ $rp($quote->grossTotal()) }}</td></tr>
                        <tr><td class="muted">PPh 23 ({{ $num($quote->pph_rate) }}%) dipotong klien</td><td class="right">- {{ $rp($quote->pph_amount) }}</td></tr>
                    @endif
                    <tr class="grand"><td>{{ $hasPph ? 'TOTAL DIBAYAR' : 'TOTAL' }}</td><td class="right">{{ $rp($quote->total) }}</td></tr>
                </table>
            </td>
        </tr>
    </table>

    {{-- ===== Catatan, syarat & tanda tangan ===== --}}
    <table class="closing">
        <tr>
            <td style="width: 62%; padding-right: 26px;">
                @if($quote->notes)
                    <div class="label" style="margin-bottom: 3px;">Catatan</div>
                    <div class="note">{!! nl2br(e($quote->notes)) !!}</div>
                @endif
                @if(count($terms))
                    <div class="label" style="margin-bottom: 4px;">Syarat &amp; Ketentuan Penawaran</div>
                    <ol class="terms">
                        @foreach($terms as $term)
                            <li>{{ $term }}</li>
                        @endforeach
                    </ol>
                @endif
                @if($setting->invoice_footer_text)
                    <div class="small muted" style="margin-top: 8px; font-style: italic;">{!! nl2br(e($setting->invoice_footer_text)) !!}</div>
                @endif
            </td>
            <td style="width: 38%;" class="sign">
                <div class="small muted">{{ $date($quote->issue_date) }}</div>
                <div class="small" style="margin-bottom: 6px;">Hormat kami,</div>
                @if($signature)
                    <img class="sign-img" src="{{ $signature }}" alt="Tanda tangan">
                @else
                    <div class="sign-space"></div>
                @endif
                <div class="sign-line">{{ $setting->signer_name ?: $companyName }}</div>
                <div class="small muted">{{ $setting->signer_title ?: ($setting->signer_name ? $companyName : '') }}</div>
                @if($setting->signer_name && $setting->signer_title)
                    <div class="small muted">{{ $companyName }}</div>
                @endif
            </td>
        </tr>
    </table>

</body>
</html>
