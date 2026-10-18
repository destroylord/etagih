<?php

namespace App\Services;

use App\Models\QrisAccount;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Wrapper HTTP client untuk QRISLY payment gateway (Komerce).
 * Semua credential dibaca dari config('services.qrisly.*') → .env.
 *
 * Endpoint sandbox yang dipakai:
 *   POST {base}/api/v1/qrisly/generate-qris  → generate QRIS statis per nominal
 *      body: { qris_id, amount, output_type }
 *      header: x-api-key
 *      response.data: { history_id, qris_string, final_amount, expiry_time }
 *
 * Generate hanya menghasilkan QRIS statis (tidak ada payment_url/redirect);
 * konfirmasi pembayaran datang via webhook (history_id sebagai korrelator).
 *
 * Webhook callback ditangani provider (tanpa verifikasi signature di sisi aplikasi).
 */
class QrislyService
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly ?string $merchantId = null,
    ) {}

    public static function fromConfig(): self
    {
        $isProduction = (bool) config('services.qrisly.is_production');

        return new self(
            baseUrl: $isProduction
                ? (string) config('services.qrisly.production_base_url')
                : (string) config('services.qrisly.base_url'),
            apiKey: (string) config('services.qrisly.api_key', ''),
            // QRIS aktif yang di-upload lewat Pengaturan; fallback ke QRISLY_MERCHANT_ID di .env.
            merchantId: QrisAccount::active()->qris_id ?? config('services.qrisly.merchant_id'),
        );
    }

    public function hasQris(): bool
    {
        return (string) $this->merchantId !== '';
    }

    /**
     * Daftarkan gambar QRIS statis merchant ke QRISLY (Step 1 docs, sekali saja).
     * POST /api/v1/qrisly/upload-qris (multipart: name, qris_image PNG/JPG ≤ 5 MB).
     *
     * @return array{qris_id: string, provider: string|null, name: string, merchant_name: string|null}
     */
    public function uploadQris(string $name, string $imagePath, string $filename): array
    {
        // Isi file (bukan stream) supaya aman di-retry oleh HTTP client.
        $contents = @file_get_contents($imagePath);
        if ($contents === false) {
            throw new RuntimeException('Gambar QRIS tidak bisa dibaca.');
        }

        $response = $this->client(json: false)
            ->attach('qris_image', $contents, $filename)
            ->post('/api/v1/qrisly/upload-qris', ['name' => $name]);

        $body = $response->json('data') ?? [];

        if (! $response->successful() || empty($body['qris_id'])) {
            Log::error('QRISLY upload-qris failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            $message = $response->json('message') ?? $response->json('meta.message');
            throw new RuntimeException(is_string($message) && $message !== ''
                ? 'QRISLY: '.$message
                : 'Upload QRIS ke QRISLY gagal ('.$response->status().').');
        }

        return [
            'qris_id' => (string) $body['qris_id'],
            'provider' => isset($body['provider']) ? (string) $body['provider'] : null,
            'name' => (string) ($body['name'] ?? $name),
            'merchant_name' => isset($body['merchant_name']) ? (string) $body['merchant_name'] : null,
        ];
    }

    /**
     * Generate QRIS dinamis untuk sejumlah uang dari QRIS aktif.
     * `history_id` = korrelator yang dikirim balik webhook.
     *
     * @return array{qris_string: string, history_id: string, original_amount: float, final_amount: float, payment_status: string, expiry_time: string}
     */
    public function generate(float $amount): array
    {
        if (! $this->hasQris()) {
            throw new RuntimeException('Belum ada QRIS aktif. Upload QRIS di Pengaturan → QRIS.');
        }

        $qrisId = ctype_digit((string) $this->merchantId)
            ? (int) $this->merchantId
            : (string) $this->merchantId;

        $payload = [
            'qris_id' => $qrisId,
            'amount' => (int) round($amount),
            'output_type' => 'string',
            // Wajib/docs + kunci buat mobile listener: nambah desimal unik (10000→10003)
            // supaya app Android merchant bisa bedain transaksi nominal identik.
            'unique_amount' => true,
        ];

        $response = $this->client()->post('/api/v1/qrisly/generate-qris', $payload);

        if (! $response->successful()) {
            Log::error('QRISLY generate failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
            throw new RuntimeException('QRISLY generate QRIS failed: '.$response->status());
        }

        // Respon resmi flat: { history_id, qris_string, original_amount, final_amount, payment_status, expiry_time }.
        // Fallback tetap terima wrapper `data` (varian sandbox/lama).
        $body = $response->json('data') ?? $response->json();

        if (! isset($body['qris_string'])) {
            Log::error('QRISLY generate failed (bad response)', [
                'body' => $body,
            ]);
            throw new RuntimeException('QRISLY generate QRIS failed: bad response');
        }

        return [
            'qris_string' => (string) $body['qris_string'],
            'history_id' => (string) ($body['history_id'] ?? ''),
            'original_amount' => (float) ($body['original_amount'] ?? $amount),
            'final_amount' => (float) ($body['final_amount'] ?? $amount),
            'payment_status' => (string) ($body['payment_status'] ?? 'unpaid'),
            'expiry_time' => (string) ($body['expiry_time'] ?? ''),
        ];
    }

    /**
     * Validasi status payment via `GET /payment-status/{history_id}` (Step 4 docs).
     * Dipakai sbg fallback kalau webhook lambat/gagal sampai.
     */
    /**
     * @return array{history_id: string, payment_status: string, amount: float}
     */
    public function checkStatus(string $historyId): array
    {
        $response = $this->client()->get('/api/v1/qrisly/payment-status/'.$historyId);

        if (! $response->successful()) {
            Log::error('QRISLY status failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
            throw new RuntimeException('QRISLY status failed: '.$response->status());
        }

        // Respon resmi di-bungkus `data`; fallback terima flat.
        $body = $response->json('data') ?? $response->json();

        return [
            'history_id' => (string) ($body['history_id'] ?? $historyId),
            'payment_status' => (string) ($body['payment_status'] ?? 'pending'),
            'amount' => (float) ($body['amount'] ?? 0),
        ];
    }

    /**
     * @param  bool  $json  false untuk request multipart (upload) — header
     *                      Content-Type JSON tidak boleh ikut terkirim.
     */
    private function client(bool $json = true): PendingRequest
    {
        if ($this->apiKey === '') {
            throw new RuntimeException('QRISLY_API_KEY belum di-set di .env.');
        }

        $request = Http::baseUrl($this->baseUrl)
            ->withHeaders(['x-api-key' => $this->apiKey])
            ->acceptJson()
            ->timeout(30)
            ->retry(3, fn ($attempt) => 200 * $attempt, throw: false);

        return $json ? $request->asJson() : $request;
    }
}
