<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Notifikasi di aplikasi (lonceng). Daftar dibaca lewat JSON; tandai dibaca
 * mengembalikan JSON bila diminta fetch, selain itu redirect back().
 */
class NotificationController extends Controller
{
    public const LIMIT = 30;

    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);

        $items = $user->notifications()
            ->latest()
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (DatabaseNotification $n) => self::present($n))
            ->values();

        return response()->json([
            'unread_count' => $user->unreadNotifications()->count(),
            'notifications' => $items,
        ]);
    }

    public function read(Request $request, string $id): JsonResponse|RedirectResponse
    {
        $notification = $this->user($request)->notifications()->whereKey($id)->firstOrFail();
        $notification->markAsRead();

        return $this->done($request);
    }

    public function readAll(Request $request): JsonResponse|RedirectResponse
    {
        $this->user($request)->unreadNotifications()->update(['read_at' => now()]);

        return $this->done($request);
    }

    /**
     * @return array{id: string, type: string, title: string, body: string, url: string|null, read_at: string|null, created_at: string|null}
     */
    public static function present(DatabaseNotification $n): array
    {
        $data = $n->data;

        return [
            'id' => (string) $n->id,
            'type' => (string) ($data['type'] ?? class_basename((string) $n->type)),
            'title' => (string) ($data['title'] ?? ''),
            'body' => (string) ($data['body'] ?? ''),
            'url' => isset($data['url']) ? (string) $data['url'] : null,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
        ];
    }

    private function done(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'unread_count' => $this->user($request)->unreadNotifications()->count(),
            ]);
        }

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
