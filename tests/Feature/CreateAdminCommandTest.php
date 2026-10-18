<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('creates and then updates an admin account', function () {
    $this->artisan('app:create-admin', ['--name' => 'Pemilik', '--email' => 'Owner@Example.com', '--password' => 'rahasia123'])
        ->assertSuccessful();

    $user = User::firstWhere('email', 'owner@example.com');
    expect($user)->not->toBeNull()
        ->and(Hash::check('rahasia123', $user->password))->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull();

    $this->artisan('app:create-admin', ['--name' => 'Pemilik', '--email' => 'owner@example.com', '--password' => 'barulagi123'])
        ->assertSuccessful();

    expect(User::count())->toBe(1)
        ->and(Hash::check('barulagi123', $user->fresh()->password))->toBeTrue();
});

it('rejects a short password', function () {
    $this->artisan('app:create-admin', ['--name' => 'X', '--email' => 'x@example.com', '--password' => 'pendek'])
        ->assertFailed();

    expect(User::count())->toBe(0);
});
