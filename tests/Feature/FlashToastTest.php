<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('forwards controller session flash to the inertia toast', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['success' => 'Klien ditambahkan.'])
        ->get('/dashboard')
        ->assertOk()
        ->assertSee('Klien ditambahkan.', false);
});
