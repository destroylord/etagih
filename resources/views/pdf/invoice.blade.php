@php
    /**
     * Template PDF invoice (DomPDF — CSS 2.1, layout pakai tabel).
     * Variabel dari App\Support\InvoicePdf::make():
     * $invoice, $setting, $accent, $logo, $signature, $payQr, $terms, $amountInWords
     */
    $rp = fn ($v) => 'Rp '.number_format((float) $v, 0, ',', '.');
    $num = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',');
    $date = fn ($d) => $d ? $d->locale('id')->translatedFormat('j F Y') : '-';

    $status = $invoice->status;
    $isCancelled = $status === 'cancelled';
    $isPaid = $status === 'paid';
    $isDraft = $status === 'draft';
    $statusLabels = [
        'draft' => 'Draft', 'sent' => 'Belum Dibayar', 'partial' => 'Dibayar Sebagian',
        'paid' => 'Lunas', 'overdue' => 'Jatuh Tempo', 'cancelled' => 'Dibatalkan',
        'pending' => 'Menunggu', 'expired' => 'Kedaluwarsa',
    ];
    $statusColor = match ($status) {
        'paid' => '#047857',
        'overdue', 'cancelled' => '#b91c1c',
        'partial' => '#b45309',
        default => '#334155',
    };

    $showHours = $invoice->invoice_mode === 'hourly';
    $cols = $showHours ? 5 : 4;
    $companyName = $setting->company_name ?: config('app.name');
    $remaining = $invoice->remainingAmount();

    // Watermark merek (logo / teks) — dimatikan bila status sudah punya watermark sendiri.
    $watermarkMode = $setting->pdf_watermark ?: 'logo';
    if ($watermarkMode === 'logo' && ! $logo) {
        $watermarkMode = 'text';
    }
    $watermarkText = $setting->pdf_watermark_text ?: $companyName;
    $statusWatermark = $isCancelled ? 'DIBATALKAN' : ($isDraft ? 'DRAFT' : null);

    $hasPaymentInfo = ! $isPaid && ! $isCancelled && ($setting->bank_account_info || $payQr);
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_number }}</title>
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

        /* ---- Elemen tetap di setiap halaman ---- */
        .topbar { position: fixed; top: -34px; left: -42px; right: -42px; height: 7px; background: {{ $accent }}; }
        .footer { position: fixed; bottom: -44px; left: 0; right: 0; height: 30px; border-top: 1px solid #e2e8f0; padding-top: 7px; font-size: 7.5px; color: #94a3b8; }
        .wm { position: fixed; top: 345px; left: 0; right: 0; text-align: center; z-index: -10; }
        .wm-logo { width: 330px; opacity: 0.055; }
        .wm-text { font-size: 58px; font-weight: bold; color: {{ $accent }}; opacity: 0.05; letter-spacing: 6px; transform: rotate(-30deg); }
        .wm-status { position: fixed; top: 340px; left: -40px; right: -40px; text-align: center; z-index: -9; font-size: 74px; font-weight: bold; letter-spacing: 10px; transform: rotate(-30deg); opacity: 0.11; }

        /* ---- Header ---- */
        .brand-name { font-size: 17px; font-weight: bold; color: #0f172a; }
        .logo { max-height: 58px; max-width: 210px; }
        .company-info { margin-top: 7px; font-size: 8.5px; color: #475569; line-height: 1.5; }
        .doc-title { font-size: 28px; font-weight: bold; letter-spacing: 5px; color: {{ $accent }}; }
        .doc-number { font-size: 11px; font-weight: bold; color: #0f172a; margin-top: 2px; }
        .status-pill { display: inline-block; margin-top: 7px; padding: 3px 9px; border: 1px solid {{ $statusColor }}; color: {{ $statusColor }}; border-radius: 9px; font-size: 7.5px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }

        /* ---- Meta & pihak ---- */
        .meta { margin-top: 18px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
        .meta td { padding: 9px 10px; border-right: 1px solid #e2e8f0; }
        .meta td.last { border-right: 0; }
        .meta .value { font-size: 10px; font-weight: bold; color: #0f172a; margin-top: 2px; }

        .parties { margin-top: 18px; }
        .party-name { font-size: 11.5px; font-weight: bold; color: #0f172a; margin: 4px 0 2px; }
        .due-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid {{ $accent }}; padding: 11px 13px; }
        .due-amount { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 3px; }

        /* ---- Item ---- */
        .items { margin-top: 20px; }
        .items th { background: {{ $accent }}; color: #ffffff; font-size: 7.5px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding: 8px 9px; text-align: left; }
        .items th.right { text-align: right; }
        .items td { padding: 8px 9px; border-bottom: 1px solid #e2e8f0; }
        .items tr.zebra td { background: #f8fafc; }
        .items tr.group td { background: #eef2f7; font-weight: bold; color: #0f172a; padding: 6px 9px; border-bottom: 1px solid #dbe2ea; }
        .items .no { width: 26px; color: #94a3b8; }

        /* ---- Ringkasan ---- */
        .summary { margin-top: 16px; page-break-inside: avoid; }
        .totals td { padding: 5px 10px; }
        .totals .sep td { border-top: 1px solid #e2e8f0; }
        .totals .grand td { background: {{ $accent }}; color: #ffffff; font-size: 12px; font-weight: bold; padding: 9px 10px; }
        .totals .due td { font-size: 11px; font-weight: bold; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 7px; }
        .words { margin-top: 10px; padding: 8px 10px; background: #f8fafc; border: 1px dashed #cbd5e1; font-size: 8.5px; font-style: italic; color: #334155; }
        .pay-box { border: 1px solid #e2e8f0; padding: 10px 12px; }
        .pay-box .title { font-size: 9px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
        .qr { width: 78px; height: 78px; }

        /* ---- Cicilan ---- */
        .section-title { font-size: 9px; font-weight: bold; letter-spacing: 1.2px; text-transform: uppercase; color: {{ $accent }}; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 20px 0 6px; }
        .sched td, .sched th { padding: 5px 8px; border-bottom: 1px solid #eef2f7; text-align: left; }
        .sched th { font-size: 7.5px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }

        /* ---- Catatan & tanda tangan ---- */
        .closing { margin-top: 22px; page-break-inside: avoid; }
        .terms { margin: 0; padding-left: 14px; color: #475569; font-size: 8.5px; }
        .terms li { margin-bottom: 3px; }
        .note { color: #334155; font-size: 9px; margin-bottom: 10px; }
        .sign { text-align: center; }
        .sign-img { max-height: 70px; max-width: 190px; }
        .sign-space { height: 70px; }
        .sign-line { border-top: 1px solid #0f172a; margin: 4px 18px 0; padding-top: 4px; font-weight: bold; color: #0f172a; font-size: 10px; }

        .notice { margin-top: 14px; padding: 9px 12px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 9px; }
        .paid-stamp { display: inline-block; padding: 5px 14px; border: 3px solid #047857; color: #047857; font-size: 15px; font-weight: bold; letter-spacing: 4px; transform: rotate(-8deg); }
    </style>
</head>
<body>

    {{-- ===== Elemen tetap (semua halaman) ===== --}}
    <div class="topbar"></div>

    @if($statusWatermark)
        <div class="wm-status" style="color: {{ $isCancelled ? '#dc2626' : '#64748b' }};">{{ $statusWatermark }}</div>
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
                    <br>Dokumen ini diterbitkan secara elektronik dan sah tanpa cap basah.
                </td>
                <td class="right">{{-- nomor halaman ditambahkan via canvas --}}</td>
            </tr>
        </table>
    </div>

    {{-- ===== Header ===== --}}
    <table>
        <tr>
            <td style="width: 58%;">
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
                <div class="doc-title">INVOICE</div>
                <div class="doc-number"># {{ $invoice->invoice_number }}</div>
                <div class="status-pill">{{ $statusLabels[$status] ?? $status }}</div>
            </td>
        </tr>
    </table>

    {{-- ===== Meta ===== --}}
    <table class="meta">
        <tr>
            <td style="width: 25%;">
                <div class="label">Tanggal Terbit</div>
                <div class="value">{{ $date($invoice->issue_date) }}</div>
            </td>
            <td style="width: 25%;">
                <div class="label">Jatuh Tempo</div>
                <div class="value">{{ $invoice->due_date ? $date($invoice->due_date) : 'Saat diterima' }}</div>
            </td>
            <td style="width: 25%;">
                <div class="label">Skema Pembayaran</div>
                <div class="value">{{ $invoice->type === 'installment' ? 'Cicilan '.$invoice->schedules->count().'x' : 'Pembayaran Penuh' }}</div>
            </td>
            <td class="last" style="width: 25%;">
                @if($invoice->project)
                    <div class="label">Proyek</div>
                    <div class="value">{{ $invoice->project->full_name }}</div>
                @else
                    <div class="label">Jenis Tagihan</div>
                    <div class="value">{{ $showHours ? 'Per Jam' : 'Jasa / Proyek' }}</div>
                @endif
            </td>
        </tr>
    </table>

    @if($isCancelled)
        <div class="notice">
            <strong>Invoice ini telah dibatalkan</strong>@if($invoice->cancelled_at) pada {{ $date($invoice->cancelled_at) }}@endif dan tidak perlu dibayar.
            @if($invoice->cancel_reason)<br>Alasan: {{ $invoice->cancel_reason }}@endif
        </div>
    @endif

    {{-- ===== Para pihak ===== --}}
    <table class="parties">
        <tr>
            <td style="width: 55%; padding-right: 20px;">
                <div class="label">Ditagihkan Kepada</div>
                <div class="party-name">{{ $invoice->client->name }}</div>
                <div class="muted" style="font-size: 9px;">
                    @if($invoice->client->address){!! nl2br(e($invoice->client->address)) !!}<br>@endif
                    @if($invoice->client->phone){{ $invoice->client->phone }}<br>@endif
                    @if($invoice->client->email){{ $invoice->client->email }}@endif
                </div>
            </td>
            <td style="width: 45%;">
                @if($isPaid)
                    <div class="center" style="padding-top: 10px;"><span class="paid-stamp">LUNAS</span></div>
                @elseif(! $isCancelled)
                    <div class="due-box">
                        <div class="label">{{ (float) $invoice->paid_amount > 0 ? 'Sisa Tagihan' : 'Jumlah yang Harus Dibayar' }}</div>
                        <div class="due-amount">{{ $rp($remaining) }}</div>
                        <div class="muted small" style="margin-top: 2px;">
                            @if($invoice->due_date)Paling lambat {{ $date($invoice->due_date) }}@else Dibayarkan saat invoice diterima @endif
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
                @if($showHours)<th class="right" style="width: 54px;">Jam</th>@endif
                <th class="right" style="width: 98px;">{{ $showHours ? 'Tarif / Jam' : 'Harga' }}</th>
                <th class="right" style="width: 104px;">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            @php
                $no = 0;
                // Item yang ditautkan ke sub-proyek → kelompokkan per sub-proyek
                // (dengan subtotal); selain itu kelompokkan per produk seperti biasa.
                $byProject = $invoice->items->contains(fn ($i) => $i->project_id !== null);
                $groups = $byProject
                    ? $invoice->items->groupBy(fn ($i) => $i->project_id ?: 'invoice')
                    : $invoice->items->groupBy(fn ($i) => $i->product_id ?: 'manual');
            @endphp
            @foreach($groups as $key => $group)
                @php
                    $groupName = $byProject
                        ? ($group->first()->project?->name ?? ($invoice->project?->name ?? 'Umum'))
                        : $group->first()->product?->name;
                @endphp
                @if($groupName)
                    <tr class="group">
                        <td colspan="{{ $cols - 1 }}">{{ $groupName }}</td>
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
                        @if($showHours)
                            @php $hours = (float) $item->hours_qty; @endphp
                            <td class="right">{{ $hours > 0 ? $num($hours) : '-' }}</td>
                        @endif
                        <td class="right">{{ $rp($item->unit_price) }}</td>
                        <td class="right bold">{{ $rp($item->line_total) }}</td>
                    </tr>
                @endforeach
            @endforeach
        </tbody>
    </table>

    {{-- ===== Ringkasan: info bayar (kiri) + total (kanan) ===== --}}
    <table class="summary">
        <tr>
            <td style="width: 53%; padding-right: 22px;">
                @if($hasPaymentInfo)
                    <div class="pay-box">
                        <table>
                            <tr>
                                <td>
                                    <div class="title">Metode Pembayaran</div>
                                    @if($payQr)
                                        <div class="small" style="margin-bottom: 5px;">
                                            <strong>QRIS / Online</strong> — scan kode QR atau buka:<br>
                                            <span class="accent">{{ $invoice->publicUrl() }}</span>
                                        </div>
                                    @endif
                                    @if($setting->bank_account_info)
                                        <div class="small"><strong>Transfer Bank</strong><br>{!! nl2br(e($setting->bank_account_info)) !!}</div>
                                        <div class="small muted" style="margin-top: 3px;">Berita transfer: {{ $invoice->invoice_number }}</div>
                                    @endif
                                </td>
                                @if($payQr)
                                    <td style="width: 86px;" class="right"><img class="qr" src="{{ $payQr }}" alt="QR"></td>
                                @endif
                            </tr>
                        </table>
                    </div>
                @endif
                <div class="words"><span class="bold" style="font-style: normal;">Terbilang:</span> {{ $amountInWords }}</div>
            </td>
            <td style="width: 47%;">
                <table class="totals">
                    <tr><td class="muted">Subtotal</td><td class="right">{{ $rp($invoice->subtotal) }}</td></tr>
                    @if((float) $invoice->discount > 0)
                        <tr>
                            <td class="muted">Diskon @if($invoice->discount_type === 'percent')({{ $num($invoice->discount_value) }}%)@endif</td>
                            <td class="right">- {{ $rp($invoice->discount) }}</td>
                        </tr>
                    @endif
                    @php $hasPph = (float) $invoice->pph_amount > 0; @endphp
                    @if((float) $invoice->tax_amount > 0 || $hasPph)
                        @if((float) $invoice->discount > 0)
                            <tr class="sep"><td class="muted">Dasar Pengenaan Pajak</td><td class="right">{{ $rp((float) $invoice->subtotal - (float) $invoice->discount) }}</td></tr>
                        @endif
                        @if((float) $invoice->tax_amount > 0)
                            <tr><td class="muted">PPN {{ $num($invoice->tax_rate) }}%</td><td class="right">{{ $rp($invoice->tax_amount) }}</td></tr>
                        @endif
                    @endif
                    @if($hasPph)
                        {{-- PPh 23 dipotong & disetor klien; klien wajib memberikan bukti potong. --}}
                        <tr class="sep"><td class="muted">Total tagihan</td><td class="right">{{ $rp($invoice->grossTotal()) }}</td></tr>
                        <tr><td class="muted">PPh 23 ({{ $num($invoice->pph_rate) }}%) dipotong klien</td><td class="right">- {{ $rp($invoice->pph_amount) }}</td></tr>
                    @endif
                    <tr class="grand"><td>{{ $hasPph ? 'TOTAL DIBAYAR' : 'TOTAL' }}</td><td class="right">{{ $rp($invoice->total) }}</td></tr>
                    @if(! $isCancelled && (float) $invoice->paid_amount > 0)
                        <tr><td class="muted">Telah Dibayar</td><td class="right">- {{ $rp($invoice->paid_amount) }}</td></tr>
                        <tr class="due"><td>Sisa Tagihan</td><td class="right">{{ $rp($remaining) }}</td></tr>
                    @endif
                </table>
            </td>
        </tr>
    </table>

    {{-- ===== Jadwal cicilan ===== --}}
    @if($invoice->isInstallment() && $invoice->schedules->count())
        <div class="section-title">Jadwal Cicilan</div>
        <table class="sched">
            <thead><tr><th style="width: 40px;">Ke</th><th>Jatuh Tempo</th><th class="right">Nominal</th><th class="right" style="width: 110px;">Status</th></tr></thead>
            <tbody>
                @foreach($invoice->schedules as $s)
                    <tr>
                        <td>{{ $s->sequence }}</td>
                        <td>{{ $date($s->due_date) }}</td>
                        <td class="right">{{ $rp($s->amount) }}</td>
                        <td class="right" style="color: {{ $s->status === 'paid' ? '#047857' : ($s->status === 'overdue' ? '#b91c1c' : '#475569') }}; font-weight: bold;">
                            {{ $s->status === 'paid' ? 'Lunas' : ($s->status === 'overdue' ? 'Terlambat' : 'Belum dibayar') }}
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    {{-- ===== Catatan, syarat & tanda tangan ===== --}}
    <table class="closing">
        <tr>
            <td style="width: 62%; padding-right: 26px;">
                @if($invoice->notes)
                    <div class="label" style="margin-bottom: 3px;">Catatan</div>
                    <div class="note">{!! nl2br(e($invoice->notes)) !!}</div>
                @endif
                @if(count($terms))
                    <div class="label" style="margin-bottom: 4px;">Syarat &amp; Ketentuan</div>
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
                <div class="small muted">{{ $date($invoice->issue_date) }}</div>
                <div class="small" style="margin-bottom: 6px;">Hormat kami,</div>
                @if($signature)
                    <img class="sign-img" src="{{ $signature }}" alt="Tanda tangan">
                @else
                    <div class="sign-space"></div>
                @endif
                <div class="sign-line">{{ $setting->signer_name ?: $companyName }}</div>
                <div class="small muted">{{ $setting->signer_title ?: ($setting->signer_name ? $companyName : 'Bagian Keuangan') }}</div>
                @if($setting->signer_name && $setting->signer_title)
                    <div class="small muted">{{ $companyName }}</div>
                @endif
            </td>
        </tr>
    </table>

</body>
</html>
