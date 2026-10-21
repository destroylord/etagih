<?php

namespace App\Http\Middleware;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Project;
use App\Models\Quote;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use App\Models\User;
use App\Models\WorkSession;
use App\Support\Access;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alias `visible`. Tolak (404) akses staf ke klien / proyek / invoice /
 * penawaran / pembayaran / tugas di luar proyek yang ia ikuti — dicek dari
 * parameter rute yang sudah di-bind ke model. Admin & pemilik selalu lolos.
 *
 * Dipasang di grup rute ber-auth (routes/web.php), jadi controller cukup
 * mem-filter daftar (index) dengan scope `visibleTo()`.
 */
class EnsureResourceVisible
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $route = $request->route();

        if (! $user instanceof User || ! Access::isRestricted($user) || $route === null) {
            return $next($request);
        }

        foreach ($route->parameters() as $value) {
            if (! $this->visible($user, $value)) {
                abort(404);
            }
        }

        return $next($request);
    }

    private function visible(User $user, mixed $value): bool
    {
        return match (true) {
            $value instanceof Client => Access::canSeeClient($user, $value->id),
            $value instanceof Project => Access::canSeeProject($user, $value),
            $value instanceof Invoice, $value instanceof Quote => Access::canSeeClient($user, $value->client_id),
            $value instanceof Payment => Access::canSeeClient($user, (int) Invoice::query()->whereKey($value->invoice_id)->value('client_id')),
            $value instanceof Task => Access::canSeeProject($user, $value->project_id),
            $value instanceof TaskChecklistItem, $value instanceof TaskComment => Access::canSeeProject(
                $user,
                (int) Task::withTrashed()->whereKey($value->task_id)->value('project_id'),
            ),
            // Produk umum (tanpa klien) boleh; produk khusus klien mengikuti kliennya.
            $value instanceof Product => $value->client_id === null || Access::canSeeClient($user, (int) $value->client_id),
            // Sama dengan WorkSession::scopeVisibleTo(): sesi sendiri, atau sesi di proyek yang diikuti.
            $value instanceof WorkSession => $value->user_id === $user->id
                || ($value->project_id !== null && Access::canSeeProject($user, $value->project_id)),
            default => true,
        };
    }
}
