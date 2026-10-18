<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));

        $products = Product::query()
            ->with('client')
            ->when($q !== '', fn ($w) => $w->where(function ($x) use ($q) {
                $x->where('name', 'like', "%{$q}%")
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            }))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('products/index', [
            'products' => $products,
            'clients' => Client::orderBy('name')->get(['id', 'name']),
            'filters' => ['q' => $q],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Product::create($request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return back()->with('success', 'Produk ditambahkan.');
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $product->update($request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return back()->with('success', 'Produk diperbarui.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        return back()->with('success', 'Produk dihapus.');
    }
}
