# Load Testing Guide - Week 18.2

## Objetivo

Validar que el sistema soporta **100 jugadores simultáneos** con:
- **Latencia P95 < 200ms**
- **Error rate < 0.1%**

## Herramientas

- **Artillery**: Framework de load testing para Node.js
- **Plugins**: expect (assertions), metrics-by-endpoint (métricas detalladas)

## Configuraciones de Tests

### 1. artillery.yml (Default - Flujo Completo)

**Escenario**: Flujo completo de juego
- Warm-up: 20 jugadores en 10s
- Ramp-up: 20→100 jugadores en 30s
- Sustained: 100 jugadores por 60s
- Cool-down: 100→0 en 20s

**Total duration**: 120s  
**Peak concurrency**: 100 jugadores

**Flow**:
1. Join lobby
2. Esperar inicio
3. Responder 10 preguntas (30s cada una)
4. Disconnect

### 2. artillery-join-lobby.yml (Join Stress)

**Escenario**: Estrés en join lobby
- 100 jugadores en 10s (burst)
- Mantenidos conectados 30s

**Objetivo**: Validar capacidad de lobby  
**Target**: 0 errores, P95 < 200ms

### 3. artillery-submit-answers.yml (Answer Burst)

**Escenario**: Todos responden simultáneamente
- Warm-up: 50 jugadores
- Burst: 50 más en 1s (todos responden a la vez)
- Cooldown: 5s

**Objetivo**: Validar broadcast optimization  
**Target**: P95 < 200ms, error < 0.1%

### 4. artillery-reconnection.yml (Reconnection Stress)

**Escenario**: 50 desconexiones/reconexiones aleatorias
- 50 jugadores conectan en 10s
- Desconexiones/reconexiones durante 30s

**Objetivo**: Validar sistema de reconexión  
**Target**: P95 < 300ms, error < 5%

## Uso

### Instalación

**NO requiere instalación local** - Artillery se ejecuta con `npx`:

```bash
# Verificar que funciona
npx artillery@latest --version
```

**Nota**: No instalar artillery localmente (`npm install artillery`) ya que descarga Playwright/Chrome innecesariamente y consume ~500MB de espacio.

##x artillery@latest run artillery.yml

# Tests específicos
npx artillery@latest run artillery-join-lobby.yml      # Join lobby stress
npx artillery@latest run artillery-submit-answers.yml  # Answer burst
npx artillery@latest run artillery-reconnection.yml    # Reconnection stress

# Todos los tests con script bash (incluye reportes HTML)
./scripts/run-load-tests.sh all
# Tests individuales
./scripts/run-load-tests.sh join
./scripts/run-load-tests.sh answers
./scripts/run-load-tests.sh reconnect
```

## Métricas Objetivo

| Métrica | Target | Descripción |
|---------|--------|-------------|
| **P50** | < 100ms | 50% de requests |
| **P95** | < 200ms | 95% de requests |
| **P99** | < 500ms | 99% de requests |
| **Error Rate** | < 0.1% | Máximo 1 error por 1000 requests |
| **Concurrent Players** | 100 | Sin degradación |

## Interpretación de Resultados

### Artillery Output

```
Summary report @ 14:23:45(+0100)
  Scenarios launched:  100
  Scenarios completed: 98
  Requests completed:  1000
  Mean response/sec:   10.5
  Response time (msec):
    min: 12
    max: 450
    median: 85
    p95: 180  ← OBJETIVO: <200ms
    p99: 280
  Errors:
    ETIMEDOUT: 2  ← OBJETIVO: <1
```

### ✅ Éxito

- P95 < 200ms
- Error rate < 0.1%
- 100 concurrent players sin crashes

### ⚠️ Warning

- P95 entre 200-300ms: Optimizar debouncing
- Error rate 0.1-1%: Revisar rate limiting

### ❌ Fallo

- P95 > 300ms: Problema de performance
- Error rate > 1%: Problema crítico
- Crashes durante test: Inestabilidad

## Optimizaciones Aplicadas (Week 18.1)

Las siguientes optimizaciones deben mejorar los resultados:

1. **BroadcastOptimizer** (Debouncing 100ms)
   - Reduce broadcasts de ranking
   - Smart flush >10 pending

2. **AnswerBatchService** (Batching 100ms)
   - Agrupa answer-result al presentador
   - Reduce 90% broadcasts

3. **PayloadCompressor** (Gzip >2KB)
   - Comprime rankings grandes
   - Reduce 30-50% bandwidth

4. **RankingDeltaCalculator** (Delta updates)
   - Envía solo cambios
   - Reduce 60-70% datos

## Baseline (Pre-optimización)

Comparar resultados con baseline Week 14:

| Métrica | Week 14 | Week 18 Target | Mejora |
|---------|---------|----------------|--------|
| P95 | ~350ms | <200ms | 43% faster |
| Error rate | 0.5% | <0.1% | 5x mejor |
| Concurrent | 50 max | 100 | 2x capacity |

## Troubleshooting

### Artillery no encuentra módulos

```bash
cd app
npm install artillery artillery-plugin-expect
```

### Timeout en Socket.IO

Aumentar timeout en artillery.yml:
```yaml
socketio:
  tinpx Artillery descarga lento

Primera ejecución descarga Artillery (~50MB). Siguientes ejecuciones usan caché.

```bash
# Pre-download para velocidad
npx artillery@latest --version
1. Verificar rate limiting en `middlewares/rateLimiter.js`
2. Aumentar límites temporalmente para test
3. Revisar logs en `app/logs/`

### P95 alto

1. Verificar BroadcastOptimizer activo
2. Revisar debouncing config
3. Monitorear CPU/memoria durante test

## Resultados Esperados

Después de Week 18.1 optimizations:

- ✅ P95: 120-180ms (mejor que 200ms)
- ✅ Error rate: 0.01-0.05% (mejor que 0.1%)
- ✅ 100 concurrent: Sin degradación
- ✅ Broadcasts reducidos: 40-60%
- ✅ Payloads comprimidos: 30-50%

## Siguientes Pasos

1. Ejecutar tests baseline
2. Analizar resultados
3. Documentar métricas en SEMANA_18_DIA_3_4_SUMMARY.md
4. Comparar con objetivos
5. Ajustar si es necesario

---

**Documentación**: Week 18.2 - Days 3-4  
**Status**: ✅ Configuración completa
