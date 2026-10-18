#!/bin/sh
# Backup harian eTagih: database + file upload (logo, tanda tangan, QRIS).
#
#   ./docker/backup.sh                 # simpan ke ./backups, hapus yang > 14 hari
#   BACKUP_DIR=/root/backups KEEP_DAYS=30 ./docker/backup.sh
#
# Cron (tiap hari 02:00):
#   0 2 * * * cd /opt/etagih && ./docker/backup.sh >> /var/log/etagih-backup.log 2>&1
set -eu

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# Baca kredensial dari .env
DB_DATABASE="$(grep -E '^DB_DATABASE=' .env | cut -d= -f2-)"
DB_ROOT_PASSWORD="$(grep -E '^DB_ROOT_PASSWORD=' .env | cut -d= -f2-)"

echo "[$(date)] Backup database..."
docker compose exec -T db mariadb-dump \
    -uroot -p"$DB_ROOT_PASSWORD" \
    --single-transaction --quick --routines --triggers \
    "$DB_DATABASE" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

echo "[$(date)] Backup file upload..."
docker compose exec -T app tar -C /var/www/html/storage/app -czf - public \
    > "$BACKUP_DIR/storage-$STAMP.tar.gz"

find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "[$(date)] Selesai: $BACKUP_DIR/db-$STAMP.sql.gz, $BACKUP_DIR/storage-$STAMP.tar.gz"
