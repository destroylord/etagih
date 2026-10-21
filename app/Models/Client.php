<?php

namespace App\Models;

use App\Support\Access;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $address
 * @property string|null $notes
 * @property string|null $access_key_hash
 * @property string|null $access_key
 * @property string|null $hourly_rate
 * @property-read Collection<int, Invoice> $invoices
 * @property-read Collection<int, Product> $products
 * @property-read Collection<int, WorkSession> $workSessions
 * @property-read Collection<int, Project> $projects
 */
#[Fillable(['name', 'phone', 'email', 'address', 'notes', 'access_key', 'hourly_rate'])]
class Client extends Model
{
    /** Hash kunci portal tidak pernah dikirim ke frontend. */
    protected $hidden = ['access_key_hash'];

    /** Plaintext kunci portal — hanya ada di request saat kunci dibuat. */
    private ?string $plainAccessKey = null;

    protected function casts(): array
    {
        return [
            'hourly_rate' => 'decimal:2',
        ];
    }

    /**
     * Setiap client punya kunci portal. Yang disimpan hanya hash sha256-nya,
     * plaintext hanya bisa dibaca sekali (setelah create / regenerate).
     */
    protected static function booted(): void
    {
        static::creating(function (Client $client) {
            if (! $client->access_key_hash) {
                $client->access_key = self::generateKey();
            }
        });
    }

    public static function generateKey(): string
    {
        return Str::random(24);
    }

    public static function hashKey(string $key): string
    {
        return hash('sha256', trim($key));
    }

    public static function findByAccessKey(string $key): ?self
    {
        return static::query()->where('access_key_hash', self::hashKey($key))->first();
    }

    /**
     * @return Attribute<string|null, string>
     */
    protected function accessKey(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->plainAccessKey,
            set: function (string $value) {
                $this->plainAccessKey = $value;

                return ['access_key_hash' => self::hashKey($value)];
            },
        );
    }

    /** Buat kunci baru (kunci lama langsung tidak berlaku). Return plaintext. */
    public function regenerateAccessKey(): string
    {
        $this->access_key = self::generateKey();
        $this->save();

        return (string) $this->plainAccessKey;
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<Product, $this>
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * @return HasMany<WorkSession, $this>
     */
    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    /**
     * @return HasMany<Project, $this>
     */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class)->orderBy('name');
    }

    /**
     * Klien yang boleh dilihat pengguna (lihat App\Support\Access).
     *
     * @param  Builder<Client>  $query
     * @return Builder<Client>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        $ids = Access::clientIds($user);

        return $ids === null ? $query : $query->whereIn($query->qualifyColumn('id'), $ids);
    }
}
