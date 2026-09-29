#!/bin/bash

# Xiro! - Comandos Rápidos de Gestión
# =======================================

source "$(dirname "$0")/scripts/xiro-env.sh"

case "$1" in
    start)
        echo "🚀 Iniciando Xiro!..."
        "${COMPOSE[@]}" up -d
        echo "✅ Servicios iniciados"
        "${COMPOSE[@]}" ps
        ;;

    stop)
        echo "🛑 Deteniendo Xiro!..."
        "${COMPOSE[@]}" down
        echo "✅ Servicios detenidos"
        ;;

    restart)
        echo "🔄 Reiniciando Xiro!..."
        "${COMPOSE[@]}" restart
        echo "✅ Servicios reiniciados"
        "${COMPOSE[@]}" ps
        ;;

    status)
        echo "📊 Estado de Xiro!:"
        "$XIRO_DIR/monitor.sh"
        ;;

    logs)
        if [ -z "$2" ]; then
            "${COMPOSE[@]}" logs -f
        else
            "${COMPOSE[@]}" logs -f "$2"
        fi
        ;;

    backup)
        "$XIRO_DIR/backup.sh"
        ;;

    restore)
        if [ -z "$2" ]; then
            echo "❌ Error: Especifica el archivo de backup"
            echo "Uso: ./manage.sh restore backups/archivo.sql.gz"
            exit 1
        fi
        "$XIRO_DIR/restore.sh" "$2"
        ;;

    update)
        echo "📦 Actualizando Xiro!..."
        "${COMPOSE[@]}" pull --quiet db redis chrome
        "${COMPOSE[@]}" up -d --build
        echo "✅ Actualización completada"
        ;;

    clean)
        echo "🧹 Limpiando recursos no utilizados..."
        docker system prune -f
        echo "✅ Limpieza completada"
        ;;

    db)
        echo "🗄️ Conectando a PostgreSQL..."
        docker exec -it xiro_postgres psql -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME"
        ;;

    stats)
        echo "📊 Estadísticas de recursos:"
        docker stats --no-stream xiro_backend xiro_postgres xiro_redis
        ;;

    health)
        echo "🏥 Health check:"
        curl -s "http://localhost:${APP_PORT}/ready" | jq '.' 2>/dev/null || curl -s "http://localhost:${APP_PORT}/ready"
        echo ""
        ;;

    *)
        echo "Xiro! - Gestión de Servicios"
        echo "=============================="
        echo ""
        echo "Uso: ./manage.sh [comando]"
        echo ""
        echo "Comandos disponibles:"
        echo "  start       - Iniciar servicios"
        echo "  stop        - Detener servicios"
        echo "  restart     - Reiniciar servicios"
        echo "  status      - Ver estado completo"
        echo "  logs        - Ver logs en tiempo real"
        echo "  backup      - Hacer backup de la BD"
        echo "  restore     - Restaurar backup (requiere archivo; sustituye la BD actual)"
        echo "  update      - Actualizar imágenes y reconstruir contenedores"
        echo "  clean       - Limpiar recursos Docker no utilizados"
        echo "  db          - Conectar a PostgreSQL"
        echo "  stats       - Ver uso de recursos"
        echo "  health      - Health check del backend"
        echo ""
        echo "Ejemplos:"
        echo "  ./manage.sh start"
        echo "  ./manage.sh logs backend"
        echo "  ./manage.sh restore backups/xiro_backup_20250111_120000.sql.gz"
        echo ""
        echo "Si el login de admin queda bloqueado por intentos fallidos, consulta"
        echo "la sección 'Rate limit de login admin' del README."
        ;;
esac
