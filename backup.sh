#!/bin/bash

# Script de backup para Xiro!
# Uso: ./backup.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="xiro_backup_${TIMESTAMP}.sql"

echo "💾 Iniciando backup de Xiro!..."

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Hacer backup de PostgreSQL
echo "📦 Exportando base de datos..."
docker exec xiro_postgres pg_dump -U postgres xiro_db > "${BACKUP_DIR}/${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo "✅ Backup completado: ${BACKUP_DIR}/${BACKUP_FILE}"
    
    # Comprimir backup
    gzip "${BACKUP_DIR}/${BACKUP_FILE}"
    echo "📦 Backup comprimido: ${BACKUP_DIR}/${BACKUP_FILE}.gz"
    
    # Listar backups existentes
    echo ""
    echo "📂 Backups disponibles:"
    ls -lh "${BACKUP_DIR}"
    
    # Eliminar backups antiguos (mantener últimos 7 días)
    echo ""
    echo "🧹 Limpiando backups antiguos (>7 días)..."
    find "${BACKUP_DIR}" -name "xiro_backup_*.sql.gz" -type f -mtime +7 -delete
    
    echo "✅ Proceso de backup finalizado"
else
    echo "❌ Error durante el backup"
    exit 1
fi
