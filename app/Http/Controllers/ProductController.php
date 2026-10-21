<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use App\Support\Access;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $user = $this->user($request);
        // Staf: produk umum + produk klien yang terlihat (lihat App\Support\Access).
        $clientIds = Access::clientIds($user);

        $products = Product::query()
            ->with('client')
            ->when($clientIds !== null, fn ($w) => $w->where(fn ($x) => $x->whereNull('client_id')->orWhereIn('client_id', $clientIds)))
            ->when($q !== '', fn ($w) => $w->where(function ($x) use ($q) {
                $x->where('name', 'like', "%{$q}%")
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('products/index', [
            'products' => $products,
            'clients' => Client::visibleTo($user)->orderBy('name')->get(['id', 'name']),
            'filters' => ['q' => $q],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Product::create($this->validated($request));

        return back()->with('success', 'Produk ditambahkan.');
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $product->update($this->validated($request));

        return back()->with('success', 'Produk diperbarui.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        return back()->with('success', 'Produk dihapus.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $user = $this->user($request);

        return $request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id', function (string $attribute, mixed $value, Closure $fail) use ($user) {
                // Staf hanya boleh mengaitkan produk ke klien yang terlihat.
                if ($value !== null && ! Access::canSeeClient($user, (int) $value)) {
                    $fail('Anda tidak punya akses ke klien ini.');
                }
            }],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
