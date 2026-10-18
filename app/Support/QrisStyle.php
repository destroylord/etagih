<?php

namespace App\Support;

use App\Models\Setting;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Eye\EyeInterface;
use BaconQrCode\Renderer\Eye\ModuleEye;
use BaconQrCode\Renderer\Eye\SimpleCircleEye;
use BaconQrCode\Renderer\Eye\SquareEye;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\Module\DotsModule;
use BaconQrCode\Renderer\Module\ModuleInterface;
use BaconQrCode\Renderer\Module\RoundnessModule;
use BaconQrCode\Renderer\Module\SquareModule;
use BaconQrCode\Renderer\RendererStyle\EyeFill;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/**
 * Gaya tampilan QRIS (QRISLY hanya mengembalikan `qris_string`; tampilan QR
 * sepenuhnya dibuat aplikasi). Dipakai halaman bayar, unduhan gambar QR,
 * pratinjau di Pengaturan, dan QR link pembayaran di PDF.
 *
 * Aturan keterbacaan: kontras warna minimal 3:1 (divalidasi saat simpan) dan
 * QR dengan logo memakai error-correction H.
 */
class QrisStyle
{
    public const DEFAULTS = [
        'fg_color' => '#0f172a',
        'bg_color' => '#ffffff',
        'eye_color' => null,       // null = sama dengan fg_color
        'module' => 'square',      // square | rounded | dots
        'eye' => 'square',         // square | rounded | circle
        'logo' => 'none',          // none | company
        'frame' => 'card',         // none | simple | card
        'frame_color' => '#1e3a8a',
        'title' => null,           // null = nama perusahaan
        'caption' => 'Scan dengan aplikasi e-wallet atau m-banking',
        'show_amount' => true,
    ];

    public const MODULES = ['square', 'rounded', 'dots'];

    public const EYES = ['square', 'rounded', 'circle'];

    public const FRAMES = ['none', 'simple', 'card'];

    /** Contoh payload untuk pratinjau (bukan QRIS sungguhan). */
    public const SAMPLE_PAYLOAD = '00020101021226570011ID.DANA.WWW011893600915000000000102150000000000000000303UMI51440014ID.CO.QRIS.WWW0215ID10200000000000303UMI5204581253033605405100005802ID5911CONTOH TOKO6007JAKARTA61051234062070703A016304ABCD';

    /**
     * @param  array<string, mixed>|null  $style
     * @return array{fg_color: string, bg_color: string, eye_color: string|null, module: string, eye: string, logo: string, frame: string, frame_color: string, title: string|null, caption: string|null, show_amount: bool}
     */
    public static function normalize(?array $style): array
    {
        $s = array_merge(self::DEFAULTS, array_filter($style ?? [], fn ($v) => $v !== null && $v !== ''));

        $hex = fn ($v, $fallback) => is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtolower($v) : $fallback;

        return [
            'fg_color' => $hex($s['fg_color'], self::DEFAULTS['fg_color']),
            'bg_color' => $hex($s['bg_color'], self::DEFAULTS['bg_color']),
            'eye_color' => isset($style['eye_color']) ? $hex($style['eye_color'], null) : null,
            'module' => in_array($s['module'], self::MODULES, true) ? $s['module'] : 'square',
            'eye' => in_array($s['eye'], self::EYES, true) ? $s['eye'] : 'square',
            'logo' => $s['logo'] === 'company' ? 'company' : 'none',
            'frame' => in_array($s['frame'], self::FRAMES, true) ? $s['frame'] : 'card',
            'frame_color' => $hex($s['frame_color'], self::DEFAULTS['frame_color']),
            'title' => is_string($style['title'] ?? null) && trim($style['title']) !== '' ? mb_substr(trim($style['title']), 0, 40) : null,
            'caption' => array_key_exists('caption', $style ?? []) ? (is_string($style['caption']) ? mb_substr(trim($style['caption']), 0, 80) : null) : self::DEFAULTS['caption'],
            'show_amount' => filter_var($s['show_amount'], FILTER_VALIDATE_BOOLEAN),
        ];
    }

    /**
     * @return array{fg_color: string, bg_color: string, eye_color: string|null, module: string, eye: string, logo: string, frame: string, frame_color: string, title: string|null, caption: string|null, show_amount: bool}
     */
    public static function fromSetting(Setting $setting): array
    {
        return self::normalize(is_array($setting->qris_style) ? $setting->qris_style : null);
    }

