# Monitorización de Xiro!

Prometheus recoge métricas de la app y de su infraestructura, Alertmanager avisa
por email (o Telegram) y Grafana trae dos paneles: **Xiro! · Aplicación** y
**Xiro! · Infraestructura**. Es opcional: sin activarla, Xiro! funciona igual que
antes y no publica nada nuevo.

| Servicio | Qué mide | Puerto (solo red interna salvo indicación) |
|---|---|---|
| backend `/metrics` | HTTP, Socket.IO, comandos, BD vista desde la app, Node.js por worker | 9464 |
| postgres-exporter | conexiones, transacciones, deadlocks, tamaño | 9187 |
| redis-exporter | memoria, clientes, comandos | 9121 |
| node-exporter | disco, memoria y CPU del host; métricas de backup | 9100 |
| cAdvisor | memoria y CPU de cada contenedor frente a su `mem_limit` | 8080 |
| blackbox-exporter | `/ready` interno, HTTPS público y caducidad del certificado | 9115 |
| Prometheus | 30 días o 4 GB de historial | 127.0.0.1:9090 |
| Alertmanager | envío de alertas | 127.0.0.1:9093 |
| Grafana | paneles | 127.0.0.1:3001 |

## Puesta en marcha

1. En `.env`: `XIRO_MONITORING=true` y `GRAFANA_ADMIN_PASSWORD=<una contraseña>`.
   En Synology añade `DOCKER_DATA_ROOT=/volume1/@docker` (ajusta el volumen).
2. Pon tu dominio en `prometheus/targets/https.yml`.
3. Configura el correo en `alertmanager/alertmanager.yml` (líneas `<-- CAMBIAR`)
   y guarda la contraseña SMTP en `secrets/smtp_password` (ver `secrets/README.md`).
4. Reconstruye la imagen (la app añade la dependencia `prom-client`) y arranca:
   ```bash
   ./manage.sh update        # o docker compose ... up -d --build --renew-anon-volumes
   ./manage.sh monitoring    # estado de los contenedores de monitorización
   ```
5. Abre Grafana en `http://127.0.0.1:3001` (usuario `admin`). Desde otro equipo,
   usa un túnel SSH o `GRAFANA_BIND=0.0.0.0`, y nunca lo publiques en Internet sin HTTPS.

Tras editar reglas, `prometheus.yml` o `alertmanager.yml`: `./manage.sh monitoring reload`.
`targets/https.yml` se relee solo.

Para comprobar la configuración sin arrancar nada:
```bash
docker run --rm -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" --entrypoint promtool \
  prom/prometheus:v2.55.1 check config /etc/prometheus/prometheus.yml
docker run --rm -v "$PWD/monitoring/alertmanager:/etc/alertmanager:ro" --entrypoint amtool \
  prom/alertmanager:v0.27.0 check-config /etc/alertmanager/alertmanager.yml
```

Para desactivarla: `XIRO_MONITORING=false` en `.env` y luego
`docker compose -f docker-compose.yml up -d --remove-orphans` (los volúmenes
`prometheus_data`, `grafana_data` y `alertmanager_data` se conservan).

## SLO

Los umbrales de las alertas salen de estos objetivos (ventana de 30 días):

| Objetivo | SLO | Alertas |
|---|---|---|
| Peticiones HTTP sin error 5xx (sin contar `/live` ni `/ready`) | 99,5 % | `XiroHighErrorRate` (> 1 % en 5 min), `XiroErrorBudgetBurn` (6× el presupuesto en 6 h) |
| Latencia HTTP (sin IA, subidas, PDF ni importación) | 99 % < 2 s | `XiroHighLatencyP99` |
| Comandos en tiempo real (unirse, responder…) | 99 % < 500 ms | `XiroSlowCommands`, `XiroCommandErrors` |
| Event loop de cada worker | P99 < 200 ms | `XiroEventLoopLag` |
| Backup correcto | cada 24 h | `BackupFailed`, `BackupStale`, `BackupShrunk` |

