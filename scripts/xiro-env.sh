#!/bin/bash
# Configuración común para manage.sh, backup.sh, restore.sh y monitor.sh.
# Se carga con: source "$(dirname "$0")/scripts/xiro-env.sh"

XIRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Lee una variable de .env (ignora comentarios al final de la línea y comillas).
env_get() {
    local value
    value=$(grep -E "^$1=" "$XIRO_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- \
        | sed -E "s/[[:space:]]+#.*$//; s/^[\"']//; s/[\"']$//")
    echo "${value:-$2}"
}

# Docker Compose v2 (`docker compose`) o v1 (`docker-compose`), el que exista.
if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose -f "$XIRO_DIR/docker-compose.yml")
else
    COMPOSE=(docker-compose -f "$XIRO_DIR/docker-compose.yml")
fi

DB_USER="$(env_get DB_USER postgres)"
DB_NAME="$(env_get DB_NAME xiro_db)"
DB_PORT="$(env_get DB_PORT 5439)"
APP_PORT="$(env_get APP_PORT 3000)"
BACKUP_DIR="$XIRO_DIR/backups"

# -p también es necesario por el socket local: su nombre depende del puerto.
xiro_psql() {
    docker exec -i xiro_postgres psql -U "$DB_USER" -p "$DB_PORT" "$@"
}
