#!/bin/bash

# Script de restauración para Xiro!
# Uso: ./restore.sh backup_file.sql.gz

if [ -z "$1" ]; then
    echo "❌ Error: Debes especificar el archivo de backup"
    echo "Uso: ./restore.sh backups/xiro_backup_YYYYMMDD_HHMMSS.sql.gz"
    echo ""
    echo "Backups disponibles:"
    ls -1 backups/*.sql.gz 2>/dev/null || echo "No hay backups disponibles"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: El archivo $BACKUP_FILE no existe"
    exit 1
fi

echo "⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual"
read -p "¿Estás seguro? (escribe 'SI' para continuar): " confirm

if [ "$confirm" != "SI" ]; then
    echo "❌ Restauración cancelada"
    exit 0
fi

echo "💾 Iniciando restauración..."

# Descomprimir si es necesario
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "📦 Descomprimiendo backup..."
    gunzip -k "$BACKUP_FILE"
    SQL_FILE="${BACKUP_FILE%.gz}"
else
    SQL_FILE="$BACKUP_FILE"
fi

# Restaurar base de datos
echo "📥 Restaurando base de datos..."
docker exec -i xiro_postgres psql -U postgres -d xiro_db < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Restauración completada exitosamente"
    
    # Limpiar archivo temporal si se descomprimió
    if [[ $BACKUP_FILE == *.gz ]]; then
        rm "$SQL_FILE"
    fi
else
    echo "❌ Error durante la restauración"
    exit 1
fi
