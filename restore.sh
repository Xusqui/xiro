#!/bin/bash

# Restauración de un backup de Xiro!
# Uso: ./restore.sh backups/xiro_backup_YYYYMMDD_HHMMSS.sql.gz
#
# Sustituye por completo la base de datos actual: para el backend, borra y
# recrea la base de datos, carga el backup y vuelve a arrancar el backend.

set -o pipefail
source "$(dirname "$0")/scripts/xiro-env.sh"

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Debes especificar el archivo de backup"
    echo "Uso: ./restore.sh backups/xiro_backup_YYYYMMDD_HHMMSS.sql.gz"
    echo ""
    echo "Backups disponibles:"
    ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No hay backups disponibles"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: El archivo $BACKUP_FILE no existe"
    exit 1
fi

echo "⚠️  ADVERTENCIA: Esto BORRARÁ la base de datos actual ($DB_NAME) y la sustituirá por el backup"
read -r -p "¿Estás seguro? (escribe 'SI' para continuar): " confirm

if [ "$confirm" != "SI" ]; then
    echo "❌ Restauración cancelada"
    exit 0
fi

echo "🛑 Parando el backend..."
"${COMPOSE[@]}" stop backend

echo "🗑️  Recreando la base de datos $DB_NAME..."
if ! xiro_psql -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" \
    -c "CREATE DATABASE \"$DB_NAME\";"; then
    echo "❌ No se pudo recrear la base de datos; el backend sigue parado"
    exit 1
fi

echo "📥 Restaurando backup..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | xiro_psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q
else
    xiro_psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$BACKUP_FILE"
fi
RESULT=$?

echo "🚀 Arrancando el backend..."
"${COMPOSE[@]}" start backend

if [ $RESULT -eq 0 ]; then
    echo "✅ Restauración completada"
else
    echo "❌ Error durante la restauración (revisa los mensajes de arriba)"
    exit 1
fi
