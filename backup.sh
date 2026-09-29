#!/bin/bash

# Backup manual de la base de datos de Xiro!
# Uso: ./backup.sh

set -o pipefail
source "$(dirname "$0")/scripts/xiro-env.sh"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/xiro_backup_${TIMESTAMP}.sql.gz"

echo "💾 Iniciando backup de Xiro!..."
mkdir -p "$BACKUP_DIR"

echo "📦 Exportando base de datos..."
if docker exec xiro_postgres pg_dump -U "$DB_USER" -p 5439 "$DB_NAME" | gzip > "${BACKUP_FILE}.tmp"; then
    mv "${BACKUP_FILE}.tmp" "$BACKUP_FILE"
    echo "✅ Backup completado: $BACKUP_FILE"

    echo ""
    echo "📂 Backups disponibles:"
    ls -lh "$BACKUP_DIR"

    echo ""
    echo "🧹 Limpiando backups antiguos (>7 días)..."
    find "$BACKUP_DIR" -name "xiro_backup_*.sql.gz" -type f -mtime +7 -delete

    echo "✅ Proceso de backup finalizado"
else
    rm -f "${BACKUP_FILE}.tmp"
    echo "❌ Error durante el backup"
    exit 1
fi
