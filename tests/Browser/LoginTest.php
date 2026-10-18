<?php

use App\Models\User;
use Laravel\Dusk\Browser;

test('user can login and is redirected to dashboard', function () {
    $user = User::factory()->create([
        'email' => 'test@example.com',
        'password' => bcrypt('password'),
    ]);

    $this->browse(function (Browser $browser) {
        $browser->visit('/login')
            ->waitFor('input[name=email]')
            ->type('email', 'test@example.com')
            ->type('password', 'password')
            ->press('Masuk')
            ->waitForLocation('/dashboard')
            ->assertPathIs('/dashboard');
    });
});