Las alertas de tasa exigen tráfico mínimo (0,1 req/s), para que un único error
de madrugada no dispare nada. Cada alerta enlaza su apartado de [RUNBOOK.md](RUNBOOK.md).

## Cómo llegan las métricas de los workers

PM2 arranca un worker por CPU y reparte el puerto 9464 entre ellos, así que cada
scrape lo atiende uno cualquiera. Cada worker publica su registro en Redis cada
10 s (`metrics:worker:<NODE_APP_INSTANCE>`, TTL 35 s) y el que atiende el scrape
devuelve el suyo en vivo junto a los de los demás. Todas las series llevan la
etiqueta `worker`; en las consultas se agrega con `sum` o `max`. Código:
`app/infrastructure/observability/`.

| Métrica | Tipo | Etiquetas |
|---|---|---|
| `xiro_http_request_duration_seconds` | histograma | `method`, `route` (patrón Express, `static` o `not_found`), `status_code` |
| `xiro_socket_events_total` | contador | `event` (solo eventos con handler; el resto, `unknown`) |
| `xiro_command_duration_seconds` | histograma | `command`, `outcome` (`ok`, `rejected`, `error`) |
| `xiro_db_query_duration_seconds` | histograma | `kind` (`read`/`write`), `outcome` |
| `xiro_socket_connections` | gauge | sumar entre workers |
| `xiro_games` | gauge | `state` (`active`/`lobby`); usar `max` (las partidas se replican entre workers) |
| `xiro_db_pool_connections` | gauge | `state` (`total`/`idle`/`waiting`) |
| `xiro_db_circuit_state` | gauge | `circuit`; 0 cerrado, 1 semiabierto, 2 abierto |
| `xiro_cluster_workers` | gauge | workers con métricas recientes |
| `xiro_build_info` | gauge | `version` |
| `process_*`, `nodejs_*` | por defecto de `prom-client` | event loop, heap, GC, CPU |
| `xiro_backup_*` | textfile de node-exporter | lo escribe `scripts/docker-backup-run.sh` en `backups/metrics/` |

`METRICS_PORT` no se publica en el host ni pasa por Caddy/Nginx. Si aun así
quieres un token, define `METRICS_TOKEN` en `.env`, copia el valor a
`secrets/metrics_token` y descomenta `authorization` en `prometheus/prometheus.yml`.

## PostgreSQL con un rol de solo lectura

El exporter usa por defecto el usuario de la app. Para separarlo:
```sql
CREATE ROLE xiro_monitor LOGIN PASSWORD '...';
GRANT pg_monitor TO xiro_monitor;
```
y cambia `DATA_SOURCE_USER` / `DATA_SOURCE_PASS` en `docker-compose.monitoring.yml`.
No hay réplicas, así que no se mide el retraso de replicación.

## Logs

- Cada línea lleva `traceId`: el de la cabecera W3C `traceparent` si llega, si no
  `X-Request-Id`, o uno nuevo. La respuesta lo devuelve en `X-Request-Id`, así que
  un error que ve un usuario se encuentra con `grep <id> logs/error-*.log`.
- Los eventos de socket abren su propio `traceId` y añaden `socketEvent`.
- `logs/*.log` es JSON (`timestamp`, `level`, `message`, `traceId`, `workerId`, `pid`).
  Con `LOG_FORMAT=json` la consola (`docker logs`) también lo es.
- Niveles: `error` para fallos, `warn` para degradación (circuit breaker,
  Redis), `info` para operaciones. Las claves sensibles (`password`, `token`,
  `sessionSecret`, `cookie`…) salen como `***REDACTED***`.

## Trazas distribuidas

No se incluye OpenTelemetry: Xiro! es un único servicio (más Postgres y Redis),
y las métricas por comando y consulta junto con el `traceId` en los logs cubren
lo que daría una traza. El `traceId` ya sigue el formato W3C, así que si algún
día se añade un collector, los ids coincidirán.

## Avisos si Alertmanager se cae

Si el propio NAS o Alertmanager se caen, nadie avisa. Para cubrirlo, un servicio
externo de «dead man's switch» (healthchecks.io, por ejemplo) que reciba un ping
periódico y avise si deja de llegar.
