<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * QRIS statis merchant yang terdaftar di QRISLY. Satu yang aktif dipakai
 * untuk generate QRIS dinamis per pembayaran.
 *
 * @property int $id
 * @property string $qris_id
 * @property string $name
 * @property string|null $provider
 * @property string|null $merchant_name
 * @property string|null $image_path
 * @property bool $is_active
 */
#[Fillable(['qris_id', 'name', 'provider', 'merchant_name', 'image_path', 'is_active'])]
class QrisAccount extends Model
{
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public static function active(): ?self
    {
        return static::query()->where('is_active', true)->first();
    }

    /** Jadikan satu-satunya QRIS aktif. */
    public function activate(): void
    {
        DB::transaction(function () {
            static::query()->whereKeyNot($this->id)->update(['is_active' => false]);
            $this->update(['is_active' => true]);
        });
    }

    public function imageUrl(): ?string
    {
        return $this->image_path ? asset('storage/'.$this->image_path) : null;
    }
}
