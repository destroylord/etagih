#!/bin/sh
# Entrypoint container PHP (app, worker, scheduler).
# Cache konfigurasi dibuat saat start karena .env baru tersedia di runtime.
set -e

cd /var/www/html

# Volume storage bisa kosong saat pertama kali dipasang.
mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
    storage/framework/sessions storage/framework/views storage/logs

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY belum di-set di .env (jalankan: docker compose run --rm app php artisan key:generate --show)" >&2
    exit 1
fi

# Hanya container utama (app) yang menjalankan migrasi bila diminta.
if [ "${CONTAINER_ROLE:-app}" = "app" ] && [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force --no-interaction
fi

php artisan optimize --no-interaction >/dev/null

exec "$@"
