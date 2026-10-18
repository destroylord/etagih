<?php

namespace App\Support;

use App\Models\Project;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Statistik proyek & sub-proyek. Dihitung dengan beberapa query agregat lalu
 * digulung (roll-up) dari sub-proyek ke proyek utama di PHP.
 *
 * Per proyek:
 * - invoice_count, billed, paid, outstanding — dari invoice yang ditautkan
 *   langsung ke proyek (bukan draft / dibatalkan).
 * - work_value — nilai pekerjaan (jumlah baris item, sebelum diskon & pajak)
 *   berdasarkan proyek efektif item: proyek item, atau proyek invoice.
 *   Inilah yang membagi invoice "Gym" ke sub-proyek Allstar / Buildy.
 * - tracked_seconds, unbilled_seconds — dari sesi Time Tracker.
 *
 * Proyek utama = nilainya sendiri + semua sub-proyeknya.
 */
class ProjectStats
{
    public const EMPTY = [
        'invoice_count' => 0,
        'billed' => 0.0,
        'paid' => 0.0,
        'outstanding' => 0.0,
        'work_value' => 0.0,
        'tracked_seconds' => 0,
        'unbilled_seconds' => 0,
    ];

    /**
     * @param  Collection<int, Project>|iterable<Project>  $projects  proyek + sub-proyek yang ingin dihitung
     * @return array<int, array<string, int|float>>
     */
    public static function for(iterable $projects): array
    {
        $projects = collect($projects);
        if ($projects->isEmpty()) {
            return [];
        }

        // Pastikan sub-proyek ikut dihitung untuk roll-up.
        $ids = $projects->pluck('id')->all();
        $all = Project::query()->whereIn('id', $ids)->orWhereIn('parent_id', $ids)->get(['id', 'parent_id']);
        $allIds = $all->pluck('id')->all();

        $own = [];
        foreach ($allIds as $id) {
            $own[(int) $id] = self::EMPTY;
        }

        $invoices = DB::table('invoices')
            ->whereIn('project_id', $allIds)
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->groupBy('project_id')
            ->selectRaw('project_id, COUNT(*) as c, COALESCE(SUM(total),0) as billed, COALESCE(SUM(paid_amount),0) as paid')
            ->get();
        foreach ($invoices as $row) {
            $pid = (int) $row->project_id;
            $own[$pid]['invoice_count'] = (int) $row->c;
            $own[$pid]['billed'] = round((float) $row->billed, 2);
            $own[$pid]['paid'] = round((float) $row->paid, 2);
            $own[$pid]['outstanding'] = round(max(0, (float) $row->billed - (float) $row->paid), 2);
        }

        $work = DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->whereNotIn('invoices.status', ['draft', 'cancelled'])
            ->where(fn ($q) => $q->whereIn('invoice_items.project_id', $allIds)
                ->orWhere(fn ($q) => $q->whereNull('invoice_items.project_id')->whereIn('invoices.project_id', $allIds)))
            ->groupByRaw('COALESCE(invoice_items.project_id, invoices.project_id)')
            ->selectRaw('COALESCE(invoice_items.project_id, invoices.project_id) as pid, COALESCE(SUM(invoice_items.line_total),0) as value')
            ->get();
        foreach ($work as $row) {
            if (isset($own[(int) $row->pid])) {
                $own[(int) $row->pid]['work_value'] = round((float) $row->value, 2);
            }
        }

        $sessions = DB::table('work_sessions')
            ->whereIn('project_id', $allIds)
            ->groupBy('project_id')
            ->selectRaw("project_id, COALESCE(SUM(CASE WHEN status IN ('completed','billed') THEN duration_seconds ELSE 0 END),0) as tracked, COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END),0) as unbilled")
            ->get();
        foreach ($sessions as $row) {
            $own[(int) $row->project_id]['tracked_seconds'] = (int) $row->tracked;
            $own[(int) $row->project_id]['unbilled_seconds'] = (int) $row->unbilled;
        }

        // Roll-up: proyek utama = sendiri + sub-proyek.
        $result = $own;
        foreach ($all as $p) {
            $parentId = (int) $p->parent_id;
            if ($parentId && isset($result[$parentId], $own[(int) $p->id])) {
                $result[$parentId] = self::sum($result[$parentId], $own[(int) $p->id]);
            }
        }

        return $result;
    }

    /**
     * @param  array<string, int|float>  $a
     * @param  array<string, int|float>  $b
     * @return array<string, int|float>
     */
    private static function sum(array $a, array $b): array
    {
        foreach ($b as $key => $value) {
            $total = ($a[$key] ?? 0) + $value;
            $a[$key] = is_float($total) ? round($total, 2) : $total;
        }

        return $a;
    }

    /**
     * Pohon proyek (utama + sub) lengkap dengan statistik, siap untuk frontend.
     *
     * @param  Collection<int, Project>  $topLevel  proyek utama dengan relasi children ter-load
     * @return list<array<string, mixed>>
     */
    public static function tree(Collection $topLevel): array
    {
        $nodes = $topLevel->flatMap(fn (Project $p) => [$p, ...$p->children]);
        $stats = self::for($nodes);

        return array_values($topLevel->map(fn (Project $p) => [
            ...self::node($p, $stats),
            'children' => $p->children->map(fn (Project $c) => self::node($c, $stats))->values()->all(),
        ])->all());
    }

    /**
     * @param  array<int, array<string, int|float>>  $stats
     * @return array<string, mixed>
     */
    private static function node(Project $p, array $stats): array
    {
        return [
            'id' => $p->id,
            'client_id' => $p->client_id,
            'parent_id' => $p->parent_id,
            'name' => $p->name,
            'description' => $p->description,
            'status' => $p->status,
            'hourly_rate' => $p->hourly_rate,
            'stats' => $stats[$p->id] ?? self::EMPTY,
        ];
    }
}