    /** Rasio kontras WCAG antara dua warna hex (1–21). */
    public static function contrast(string $a, string $b): float
    {
        $lum = function (string $hex): float {
            $rgb = array_map(fn ($c) => hexdec($c) / 255, str_split(ltrim($hex, '#'), 2));
            $lin = array_map(fn ($c) => $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4, $rgb);

            return 0.2126 * $lin[0] + 0.7152 * $lin[1] + 0.0722 * $lin[2];
        };
        [$l1, $l2] = [$lum($a), $lum($b)];

        return (max($l1, $l2) + 0.05) / (min($l1, $l2) + 0.05);
    }

    /**
     * QR polos bergaya (tanpa bingkai/logo) — aman untuk DomPDF.
     *
     * @param  array<string, mixed>  $style  hasil normalize()
     */
    public static function qrSvg(string $payload, array $style, int $size = 300, bool $highEcc = false): string
    {
        $fg = self::rgb($style['fg_color']);
        $bg = self::rgb($style['bg_color']);
        $eyeFill = EyeFill::uniform(self::rgb($style['eye_color'] ?? $style['fg_color']));

        $renderer = new ImageRenderer(
            new RendererStyle(
                $size,
                1,
                self::module($style['module']),
                self::eye($style['eye']),
                Fill::withForegroundColor($bg, $fg, $eyeFill, $eyeFill, $eyeFill),
            ),
            new SvgImageBackEnd,
        );

        $svg = (new Writer($renderer))->writeString(
            $payload,
            Encoder::DEFAULT_BYTE_MODE_ENCODING,
            $highEcc ? ErrorCorrectionLevel::H() : ErrorCorrectionLevel::M(),
        );

        return (string) preg_replace('/^<\?xml[^>]*>\s*/', '', $svg);
    }

