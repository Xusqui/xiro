#!/bin/bash

# Monitorización rápida de Xiro!
# Uso: ./monitor.sh

source "$(dirname "$0")/scripts/xiro-env.sh"

echo "🔍 Estado de Xiro!"
echo "==================="
echo ""

echo "📦 Contenedores:"
"${COMPOSE[@]}" ps

echo ""
echo "💾 Uso de Recursos:"
docker stats --no-stream xiro_backend xiro_postgres xiro_redis

echo ""
echo "🏥 Health Check:"
curl -s "http://localhost:${APP_PORT}/ready" | jq '.' 2>/dev/null || curl -s "http://localhost:${APP_PORT}/ready"

echo ""
echo "🔌 Conexiones PostgreSQL:"
xiro_psql -d "$DB_NAME" -c "SELECT count(*) AS conexiones_activas FROM pg_stat_activity WHERE state = 'active';"

echo ""
echo "📊 Estadísticas de Base de Datos:"
xiro_psql -d "$DB_NAME" -c "
SELECT
    (SELECT count(*) FROM question_banks) AS bancos,
    (SELECT count(*) FROM questions) AS preguntas,
    (SELECT count(*) FROM games) AS juegos,
    (SELECT count(*) FROM custom_games) AS juegos_personalizados;
"

echo ""
echo "📝 Últimas 10 líneas de log del backend:"
"${COMPOSE[@]}" logs --tail=10 backend

echo ""
echo "✅ Monitoreo completado"
