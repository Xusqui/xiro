#!/bin/bash

# Xiro! - Comandos Rápidos de Gestión
# =======================================

case "$1" in
    start)
        echo "🚀 Iniciando Xiro!..."
        docker-compose up -d
        echo "✅ Servicios iniciados"
        docker-compose ps
        ;;
    
    stop)
        echo "🛑 Deteniendo Xiro!..."
        docker-compose down
        echo "✅ Servicios detenidos"
        ;;
    
    restart)
        echo "🔄 Reiniciando Xiro!..."
        docker-compose restart
        echo "✅ Servicios reiniciados"
        docker-compose ps
        ;;
    
    status)
        echo "📊 Estado de Xiro!:"
        docker-compose ps
        echo ""
        ./monitor.sh
        ;;
    
    logs)
        if [ -z "$2" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$2"
        fi
        ;;
    
    backup)
        ./backup.sh
        ;;
    
    restore)
        if [ -z "$2" ]; then
            echo "❌ Error: Especifica el archivo de backup"
            echo "Uso: ./manage.sh restore backups/archivo.sql.gz"
            exit 1
        fi
        ./restore.sh "$2"
        ;;
    
    update)
        echo "📦 Actualizando Xiro!..."
        docker-compose down
        docker-compose pull
        docker-compose up -d --build
        echo "✅ Actualización completada"
        ;;
    
    clean)
        echo "🧹 Limpiando recursos no utilizados..."
        docker system prune -f
        echo "✅ Limpieza completada"
        ;;
    
    db)
        echo "🗄️ Conectando a PostgreSQL..."
        docker exec -it xiro_postgres psql \
            -U "${DB_USER:-postgres}" \
            -p "${DB_PORT:-5439}" \
            -d "${DB_NAME:-xiro_db}"
        ;;
    
    stats)
        echo "📊 Estadísticas de recursos:"
        docker stats --no-stream xiro_backend xiro_postgres
        ;;
    
    health)
        echo "🏥 Health check:"
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health
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
        echo "  restore     - Restaurar backup (requiere archivo)"
        echo "  update      - Actualizar contenedores"
        echo "  clean       - Limpiar recursos Docker"
        echo "  db          - Conectar a PostgreSQL"
        echo "  stats       - Ver uso de recursos"
        echo "  health      - Health check del backend"
        echo ""
        echo "Ejemplos:"
        echo "  ./manage.sh start"
        echo "  ./manage.sh logs backend"
        echo "  ./manage.sh restore backups/xiro_backup_20250111_120000.sql.gz"
        echo "";
        echo "";
        echo "Para borrar la cuenta atrás para poder loggearte haz:"
        echo "1.- command -v redis-cli && (redis-cli --scan --pattern 'rl:*' | head -20 || true)"
        echo "2.- Te devuelve una IP, ej: rl: 104.22.23.61"
        echo "3.- haz redis-cli DEL rl:IP"
        echo "4.- Ej: redis-cli DEL rl:104.22.23.61"
        echo "5.- Listo, ya puedes loggearte"        
        ;;
esac
