# 🛠️ MANUAL DE MANTENIMIENTO RÁPIDO - Xiro!

**Versión**: Post-FASE 3 (Blindaje y Sincronización)  
**Fecha**: 22 de Abril de 2026

---

## 1. LIMPIEZA MANUAL DEL CACHÉ

### Cuándo Limpiar
- Después de actualizar estructura de juegos en base de datos
- Si se detectan validaciones incorrectas de PINs
- Durante mantenimiento programado
- Si el caché crece demasiado (>1000 entradas)

### Método 1: Reinicio del Contenedor (Limpieza Total)
```bash
cd /volume2/docker/xiro
docker-compose restart backend
```

**Efecto**: Limpia TODO el estado en memoria (caché, juegos activos, jugadores)  
**Tiempo de downtime**: ~10 segundos

### Método 2: Limpieza Selectiva via Node.js REPL (Sin Downtime)
```bash
# Acceder al contenedor
docker exec -it xiro_backend sh

# Ejecutar Node.js REPL
node

# Dentro de Node.js
const { pinValidationCache } = require('./state/globalState');

// Ver tamaño del caché
console.log('Entradas en caché:', pinValidationCache.size);

// Limpiar PIN específico
pinValidationCache.delete('123456');

// Limpiar TODO el caché
pinValidationCache.clear();
console.log('Caché limpiado');

// Salir
.exit
```

### Limpieza Automática
- **Intervalo**: Cada 5 minutos (automático)
- **TTL por entrada**: 5 minutos
- **Limpieza proactiva**: Al finalizar juegos (`game-over`)

---

## 1.5. LIMPIEZA DE CACHÉ DE ASSETS FRONTEND

Si se realizan cambios en los archivos `.js` o `.css` del frontend y los usuarios (jugadores o presentadores) siguen viendo la versión antigua, se debe ejecutar el script para forzar la actualización del caché en los navegadores (Cache Busting).

### Comando de actualización:
```bash
cd /volume2/docker/xiro
npm run update-assets
# o ejecutando el script directamente:
node scripts/update-assets-version.js
```

**Efecto**:
Busca todos los archivos `.html` en `/app/public/` y añade/actualiza un parámetro `?v=YYYYMMDDHHMMSS` en las importaciones locales de scripts y estilos. Los usuarios descargarán los assets actualizados en su próxima recarga.

---

## 2. UBICACIÓN DE LOGS CRÍTICOS

### Estructura de Logs

```
/volume2/docker/xiro/app/logs/
├── combined.log          # Todos los logs (info, warn, error)
├── error.log            # Solo errores críticos
├── pm2-out.log          # Salida estándar de PM2
└── pm2-error.log        # Errores de PM2
```

### Comandos de Consulta

#### Ver logs en tiempo real
```bash
# Logs combinados (recomendado)
tail -f /volume2/docker/xiro/app/logs/combined.log

# Solo errores
tail -f /volume2/docker/xiro/app/logs/error.log

# Desde Docker
docker-compose logs -f backend
```

#### Buscar eventos específicos
```bash
# Errores de submit-answer (payloads corruptos)
grep "submit-answer" /volume2/docker/xiro/app/logs/combined.log | grep error

# Limpiezas de caché
grep "PIN cache invalidated" /volume2/docker/xiro/app/logs/combined.log

# Juegos finalizados
grep "game-over" /volume2/docker/xiro/app/logs/combined.log

# Limpieza de timers
grep "Game timer cleared" /volume2/docker/xiro/app/logs/combined.log

# Errors blindados en submit-answer
grep "Uncaught error in submit-answer" /volume2/docker/xiro/app/logs/error.log
```

#### Filtrar por nivel de severidad (logs en JSON)
```bash
# Solo errores
cat /volume2/docker/xiro/app/logs/combined.log | grep '"level":"error"' | tail -20

# Solo warnings
cat /volume2/docker/xiro/app/logs/combined.log | grep '"level":"warn"' | tail -20

# Últimos 50 eventos críticos
cat /volume2/docker/xiro/app/logs/combined.log | grep -E '"level":"(error|warn)"' | tail -50
```

### Rotación de Logs
**Configuración actual**: Winston con rotación automática
- **Max size**: 20MB por archivo
- **Max files**: 14 días
- **Compresión**: Archivos antiguos se comprimen en .gz

