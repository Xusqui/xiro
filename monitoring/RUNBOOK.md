# Runbook de alertas

Un apartado por alerta: qué significa, qué mirar y cómo arreglarlo. Las rutas son
relativas a la raíz del repositorio. Comandos útiles:

```bash
./manage.sh status                     # contenedores, recursos, /ready, conexiones de BD
./manage.sh logs backend               # logs en vivo
grep '"level":"error"' logs/error-$(date +%F).log | tail
docker exec xiro_backend pm2 list      # workers PM2 y reinicios
```

**Mantenimiento programado:** el modo mantenimiento no dispara alertas (`/live`,
`/ready` y `/api/version` siguen respondiendo). Si vas a parar contenedores,
silencia antes en Alertmanager (`http://127.0.0.1:9093` → *New silence*, `app="xiro"`).

## XiroBackendDown
Prometheus no alcanza `backend:9464`. **Mirar:** `docker ps` (¿reiniciando?),
`./manage.sh logs backend` (error al arrancar), que `METRICS_PORT` llegue al
contenedor (`docker exec xiro_backend printenv METRICS_PORT`). **Arreglar:** si el
contenedor está caído, `./manage.sh start`. Si la app funciona pero no hay
métricas, el backend se arrancó sin el fichero de monitorización: revisa
`XIRO_MONITORING=true` en `.env`.

## XiroNotReady
`/ready` devuelve 503: la BD o Socket.IO no están sanos, o la app se está apagando.
**Mirar:** `curl -s 127.0.0.1:3000/ready` (el campo `issues` dice qué falla),
alertas `PostgresDown`/`RedisDown`.

## XiroPublicEndpointDown
La URL pública no responde por HTTPS, pero puede que la app sí. **Mirar:** si
`XiroNotReady` también está activa, empieza por esa. Si no: proxy (Caddy o Nginx
del Synology), DNS, router o certificado (`curl -vI https://tu-dominio/live`).

## XiroHighErrorRate
Más del 1 % de las peticiones devuelven 5xx. **Mirar:** panel *Aplicación* →
«Peticiones por segundo» (qué código) y «P99 por ruta»; `logs/error-*.log`
buscando el `traceId` de alguna respuesta fallida. Las causas habituales son la
BD (`XiroDbCircuitOpen`, `XiroDbPoolSaturated`) y un despliegue reciente
(`xiro_build_info` cambia de versión). **Arreglar:** si coincide con una
actualización, vuelve a la versión anterior (Config → Actualizaciones revierte sola
si `/ready` falla).

## XiroErrorBudgetBurn
Errores bajos pero continuos (más del 3 % en 6 h). Mismo diagnóstico que
`XiroHighErrorRate`, sin urgencia: suele ser una ruta concreta que falla siempre.
Agrupa por `route` y `status_code` en Prometheus:
`sum by (route, status_code) (rate(xiro_http_request_duration_seconds_count{status_code=~"5.."}[6h]))`.

## XiroHighLatencyP99
El 1 % más lento tarda más de 2 s (sin contar IA, subidas ni PDF). **Mirar:**
«P99 por ruta», `XiroDbSlowQueries`, `XiroEventLoopLag`, CPU del host. Una ruta
nueva que sea lenta a propósito se excluye en
`prometheus/rules/xiro-recording.yml`.

## XiroSlowCommands
Unirse o responder tarda más de 500 ms en el P99; los jugadores lo notan y, si
la puntuación depende del tiempo, les afecta. **Mirar:** Redis (latencia, memoria),
`XiroEventLoopLag`, consultas de BD. Si pasa con muchos jugadores a la vez, revisa
`AnswerBatchService` y el número de workers.

## XiroCommandErrors
Un comando lanza excepciones (no confundir con `rejected`, que es un «no» normal,
p. ej. respuesta fuera de tiempo). **Mirar:** `logs/error-*.log` filtrando por
`socketEvent`. Cada evento lleva su propio `traceId`.

## XiroEventLoopLag
Un worker tiene el event loop bloqueado más de 200 ms: todos sus sockets van con
retraso. **Mirar:** CPU de ese worker, GC («Pausas de GC»), generación de PDF o
de imágenes en ese momento. Si se repite sin carga, haz un perfil con
`node --cpu-prof` en desarrollo.

## XiroWorkersMissing
Hay menos workers que hace una hora: uno no arranca o no llega a Redis.
**Mirar:** `docker exec xiro_backend pm2 list`, `XiroWorkerRestarting`,
`RedisDown`.

## XiroWorkerRestarting
PM2 reinicia un worker una y otra vez, por un error al arrancar o porque supera
`max_memory_restart` (1 GB). **Mirar:** `logs/pm2-error.log`, panel «Memoria RSS
por worker». Cada reinicio corta los sockets de ese worker (los jugadores se
reconectan solos).

## XiroWorkerMemoryNearLimit
Un worker pasa de 900 MB; PM2 lo reiniciará al llegar a 1 GB. **Mirar:** si crece
sin parar (fuga) o sube con la carga. Para la fuga, `heap snapshot` en
desarrollo; para la carga, más workers o subir el límite en
`app/ecosystem.config.js`.

