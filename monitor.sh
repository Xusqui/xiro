#!/bin/bash

# Script de monitoreo para Xiro!
# Uso: ./monitor.sh

echo "🔍 Estado de Xiro!"
echo "==================="
echo ""

# Estado de contenedores
echo "📦 Contenedores:"
sudo docker-compose ps

echo ""
echo "💾 Uso de Recursos:"
sudo docker stats --no-stream xiro_backend xiro_postgres

echo ""
echo "🏥 Health Check:"
curl -s http://localhost:3000/api/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/health

echo ""
echo "🔌 Conexiones PostgreSQL:"
sudo docker exec xiro_postgres psql -U postgres -d xiro_db -c "SELECT count(*) as conexiones_activas FROM pg_stat_activity WHERE state = 'active';"

echo ""
echo "📊 Estadísticas de Base de Datos:"
sudo docker exec xiro_postgres psql -U postgres -d xiro_db -c "
SELECT 
    (SELECT count(*) FROM question_banks) as bancos,
    (SELECT count(*) FROM questions) as preguntas,
    (SELECT count(*) FROM games) as juegos,
    (SELECT count(*) FROM custom_games) as juegos_personalizados;
"

echo ""
echo "📝 Últimas 10 líneas de log del backend:"
sudo docker-compose logs --tail=10 backend

echo ""
echo "✅ Monitoreo completado"
