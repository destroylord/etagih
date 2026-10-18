<?php

namespace App\Http\Controllers\Invoice;

use App\Actions\Invoice\RecordPayment;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\PaymentStatus;
use App\Services\QrislyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Webhook callback endpoint dari QRISLY.
 *
 * QRISLY tidak mengirim signature, jadi payload dianggap "petunjuk" saja:
 * status sukses selalu dikonfirmasi ulang ke API payment-status QRISLY
 * sebelum pembayaran dicatat. Payload palsu tidak bisa menandai invoice lunas.
 */
class WebhookController extends Controller
{
    public function handle(Request $request, RecordPayment $recorder): JsonResponse
    {
        // Verifikasi signature dihapus — webhook sudah ditangani provider.
        // Endpoint tetap dibatasi throttle:60,1 di routes/web.php.
        $rawBody = $request->getContent();
        $payload = json_decode($rawBody, true) ?? [];
        Log::info('QRISLY webhook inbound', [
            'payload' => $payload,
        ]);

        // QRISLY membungkus payload di kunci `data` (event/timestamp di level atas).
        // Contoh: { "event":"payment.success", "data": { qris_history_id, amount, status } }
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;

        $externalId = (string) ($data['qris_history_id']
            ?? $data['external_id']
            ?? $data['trx_id']
            ?? $data['history_id']
            ?? '');
        if ($externalId === '') {
            return response()->json(['success' => true, 'message' => 'Webhook received and processed']);
        }

        // external_id = history_id transaksi QRIS yang kita simpan saat generate.
        $payment = Payment::where('external_id', $externalId)->first();
        if (! $payment) {
            Log::info('QRISLY webhook: payment not found for external_id', ['external_id' => $externalId]);

            return response()->json(['success' => true, 'message' => 'Webhook received and processed']);
        }
        $invoice = $payment->invoice;
        // Status QRISLY pakai field `payment_status` (flow-overview). Envelope webhook
        // resmi pakai `data.status`. Semua dicoba; resolve-nya di-log buat debug.
        $status = PaymentStatus::fromQrisly(
            $data['payment_status']
            ?? $payload['payment_status']
            ?? $data['status']
            ?? $payload['status']
            ?? 'pending'
        );
        Log::info('QRISLY webhook resolved', [
            'external_id' => $externalId,
            'status_raw' => $data['payment_status']
                ?? $payload['payment_status']
                ?? $data['status']
                ?? $payload['status']
                ?? '(missing)',
            'status_mapped' => $status,
            'amount' => $data['amount'] ?? $payload['amount'] ?? $payment->amount,
            'payment_found' => true,
            'invoice_id' => $invoice->id,
            'invoice_no' => $invoice->invoice_number,
        ]);

        if ($status === 'success') {
            // Webhook tidak bertanda tangan → jangan percaya isinya. Konfirmasi ulang
            // langsung ke QRISLY; nominal yang dicatat juga diambil dari gateway.
            try {
                $remote = QrislyService::fromConfig()->checkStatus($externalId);
            } catch (Throwable $e) {
                Log::warning('QRISLY webhook verification failed', [
                    'external_id' => $externalId,
                    'error' => $e->getMessage(),
                ]);

                // 503 → gateway boleh retry; polling halaman bayar juga jadi fallback.
                return response()->json(['success' => false, 'message' => 'Verification unavailable'], 503);
            }

            if (PaymentStatus::fromQrisly($remote['payment_status']) !== 'success') {
                Log::warning('QRISLY webhook claims success but gateway disagrees', [
                    'external_id' => $externalId,
                    'gateway_status' => $remote['payment_status'],
                ]);

                return response()->json(['success' => true, 'message' => 'Webhook received and processed']);
            }

            $recorder->execute(
                invoice: $invoice,
                amount: $remote['amount'] > 0 ? $remote['amount'] : (float) $payment->amount,
                externalId: $externalId,
                scheduleId: $payment->schedule_id,
                rawResponse: ['webhook' => $payload, 'verified' => $remote],
            );
        } else {
            // Update status payment. Jangan timpa status yang sudah success —
            // event expired/failed yang datang belakangan jangan menurunkan row sukses.
            if ($payment->status !== 'success') {
                $payment->update([
                    'status' => $status,
                    'raw_response' => $payload,
                ]);
            }
        }

        return response()->json(['success' => true, 'message' => 'Webhook received and processed']);
    }
}
