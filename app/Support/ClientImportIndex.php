<?php

namespace App\Support;

use App\Models\Client;

/**
 * Indeks identitas klien (email / telepon / nama) untuk deteksi duplikat saat
 * import. Dipakai untuk klien yang sudah ada (id = id klien) maupun baris di
 * dalam file yang sama (id = nomor baris).
 *
 * @phpstan-type Identity array{name: string, email: ?string}
 */
class ClientImportIndex
{
    /** @var array<int, Identity> */
    private array $items = [];

    /** @var array<string, int> */
    private array $byEmail = [];

    /** @var array<string, array<int, int>> */
    private array $byPhone = [];

    /** @var array<string, array<int, int>> */
    private array $byName = [];

    public static function fromDatabase(): self
    {
        $index = new self;
        Client::query()->select(['id', 'name', 'email', 'phone'])->orderBy('id')
            ->each(fn (Client $c) => $index->add($c->id, [
                'name' => $c->name,
                'email' => $c->email,
                'phone' => $c->phone,
            ]));

        return $index;
    }

    /**
     * @param  array{name: ?string, email: ?string, phone: ?string}  $values
     */
    public function add(int $id, array $values): void
    {
        $name = (string) $values['name'];
        $email = self::emailKey($values['email']);
        $this->items[$id] = ['name' => $name, 'email' => $email];

        if ($email !== null && ! isset($this->byEmail[$email])) {
            $this->byEmail[$email] = $id;
        }
        if (($phone = ClientImport::phoneKey($values['phone'])) !== null) {
            $this->byPhone[$phone][] = $id;
        }
        if (($nameKey = self::nameKey($name)) !== null) {
            $this->byName[$nameKey][] = $id;
        }
    }

    /**
     * @param  array{name: ?string, email: ?string, phone: ?string}  $values
     * @return array{id: int, name: string, by: string}|null
     */
    public function find(array $values): ?array
    {
        $email = self::emailKey($values['email']);

        if ($email !== null && isset($this->byEmail[$email])) {
            return $this->hit($this->byEmail[$email], 'email');
        }

        $candidates = [
            'phone' => $this->byPhone[ClientImport::phoneKey($values['phone']) ?? ''] ?? [],
            'name' => $this->byName[self::nameKey($values['name']) ?? ''] ?? [],
        ];

        foreach ($candidates as $by => $ids) {
            foreach ($ids as $id) {
                $other = $this->items[$id]['email'];
                // Email berbeda = orang berbeda, walau telepon / namanya sama.
                if ($email === null || $other === null || $email === $other) {
                    return $this->hit($id, $by);
                }
            }
        }

        return null;
    }

    /**
     * @return array{id: int, name: string, by: string}
     */
    private function hit(int $id, string $by): array
    {
        return ['id' => $id, 'name' => $this->items[$id]['name'], 'by' => $by];
    }

    private static function emailKey(?string $email): ?string
    {
        $email = $email !== null ? mb_strtolower(trim($email)) : '';

        return $email === '' ? null : $email;
    }

    private static function nameKey(?string $name): ?string
    {
        $name = $name !== null ? mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $name))) : '';

        return $name === '' ? null : $name;
    }
}