## XiroSocketConnectionsDropped
Más de la mitad de los sockets cayeron en 5 minutos. Puede ser el final normal
de una partida grande; si no lo es: proxy (timeouts de WebSocket), red del centro,
reinicio del backend (`XiroWorkerRestarting`).

## XiroDbCircuitOpen
Tras varios fallos seguidos de PostgreSQL, la app rechaza las consultas de ese
tipo sin intentarlas. **Mirar:** `PostgresDown`, `PostgresConnectionsHigh`,
logs de Postgres (`postgres_data/log/`). El circuito se cierra solo cuando la BD
vuelve a responder.

## XiroDbPoolSaturated
Hay peticiones esperando conexión. **Mirar:** «Pool de conexiones»,
`PostgresLongTransaction`. **Arreglar:** subir `DB_CONNECTION_BUDGET` (sin pasar
de `max_connections` = 100) o buscar la consulta que retiene conexiones.

## XiroDbSlowQueries
P99 de consultas > 1 s. Postgres registra las de más de 1 s
(`log_min_duration_statement`) en `postgres_data/log/postgresql-<fecha>.log`.
Ejecuta `EXPLAIN ANALYZE` sobre ellas; suele faltar un índice.

## PostgresDown
El exporter no conecta con la BD. **Mirar:** `docker ps` (`xiro_postgres`),
`docker logs xiro_postgres`, disco lleno (`HostDiskUsageHigh`). **Arreglar:**
`./manage.sh restart`; si la BD no arranca, restaura el último backup
(`./manage.sh restore`).

## PostgresConnectionsHigh
Más del 80 % de `max_connections`. **Mirar:** quién las usa:
`SELECT usename, application_name, state, count(*) FROM pg_stat_activity GROUP BY 1,2,3;`

## PostgresLongTransaction
Una transacción lleva más de 10 minutos abierta. **Mirar:**
`SELECT pid, now() - xact_start, state, query FROM pg_stat_activity ORDER BY 2 DESC NULLS LAST LIMIT 5;`
y termínala con `SELECT pg_terminate_backend(<pid>);` si no es un backup en curso.

## PostgresDeadlocks
Dos transacciones se bloquearon entre sí y Postgres abortó una. El log de
Postgres trae las dos consultas. Una vez suelta no es grave; si se repite, hay
que ordenar los `UPDATE` igual en ambos caminos.

## RedisDown
Sin Redis, los workers no se sincronizan, la reconexión de jugadores falla y no
hay métricas de los demás workers. **Mirar:** `docker logs xiro_redis`, memoria
del contenedor (`ContainerMemoryNearLimit`).

## RedisRejectedConnections
Redis llegó a `maxclients`. Suele ser una fuga de conexiones tras muchos
reinicios de workers; reinicia el backend y revisa `XiroWorkerRestarting`.

## HostDiskUsageHigh
Disco por encima del 80 %. **Mirar:** `du -sh postgres_data backups logs app/public/uploads`.
**Arreglar:** bajar la retención de backups, limpiar uploads huérfanos
(Configuración), `./manage.sh clean` para imágenes Docker antiguas.

## HostMemoryHigh
Memoria del NAS > 90 %. **Mirar:** `./manage.sh stats` y otros paquetes del
Synology. Los `mem_limit` de `docker-compose.yml` reparten el máximo por contenedor.

## ContainerMemoryNearLimit
Un contenedor está al 90 % de su `mem_limit` y Docker lo matará (OOM) al
llegar. **Arreglar:** sube su `mem_limit` o, si es el backend, revisa
`XiroWorkerMemoryNearLimit`.

## CertificateExpiringSoon
El certificado caduca en menos de 14 días: la renovación automática lleva
semanas fallando. **Caddy:** `docker logs xiro_caddy | grep -i acme` (puerto 80
cerrado, DNS). **Synology:** Panel de control → Seguridad → Certificado → Renovar.

## BackupFailed
El último `pg_dump` falló. **Mirar:** `logs/backup.log`. Prueba a mano con
`./manage.sh backup`.

## BackupStale
No hay backup correcto en 26 h, o el contenedor `backup` no escribe métricas
(imagen anterior a la monitorización: reconstrúyela). **Mirar:**
`docker ps` (`xiro_backup`), `BACKUP_SCHEDULE` en `.env`, `logs/backup.log`.

## BackupShrunk
El último backup ocupa menos de la mitad que el mayor de la semana: puede ser un
volcado cortado. Comprueba que se puede leer: `gunzip -t backups/<fichero>` y
`zcat backups/<fichero> | tail -3` (debe terminar en `PostgreSQL database dump complete`).

## MonitoringTargetDown
Un exporter no responde y sus alertas no saltarán. `./manage.sh monitoring` y
`docker logs xiro_<exporter>`. En Synology, cAdvisor necesita `DOCKER_DATA_ROOT`
y node-exporter puede fallar con montajes `rslave` (no se usan).

## AlertmanagerNotificationsFailing
Alertmanager no consigue enviar: SMTP mal configurado o `secrets/smtp_password`
ausente. `docker logs xiro_alertmanager` da el error del servidor de correo.
