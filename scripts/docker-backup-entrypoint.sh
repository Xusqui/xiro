#!/bin/sh
# Entrypoint del contenedor de backup automático.
# Lee la configuración desde /app-config/runtime-overrides.json (generado por el panel admin)
# con fallback a las variables de entorno. Escribe el crontab y arranca crond en primer plano.
# Para aplicar cambios de configuración: docker compose restart backup

CONFIG_FILE="/app-config/runtime-overrides.json"
CRONTAB_DIR="/etc/crontabs"
CRONTAB_FILE="$CRONTAB_DIR/root"

# Permisos estrictos para crontab y archivos temporales del proceso.
umask 077

# ─── helpers ────────────────────────────────────────────────────────────────

get_json_value() {
    local key="$1"
    local default="$2"
    local val=""
    if [ -f "$CONFIG_FILE" ]; then
        val=$(grep -o "\"${key}\":\"[^\"]*\"" "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/.*":\"//' | sed 's/"//' || true)
    fi
    echo "${val:-$default}"
}

# ─── crontab ────────────────────────────────────────────────────────────────

schedule=$(get_json_value "BACKUP_SCHEDULE" "${BACKUP_SCHEDULE:-0 2 * * *}")
retention=$(get_json_value "BACKUP_RETENTION_DAYS" "${BACKUP_RETENTION_DAYS:-7}")

mkdir -p "$CRONTAB_DIR"
chmod 0700 "$CRONTAB_DIR" 2>/dev/null || true

if [ "$schedule" = "disabled" ]; then
    # Crontab vacío — crond arranca pero no ejecuta nada
    printf "" > "$CRONTAB_FILE"
    echo "[backup] Backup automático desactivado (crond en espera)"
else
    printf "%s /scripts/docker-backup-run.sh %s\n" "$schedule" "$retention" > "$CRONTAB_FILE"
    echo "[backup] Programación: $schedule | Retención: ${retention} días"
fi

chmod 0600 "$CRONTAB_FILE" 2>/dev/null || true

# ─── arrancar crond en primer plano (PID 1 del contenedor) ──────────────────
echo "[backup] Iniciando crond..."
exec crond -f -c "$CRONTAB_DIR" -l 2