---

## 3. MÉTRICAS DE SATURACIÓN DEL SERVIDOR

### Endpoint de Métricas
```
GET http://localhost:3000/api/metrics
```

> El endpoint real es `/api/metrics` (definido en `routes/metrics.routes.js`), no
> `/metrics`. Acepta `?roomId=` opcional para filtrar las métricas de lock distribuido
> de respuestas a una sala concreta.

**Respuesta JSON real** (estructura agrupada, no plana):
```json
{
  "system": {
    "uptime_seconds": 3600,
    "uptime_formatted": "1h 0m",
    "memory_mb": 180,
    "memory_total_mb": 220,
    "cpu_percent": 12.3
  },
  "players": {
    "active_now": 150,
    "total_connections_ever": 1820,
    "total_disconnections": 1670
  },
  "games": {
    "active_now": 8,
    "total_created": 42,
    "total_completed": 34
  },
  "database": {
    "total_queries": 5000,
    "avg_query_time_ms": 12,
    "errors": 0,
    "pool": { "total_count": 10, "idle_count": 7, "waiting_count": 0 }
  },
  "answer_lock_distributed": { "...": "métricas de lock distribuido por sala" },
  "reconnect_failed_distributed": { "...": "..." }
}
```

### 🚨 UMBRALES DE ALERTA

| Métrica (ruta real en el JSON) | Normal | Precaución | CRÍTICO | Acción |
|---------|--------|------------|---------|---------|
| **players.active_now** | <500 | 500-800 | >800 | Escalar horizontalmente |
| **games.active_now** | <50 | 50-80 | >80 | Limpiar juegos inactivos |
| **system.memory_mb** | <300MB | 300-450MB | >450MB | Reiniciar contenedor |
| **CPU (docker stats)** | <40% | 40-70% | >70% | Revisar queries DB |

### Monitoreo en Tiempo Real
```bash
# Uso de recursos del contenedor
docker stats xiro_backend

# Métricas cada 5 segundos
watch -n 5 'curl -s http://localhost:3000/api/metrics | jq'

# Jugadores activos en tiempo real
watch -n 2 'curl -s http://localhost:3000/api/metrics | jq .players.active_now'
```

### Comando de Diagnóstico Rápido
```bash
#!/bin/bash
# diagnostico-xiro.sh
echo "=== DIAGNÓSTICO Xiro! ==="
echo ""
echo "🔢 Métricas:"
curl -s http://localhost:3000/api/metrics | jq '{players: .players.active_now, games: .games.active_now, memory_mb: .system.memory_mb}'
echo ""
echo "📊 Recursos Docker:"
docker stats xiro_backend --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""
echo "❌ Últimos errores:"
tail -5 /volume2/docker/xiro/app/logs/error.log
```

---

## 4. TROUBLESHOOTING COMÚN

### Problema: Presentador se desconecta "sin motivo" en el lobby
**Síntoma**: En la consola del navegador aparece `Timeout: Socket no se pudo conectar en 10 segundos`. El presenter muestra pantalla de error.  
**Causa**: El socket del presentador usaba solo WebSocket sin fallback. Si el handshake WS falla puntualmente (backend reiniciando, proxy, red), la conexión queda muerta.  
**Solución**: ✅ Corregido en `presenter-socket-config.js` (22/04/2026): `transports: ['websocket', 'polling']` con upgrade automático.

**Diagnóstico si vuelve a ocurrir**:
```bash
# Logs del servidor con prefijo DIAG (desconexiones + intentos de reconexion)
grep '\[DIAG\]' /volume2/docker/xiro/app/logs/pm2-out.log | tail -50

# Buscar el reason exacto del disconnect y si reconnect-presenter llegó al servidor
grep -E '\[DIAG\].*(disconnect|reconnect-presenter)' /volume2/docker/xiro/app/logs/pm2-out.log | tail -30
```
En paralelo, revisar la **consola del navegador** del presentador — los logs muestran el `reason` de desconexión (p.ej. `transport close`, `ping timeout`, `io server disconnect`) y si el token de admin estaba vacío antes de emitir `reconnect-presenter`.

---

