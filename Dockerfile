# syntax=docker/dockerfile:1.7
#
# eTagih — image produksi ramping (Alpine, multi-stage).
#
#   target `app`  → PHP-FPM (dipakai juga untuk queue worker & scheduler)
#   target `web`  → Caddy (HTTPS otomatis + file statis + FastCGI ke `app`)
#
# Node & Composer hanya dipakai saat build, tidak ikut ke image akhir.

ARG PHP_VERSION=8.4

# ---------------------------------------------------------------------------
# 1. Base PHP: ekstensi yang dibutuhkan aplikasi saja
# ---------------------------------------------------------------------------
FROM php:${PHP_VERSION}-fpm-alpine AS php-base

RUN set -eux; \
    apk add --no-cache \
        icu-libs libzip libpng libjpeg-turbo libwebp freetype fcgi tzdata; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
        icu-dev libzip-dev libpng-dev libjpeg-turbo-dev libwebp-dev freetype-dev linux-headers; \
    docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp; \
    docker-php-ext-install -j"$(nproc)" gd intl pdo_mysql bcmath zip exif opcache pcntl; \
    apk del .build-deps; \
    rm -rf /tmp/* /usr/src/php*

WORKDIR /var/www/html

# ---------------------------------------------------------------------------
# 2. Dependency PHP (tanpa dev)
# ---------------------------------------------------------------------------
FROM php-base AS vendor

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && php artisan package:discover --ansi

# ---------------------------------------------------------------------------
# 3. Build frontend (Vite). Plugin Wayfinder menjalankan `php artisan`,
#    jadi stage ini butuh PHP + Node.
# ---------------------------------------------------------------------------
FROM vendor AS assets

ARG VITE_APP_NAME=eTagih
# Plugin Vite Wayfinder memanggil `php artisan` lagi saat build → env harus berlaku
# untuk seluruh stage (stage ini tidak ikut ke image akhir; APP_KEY hanya dummy).
ENV VITE_APP_NAME=${VITE_APP_NAME} \
    APP_ENV=production \
    APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=

RUN apk add --no-cache nodejs npm
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
RUN php artisan wayfinder:generate --with-form \
    && npm run build \
    && rm -rf node_modules

# ---------------------------------------------------------------------------
# 4. Runtime PHP-FPM
# ---------------------------------------------------------------------------
FROM php-base AS app

# Versi aplikasi (diisi workflow docker.yml dari tag rilis; dipakai cek update).
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/zz-www.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint

COPY --from=vendor --chown=www-data:www-data /var/www/html /var/www/html
COPY --from=assets --chown=www-data:www-data /var/www/html/public/build /var/www/html/public/build

RUN chmod +x /usr/local/bin/entrypoint \
    && rm -rf tests node_modules .env .env.* docker \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD SCRIPT_NAME=/ping SCRIPT_FILENAME=/ping REQUEST_METHOD=GET cgi-fcgi -bind -connect 127.0.0.1:9000 | grep -q pong || exit 1

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

# ---------------------------------------------------------------------------
# 5. Web server Caddy — hanya butuh folder public/
# ---------------------------------------------------------------------------
FROM caddy:2-alpine AS web

COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=assets /var/www/html/public /var/www/html/public