    /**
     * Kartu QRIS lengkap (bingkai, judul, logo, nominal, keterangan) sebagai SVG.
     *
     * @param  array<string, mixed>  $style  hasil normalize()
     */
    public static function cardSvg(string $payload, array $style, ?float $amount = null, ?string $fallbackTitle = null, ?string $logoDataUri = null): string
    {
        $e = fn (?string $v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_XML1);
        $logo = $style['logo'] === 'company' ? $logoDataUri : null;
        $qrSize = 280;
        $qr = self::qrSvg($payload, $style, $qrSize, $logo !== null);

        // Sisipkan QR sebagai <svg> bersarang di posisi (x,y).
        $place = fn (int $x, int $y) => (string) preg_replace('/^<svg\b/', "<svg x=\"{$x}\" y=\"{$y}\"", $qr, 1);

        $logoMarkup = function (int $qrX, int $qrY) use ($logo, $qrSize, $style, $e): string {
            if (! $logo) {
                return '';
            }
            $box = (int) round($qrSize * 0.22);
            $x = $qrX + ($qrSize - $box) / 2;
            $y = $qrY + ($qrSize - $box) / 2;

            return '<rect x="'.$x.'" y="'.$y.'" width="'.$box.'" height="'.$box.'" rx="10" fill="'.$style['bg_color'].'"/>'
                .'<image x="'.($x + 6).'" y="'.($y + 6).'" width="'.($box - 12).'" height="'.($box - 12).'" preserveAspectRatio="xMidYMid meet" href="'.$e($logo).'"/>';
        };

        $font = 'font-family="Inter, Segoe UI, Arial, sans-serif"';
        $title = $style['title'] ?: ($fallbackTitle ?: 'QRIS');
        $amountText = $style['show_amount'] && $amount ? 'Rp '.number_format($amount, 0, ',', '.') : null;
        $caption = $style['caption'];

        if ($style['frame'] === 'none') {
            $w = $qrSize + 24;

            return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'.$w.'" height="'.$w.'" viewBox="0 0 '.$w.' '.$w.'">'
                .'<rect width="100%" height="100%" fill="'.$style['bg_color'].'"/>'
                .$place(12, 12).$logoMarkup(12, 12).'</svg>';
        }

        $w = 340;
        $qrX = (int) (($w - $qrSize) / 2);

        if ($style['frame'] === 'simple') {
            $qrY = 22;
            $y = $qrY + $qrSize + 16;
            $texts = '';
            if ($amountText) {
                $texts .= '<text x="'.($w / 2).'" y="'.($y + 14).'" text-anchor="middle" '.$font.' font-size="20" font-weight="700" fill="'.$style['fg_color'].'">'.$e($amountText).'</text>';
                $y += 26;
            }
            if ($caption) {
                $texts .= '<text x="'.($w / 2).'" y="'.($y + 12).'" text-anchor="middle" '.$font.' font-size="11.5" fill="'.$style['fg_color'].'" fill-opacity="0.7">'.$e($caption).'</text>';
                $y += 20;
            }
            $h = $y + 14;

            return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'.$w.'" height="'.$h.'" viewBox="0 0 '.$w.' '.$h.'">'
                .'<rect x="2" y="2" width="'.($w - 4).'" height="'.($h - 4).'" rx="18" fill="'.$style['bg_color'].'" stroke="'.$style['frame_color'].'" stroke-width="4"/>'
                .$place($qrX, $qrY).$logoMarkup($qrX, $qrY).$texts.'</svg>';
        }

        // frame = card: header berwarna + judul, QR, nominal, keterangan.
        $header = 64;
        $qrY = $header + 20;
        $y = $qrY + $qrSize + 14;
        $texts = '';
        if ($amountText) {
            $texts .= '<text x="'.($w / 2).'" y="'.($y + 20).'" text-anchor="middle" '.$font.' font-size="22" font-weight="700" fill="#0f172a">'.$e($amountText).'</text>';
            $y += 32;
        }
        if ($caption) {
            $texts .= '<text x="'.($w / 2).'" y="'.($y + 12).'" text-anchor="middle" '.$font.' font-size="11.5" fill="#64748b">'.$e($caption).'</text>';
            $y += 20;
        }
        $h = $y + 22;

        return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'.$w.'" height="'.$h.'" viewBox="0 0 '.$w.' '.$h.'">'
            .'<defs><clipPath id="qcard"><rect width="'.$w.'" height="'.$h.'" rx="20"/></clipPath></defs>'
            .'<g clip-path="url(#qcard)">'
            .'<rect width="'.$w.'" height="'.$h.'" fill="#ffffff"/>'
            .'<rect width="'.$w.'" height="'.$header.'" fill="'.$style['frame_color'].'"/>'
            .'<text x="'.($w / 2).'" y="28" text-anchor="middle" '.$font.' font-size="17" font-weight="700" fill="#ffffff">'.$e(mb_strimwidth($title, 0, 30, '…')).'</text>'
            .'<text x="'.($w / 2).'" y="48" text-anchor="middle" '.$font.' font-size="10.5" letter-spacing="3" font-weight="600" fill="#ffffff" fill-opacity="0.8">QRIS · SCAN UNTUK BAYAR</text>'
            .'<rect x="'.($qrX - 8).'" y="'.($qrY - 8).'" width="'.($qrSize + 16).'" height="'.($qrSize + 16).'" rx="14" fill="'.$style['bg_color'].'"/>'
            .$place($qrX, $qrY).$logoMarkup($qrX, $qrY).$texts
            .'</g><rect x="0.5" y="0.5" width="'.($w - 1).'" height="'.($h - 1).'" rx="20" fill="none" stroke="#e2e8f0"/></svg>';
    }

    public static function dataUri(string $svg): string
    {
        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    private static function rgb(string $hex): Rgb
    {
        [$r, $g, $b] = array_map('hexdec', str_split(ltrim($hex, '#'), 2));

        return new Rgb((int) $r, (int) $g, (int) $b);
    }

    private static function module(string $module): ModuleInterface
    {
        return match ($module) {
            'rounded' => new RoundnessModule(RoundnessModule::STRONG),
            'dots' => new DotsModule(DotsModule::MEDIUM),
            default => SquareModule::instance(),
        };
    }

    private static function eye(string $eye): EyeInterface
    {
        return match ($eye) {
            'circle' => SimpleCircleEye::instance(),
            'rounded' => new ModuleEye(new RoundnessModule(RoundnessModule::STRONG)),
            default => SquareEye::instance(),
        };
    }
}
