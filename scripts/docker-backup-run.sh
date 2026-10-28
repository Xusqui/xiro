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

# Métricas para el textfile collector de node-exporter (monitoring/README.md).
# $1 = 1 (éxito) o 0 (fallo); $2 = tamaño en bytes del backup (solo en éxito).
write_metrics() {
    local dir="/backups/metrics"
    local file="$dir/xiro_backup.prom"
    local now
    now=$(date +%s)
    mkdir -p "$dir" && chmod 755 "$dir" 2>/dev/null
    local last_success
    last_success=$(grep '^xiro_backup_last_success_timestamp_seconds ' "$file" 2>/dev/null | cut -d' ' -f2)
    local last_size
    last_size=$(grep '^xiro_backup_last_size_bytes ' "$file" 2>/dev/null | cut -d' ' -f2)
    if [ "$1" = "1" ]; then
        last_success="$now"
        last_size="$2"
    fi
    {
        echo "# HELP xiro_backup_last_run_timestamp_seconds Fin del último backup (con éxito o no)."
        echo "# TYPE xiro_backup_last_run_timestamp_seconds gauge"
        echo "xiro_backup_last_run_timestamp_seconds $now"
        echo "# HELP xiro_backup_last_run_success 1 si el último backup terminó bien."
        echo "# TYPE xiro_backup_last_run_success gauge"
        echo "xiro_backup_last_run_success $1"
        if [ -n "$last_success" ]; then
            echo "# HELP xiro_backup_last_success_timestamp_seconds Fin del último backup correcto."
            echo "# TYPE xiro_backup_last_success_timestamp_seconds gauge"
            echo "xiro_backup_last_success_timestamp_seconds $last_success"
            echo "# HELP xiro_backup_last_size_bytes Tamaño del último backup correcto."
            echo "# TYPE xiro_backup_last_size_bytes gauge"
            echo "xiro_backup_last_size_bytes ${last_size:-0}"
        fi
    } > "$file.tmp" && chmod 644 "$file.tmp" && mv "$file.tmp" "$file"
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
    write_metrics 0
    exit 1
fi

export PGPASSWORD="$RESOLVED_PASSWORD"

# En una tubería, «if» solo ve el código de gzip: un pg_dump cortado a medias daría
# un .gz válido pero incompleto. El código de pg_dump se guarda aparte (sin
# depender de «set -o pipefail», que no todos los sh admiten).
DUMP_STATUS_FILE="${TMP_FILE}.status"
rm -f "$DUMP_STATUS_FILE"

if {
    pg_dump \
        -h "$DB_HOST_RESOLVED" \
        -p "$DB_PORT_RESOLVED" \
        -U "$DB_USER_RESOLVED" \
        "$DB_NAME_RESOLVED"
    echo $? > "$DUMP_STATUS_FILE"
} | gzip > "$TMP_FILE" && [ "$(cat "$DUMP_STATUS_FILE" 2>/dev/null)" = "0" ]; then

    rm -f "$DUMP_STATUS_FILE"
    chmod 600 "$TMP_FILE" 2>/dev/null || true
    mv "$TMP_FILE" "$DEST_FILE"

    SIZE=$(du -sh "$DEST_FILE" 2>/dev/null | cut -f1)
    echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Backup completado: $DEST_FILE ($SIZE)"
    write_metrics 1 "$(wc -c < "$DEST_FILE" | tr -d ' ')"
else
    echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — ERROR: pg_dump falló (código $(cat "$DUMP_STATUS_FILE" 2>/dev/null || echo '?'))" >&2
    # Solo el temporal: DEST_FILE, si existe, es un backup anterior correcto del mismo segundo.
    rm -f "$TMP_FILE" "$DUMP_STATUS_FILE"
    write_metrics 0
    exit 1
fi

# ─── cleanup ────────────────────────────────────────────────────────────────

DELETED=$(find /backups -name "*.sql.gz" -mtime +"$RETENTION" -print -delete 2>/dev/null | wc -l)
echo "[backup] Limpieza: $DELETED archivo(s) eliminado(s) con más de ${RETENTION} día(s) de antigüedad"
