<?php

namespace App\Support;

use App\Models\Client;
use App\Models\Project;

/**
 * Resolve hourly rate untuk client.
 *
 * Prioritas:
 *   1. Client.hourly_rate (kalau di-set per-client)
 *   2. Settings.default_hourly_rate (global per-install)
 *
 * Dipakai oleh WorkSessionAction::start() buat pre-fill rate session.
 */
class RateResolver
{
    public static function forClient(?Client $client): float
    {
        if ($client && $client->hourly_rate !== null) {
            return (float) $client->hourly_rate;
        }

        return (float) Settings::current()->default_hourly_rate;
    }

    /**
     * Tarif sesi/item proyek: sub-proyek → proyek utama → klien → default.
     */
    public static function forProject(?Project $project, ?Client $client = null): float
    {
        if ($project) {
            if ($project->hourly_rate !== null) {
                return (float) $project->hourly_rate;
            }
            if ($project->parent && $project->parent->hourly_rate !== null) {
                return (float) $project->parent->hourly_rate;
            }
        }

        return self::forClient($client ?? $project?->client);
    }
}
