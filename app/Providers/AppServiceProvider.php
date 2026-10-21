<?php

namespace App\Providers;

use App\Notifications\ResetPasswordMail;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // Email reset password dalam Bahasa Indonesia.
        ResetPassword::toMailUsing(fn (object $notifiable, string $token) => ResetPasswordMail::build($notifiable, $token));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        // diffForHumans()/translatedFormat() mengikuti locale aplikasi (default: id).
        Carbon::setLocale((string) config('app.locale'));
        CarbonImmutable::setLocale((string) config('app.locale'));

        $proxies = (string) config('app.trusted_proxies', '127.0.0.1');
        TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
