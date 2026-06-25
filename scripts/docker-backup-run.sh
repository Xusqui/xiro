#!/bin/sh
# Script de backup ejecutado por crond.
# Argumento opcional $1: días de retención (sobreescribe CONFIG_FILE / env var).

CONFIG_FILE="/app-config/runtime-overrides.json"
SECRET_SENTINEL="__USE_ENV_DB_PASSWORD__"
DB_PASSWORD_FILE_RESOLVED="${DB_PASSWORD_FILE:-/run/secrets/db_password}"

# Endurecer permisos por defecto para cualquier artefacto generado por el backup.
umask 077

# ─── helpers ────────────────────────────────────────────────────────────────

get_json_value() {
    local key="$1"
    local default="$2"
    local val=""
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -o "\"${key}\":\"[^\"]*\"" "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/.*":\"//' | sed 's/"//')
    fi
    echo "${val:-$default}"
}

resolve_db_password() {
    local secret_value=""
    if [ -r "$DB_PASSWORD_FILE_RESOLVED" ]; then
        secret_value=$(tr -d '\r\n' < "$DB_PASSWORD_FILE_RESOLVED")
    fi

    if [ -n "$secret_value" ] && [ "$secret_value" != "$SECRET_SENTINEL" ]; then
        echo "$secret_value"
        return 0
    fi

    if [ -n "${DB_PASSWORD:-}" ]; then
        echo "$DB_PASSWORD"
        return 0
    fi

    if [ -n "${PGPASSWORD:-}" ]; then
        echo "$PGPASSWORD"
        return 0
    fi

    return 1
}

# ─── config ─────────────────────────────────────────────────────────────────

# Argumento posicional tiene prioridad (enviado desde el crontab por el entrypoint)
RETENTION="${1:-$(get_json_value "BACKUP_RETENTION_DAYS" "${BACKUP_RETENTION_DAYS:-7}")}"

DB_HOST_RESOLVED="${DB_HOST:-127.0.0.1}"
DB_PORT_RESOLVED="${DB_PORT:-5439}"
DB_USER_RESOLVED="${DB_USER:-postgres}"
DB_NAME_RESOLVED="${DB_NAME:-xiro_db}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST_FILE="/backups/xiro_backup_${TIMESTAMP}.sql.gz"
TMP_FILE="${DEST_FILE}.tmp"

# ─── backup ─────────────────────────────────────────────────────────────────

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Iniciando backup → $DEST_FILE"

mkdir -p /backups
chmod 700 /backups 2>/dev/null || true

if ! RESOLVED_PASSWORD=$(resolve_db_password); then
    echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — ERROR: falta DB_PASSWORD o DB_PASSWORD_FILE válido" >&2
    exit 1
fi

export PGPASSWORD="$RESOLVED_PASSWORD"

if pg_dump \
    -h "$DB_HOST_RESOLVED" \
    -p "$DB_PORT_RESOLVED" \
    -U "$DB_USER_RESOLVED" \
    "$DB_NAME_RESOLVED" \
    | gzip > "$TMP_FILE"; then

    chmod 600 "$TMP_FILE" 2>/dev/null || true
    mv "$TMP_FILE" "$DEST_FILE"

    SIZE=$(du -sh "$DEST_FILE" 2>/dev/null | cut -f1)
    echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Backup completado: $DEST_FILE ($SIZE)"
else
    echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — ERROR: pg_dump falló" >&2
    rm -f "$TMP_FILE" "$DEST_FILE"
    exit 1
fi

# ─── cleanup ────────────────────────────────────────────────────────────────

DELETED=$(find /backups -name "*.sql.gz" -mtime +"$RETENTION" -print -delete 2>/dev/null | wc -l)
echo "[backup] Limpieza: $DELETED archivo(s) eliminado(s) con más de ${RETENTION} día(s) de antigüedad"