### Problema: Auto-reveal no funciona en algunas preguntas
**Síntoma**: Al contestar todos los jugadores, 1 o 2 preguntas de cada 4 no se auto-revelan. Se revelan pasados ~5-8 segundos por timeout.  
**Causa**: La clave Redis del reveal lock (`game:reveal-lock:{roomId}`) no incluía el índice de pregunta. El lock de la pregunta N (TTL 8s) bloqueaba a la N+1.  
**Solución**: ✅ Corregido en `AtomicAnswerCounter.js` (22/04/2026): clave scoped por `questionIndex` (`game:reveal-lock:{roomId}:{questionIndex}`) + helper `releaseRevealLock`.  
**Verificación**:
```bash
grep 'Reveal lock not acquired' /volume2/docker/xiro/app/logs/pm2-out.log | tail -10
# Si el fix está activo: este mensaje no debe aparecer consecutivamente para índices distintos
```

---

### Problema: Servidor crashea por payloads corruptos
**Síntoma**: Reinicios constantes de PM2  
**Solución**: ✅ FASE 3 implementó try-catch global en `submit-answer`  
**Verificación**:
```bash
grep "Uncaught error in submit-answer" /volume2/docker/xiro/app/logs/error.log
```

### Problema: Timers acelerados en frontend TV
**Síntoma**: Cuenta regresiva va más rápido de lo normal  
**Solución**: ✅ FASE 3 implementó `clearGameTimer()` antes de cada `startTimer()`  
**Verificación**:
```bash
grep "Game timer cleared explicitly" /volume2/docker/xiro/app/logs/combined.log
```

### Problema: Caché de PINs desactualizado
**Síntoma**: Jugadores no pueden unirse a juego recién creado  
**Solución**: ✅ FASE 3 implementó invalidación proactiva en `game-over`  
**Verificación**:
```bash
grep "PIN cache invalidated proactively" /volume2/docker/xiro/app/logs/combined.log
```

### Problema: Memoria creciendo sin control
**Síntoma**: `heapUsed` aumenta continuamente  
**Diagnóstico**:
```bash
# Ver si hay juegos/jugadores zombies
curl http://localhost:3000/metrics | jq '{players, games}'

# Ejecutar cleanup manual
docker exec xiro_backend node -e "
const { players, activeGames } = require('./state/globalState');
console.log('Players:', players.size, 'Games:', Object.keys(activeGames).length);
"
```

**Solución**: Reiniciar contenedor si métricas son anormales

---

## 5. COMANDOS DE EMERGENCIA

### Reinicio Rápido (10 segundos downtime)
```bash
cd /volume2/docker/xiro && docker-compose restart backend
```

### Reconstrucción Completa (30 segundos downtime)
```bash
cd /volume2/docker/xiro
docker-compose down backend
docker-compose up -d --build backend
```

### Backup de Logs Antes de Limpiar
```bash
cd /volume2/docker/xiro/app/logs
tar -czf logs-backup-$(date +%Y%m%d-%H%M%S).tar.gz *.log
rm *.log
docker-compose restart backend
```

### Verificar Salud del Sistema
```bash
# Health check (la ruta real es /api/health, no /health)
curl http://localhost:3000/api/health

# Variantes más ligeras para liveness/readiness probes:
curl http://localhost:3000/live
curl http://localhost:3000/ready
```

---

## 6. CONTACTOS Y ESCALACIÓN

### Niveles de Severidad

| Nivel | Condición | Tiempo Respuesta | Acción |
|-------|-----------|------------------|--------|
| 🟢 INFO | Operación normal | - | Monitoreo pasivo |
| 🟡 WARN | Métricas en precaución | 1 hora | Revisar logs |
| 🔴 ERROR | Crasheos, >70% CPU | 15 minutos | Reiniciar contenedor |
| ⚫ CRÍTICO | Servicio caído | Inmediato | Escalación a DevOps |

### Checklist de Escalación
1. ✅ Revisar `/metrics` endpoint
2. ✅ Revisar últimos 100 logs de error
3. ✅ Ejecutar `docker stats` para ver recursos
4. ✅ Intentar reinicio rápido
5. ❌ Si persiste → Contactar equipo DevOps

---

**Documento de Referencia Rápida - Mantener Accesible**  
**Última actualización**: FASE 3 - 24 Enero 2026
