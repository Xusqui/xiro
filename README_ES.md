<div align="center">

  <img src="https://xiro.pro/images/banner-readme.svg" alt="XIRO! — Juego de Preguntas y Respuestas en Tiempo Real" width="100%">

  <br>

  <img src="https://xiro.pro/images/chamaleon/chamaleon.svg" alt="Xiro mascota" width="130">

  <br>

  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-8-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Express.js-4-000000?style=flat-square&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/PM2-cluster-2B037A?style=flat-square&logo=pm2&logoColor=white" alt="PM2">
  <img src="https://img.shields.io/badge/Groq-AI%20Generator-F55036?style=flat-square&logo=openai&logoColor=white" alt="Groq AI">

  <br>

  > Plataforma self-hosted para sesiones de preguntas y respuestas en tiempo real · 6 tipos de preguntas · 4 modos de juego

  <br>

  <a href="https://xiro.pro">
    <img src="https://img.shields.io/badge/%F0%9F%8E%AE_%20PRU%C3%89BAME_EN_XIRO.PRO_%F0%9F%8E%AE-8AB817?style=for-the-badge&labelColor=8AB817&logoColor=white" alt="Pruébame en xiro.pro" height="55">
  </a>

  <sub>👆 <strong>Demo en vivo</strong> — ¡entra y juega ahora!</sub>

</div>

> 📖 [Read in English](README.md)

---

## Índice

1. [Características principales](#características-principales)
2. [Tipos de preguntas](#tipos-de-preguntas)
3. [Modos de juego](#modos-de-juego)
4. [Arquitectura del sistema](#arquitectura-del-sistema)
5. [Stack tecnológico](#stack-tecnológico)
6. [Instalación y despliegue](#instalación-y-despliegue)
7. [Variables de entorno](#variables-de-entorno)
8. [Vistas del juego](#vistas-del-juego)
9. [Panel de administración](#panel-de-administración)
10. [Modo por equipos](#modo-por-equipos)
11. [Generador IA](#generador-ia)
12. [Exportación y visualización de resultados](#exportación-y-visualización-de-resultados)
13. [Sistema de puntuación](#sistema-de-puntuación)
14. [Reconexión y sesiones](#reconexión-y-sesiones)
15. [Backup automático y restauración](#backup-automático-y-restauración)
16. [Estructura del proyecto](#estructura-del-proyecto)
17. [Tests y cobertura](#tests-y-cobertura)
18. [Tareas pendientes](#tareas-pendientes)

---

## Características principales

<img src="https://xiro.pro/images/chamaleon/party.svg" alt="mascota fiesta" width="110" align="right">

- **Tiempo real** vía Socket.IO con soporte multi-worker (adaptador Redis)
- **6 tipos de preguntas** con lógica de puntuación diferenciada
- **4 modos de juego**: Banco de preguntas, Mezcla, Personalizado y Trivial
- **Modo por equipos** con puntuación y revelación sincronizada
- **Sistema de rachas** configurable con bonificaciones progresivas
- **Reconexión transparente** con estado persistido en Redis (TTL 6h)
- **Reconexión del presentador** con restauración automática del estado de revelación de respuesta, incluso entre workers distintos del clúster PM2
- **Vista previa de fuegos artificiales** en tiempo real desde el panel de administración (pestaña Config → Fuegos artificiales)
- **Generador de preguntas con IA** via Groq / LLM
- **Exportación PDF** de juegos personalizados (Puppeteer + Chromium)
- **Exportación/importación JSON** de bancos de preguntas
- **Panel de administración** con dos roles (admin / editor)
- **Control remoto del presentador** desde móvil (solo admin), sincronizado en tiempo real con RedisSyncBus
- **QR code** generado dinámicamente para que los jugadores se unan
- **Fuegos artificiales** configurables al finalizar el juego
- **Historial de partidas** con exportación CSV/JSON individual por sesión (solo admin)
- **Visor gráfico de resultados** interactivo en el navegador (podio animado, estadísticas, detalle por pregunta)
- Despliegue **self-hosted** vía Docker Compose

---

## Tipos de preguntas

<img src="https://xiro.pro/images/chamaleon/thinking.svg" alt="mascota pensando" width="100" align="left">

<br>

### `quiz` — Opción múltiple estándar
<img src="https://xiro.pro/images/chamaleon/love.svg" alt="mascota amor" width="70" align="right">

Pregunta con 2-6 opciones, exactamente una correcta. Puntuación por tiempo: base 20 pts + hasta 20 pts de bonificación por velocidad de respuesta.

### `survey` — Encuesta
<img src="https://xiro.pro/images/chamaleon/searching.svg" alt="mascota buscando" width="70" align="right">

Formato idéntico al quiz pero sin respuesta correcta. No afecta a la puntuación. Usado para recoger opiniones durante la sesión.

### `multiple_choice` — Selección múltiple
<img src="https://xiro.pro/images/chamaleon/dizzy.svg" alt="mascota mareada" width="70" align="right">

Entre 1 y 6 respuestas pueden ser correctas. El jugador selecciona cualquier subconjunto. Puntuación:
- `+mc_points_per_correct` por cada correcta seleccionada
- `−mc_penalty_per_incorrect` por cada incorrecta seleccionada
- `+mc_perfect_bonus` si se seleccionaron exactamente todas las correctas y ninguna incorrecta
- La puntuación total puede ser negativa

### `order` — Ordenar secuencia
<img src="https://xiro.pro/images/chamaleon/planting.svg" alt="mascota plantando" width="70" align="right">

El jugador arrastra/reordena una lista de opciones para que coincida con el orden correcto. Puntuación parcial: 20 pts por cada elemento colocado en su posición correcta.

### `numeric_approximation` — Aproximación numérica
<img src="https://xiro.pro/images/chamaleon/pastelero.svg" alt="mascota pastelero" width="70" align="right">

El jugador introduce un número entero. La puntuación depende de la proximidad al valor correcto. Modos de tolerancia configurables:
- **exact** — solo cuenta la respuesta exacta
- **percentage** — tolerancia relativa al valor correcto (±X%)
- **absolute** — tolerancia en unidades absolutas (±N)
- **relative** — fórmula proporcional con tope opcional (`tolerance_cap`)

<br clear="left">

### `word_scramble` — Anagrama
<img src="https://xiro.pro/images/chamaleon/yoda.svg" alt="mascota yoda" width="70" align="right">

El jugador ve 10 letras desordenadas (que incluyen todas las letras de la palabra más letras señuelo) y las selecciona en el orden correcto para formar la palabra oculta. Las letras de la palabra están garantizadas en el conjunto. Puntuación: base 20 pts + bonificación por tiempo.

Soporta imagen y audio adjuntos: si la pregunta tiene `tipo_contenido` e `url_recurso`, se muestra el bloque multimedia entre el header y el enunciado (igual que en `quiz`).

### `matching` — Emparejar
<img src="https://xiro.pro/images/chamaleon/cooking.svg" alt="mascota cocinero" width="70" align="right">

El jugador ve dos columnas: la **columna izquierda** muestra los términos fijos en su orden original; la **columna derecha** muestra los valores emparejados desordenados aleatoriamente. El jugador arrastra y reordena la columna derecha hasta que cada elemento quede frente a su término correspondiente. Puntuación parcial: `BASE_POINTS` (20 pts) por cada par emparejado correctamente.

---

## Modos de juego

<img src="https://xiro.pro/images/chamaleon/gaming.svg" alt="mascota gaming" width="110" align="right">

### 1. Banco de preguntas
<img src="https://xiro.pro/images/chamaleon/painting.svg" alt="mascota pintura" width="80" align="right">

Un juego referencia uno o varios bancos. Al iniciarse, las preguntas se extraen de forma aleatoria de todos los bancos vinculados. Flujo clásico tipo Kahoot.

**Tabla:** `games` → `game_question_banks` → `question_banks`

### 2. Mezcla de preguntas
<img src="https://xiro.pro/images/chamaleon/disguise.svg" alt="mascota disfraz" width="80" align="left">

Combina bancos y diapositivas personalizadas. Al configurarlo, el administrador elige qué bancos incluir y cuántas preguntas aleatorias extraer de cada uno.

**Tabla:** `games` con tipo `mix`

<br clear="left">

### 3. Juego personalizado
<img src="https://xiro.pro/images/chamaleon/pintor.svg" alt="mascota pintor" width="80" align="right">

El administrador elige las preguntas una a una desde cualquier banco y las ordena manualmente. Soporta diapositivas intercaladas:
- **Diapositiva de texto** — título y cuerpo libre
- **Diapositiva de imagen** — imagen a pantalla completa
- **Diapositiva de actividad** — pausa para actividad libre; el presentador asigna puntos manualmente
- **Diapositiva informativa** — texto informativo sin puntuación

Permite **exportar a PDF** (todas las diapositivas y preguntas).

**Tabla:** `custom_games` → `custom_game_questions`

### 4. Trivial

<img src="https://xiro.pro/images/chamaleon/mago.svg" alt="mascota mago" width="90" align="left">

Mecánica de tablero:
- El tablero tiene un anillo exterior de N casillas (múltiplo del número de categorías) y un espacio central.
- Cada categoría tiene un color y está vinculada a un banco de preguntas.
- Por turnos, el jugador activo lanza un dado virtual. Las posiciones alcanzables se iluminan en el tablero SVG.
- Al moverse a una casilla, se presenta una pregunta del banco de esa categoría. **Todos los jugadores responden**.
- Si el jugador activo acierta, puede volver a lanzar (hasta `MAX_CONSECUTIVE` veces seguidas).
- Las **casillas objetivo de categoría** (HQ) otorgan una *cuña* si se responde correctamente.
- **Condición de victoria**: acumular todas las cuñas de todas las categorías.

**Tabla:** `trivial_games` → `trivial_categories`

<br clear="left">

---

## Arquitectura del sistema

<img src="https://xiro.pro/images/chamaleon/nerd.svg" alt="mascota nerd" width="100" align="right">

```
┌──────────────────────────────────────────────────────┐
│                   Clientes (Browser)                 │
│  admin.html  presentador.html  tv.html  jugador.html │
└───────┬──────────────┬────────────────┬──────────────┘
        │ REST (JWT)   │ Socket.IO      │ Socket.IO
        ▼              ▼                ▼
┌─────────────────────────────────────────────────────┐
│            Node.js / Express + Socket.IO            │
│  routes/        sockets/handlers/                   │
│  ↓                  ↓                               │
│  application/use-cases/  application/commands/      │
│  application/queries/    (CQRS)                     │
│  ↓                                                  │
│  domain/strategies/  domain/services/               │
│  domain/state/ (XState)  domain/events/ (EventBus)  │
│  ↓                                                  │
│  services/ (cache, DB)  config/                     │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
PostgreSQL 15          Redis 8
(datos persistentes)   (sesiones, pub/sub,
                        Socket.IO adapter)
```

### Patrones arquitectónicos

| Patrón | Implementación |
|--------|---------------|
| **Clean Architecture** | Capas: routes → use-cases → domain → services |
| **CQRS** | Commands para escritura, Queries para lectura |
| **Chain of Responsibility** | Cada use-case: Idempotencia → Rate Limit → Validación → Comando → Respuesta |
| **Strategy (doble capa)** | Modo de juego (Individual/Equipo) + Estrategia de puntuación |
| **Event-Driven** | `EventBus` interno: `GameStarted`, `AnswerSubmitted`, `GameEnded`, etc. |
| **State Machine** | XState **v5**: `idle → lobby → questionActive → scoring → gameEnd` |
| **Redis Pub/Sub** | `RedisSyncBus` sincroniza estado entre workers de PM2 |
| **Idempotencia** | Previene respuestas duplicadas con hash Redis (TTL 5 min) |

### Multi-worker
PM2 gestiona múltiples workers Node.js. El **adaptador Redis de Socket.IO** enruta eventos entre workers sin sesiones pegajosas. El `RedisSyncBus` propaga cambios de estado (jugadores, puntuaciones) vía canales pub/sub.

Sincronizaciones críticas entre workers (18 canales pub/sub en `RedisSyncBus`):

| Canal pub/sub | Qué se propaga | Receptor / Efecto |
|--------------|----------------|-------------------|
| `lobby-created` | Señal de creación de sala | Todos → inicializa `lobbyPlayers.set(roomId, [])` si no existe |
| `lobby-player-joined` | `{ roomId, nickname }` | Workers remotos → añade el nickname a `lobbyPlayers` |
| `lobby-player-left` | `{ roomId, nickname }` | Workers remotos → elimina el nickname de `lobbyPlayers` |
| `game-started` | Estado completo del juego (puntuaciones, preguntas, modos, rachas) | Todos → `activeGames.set(roomId, gameState)`, permite que cualquier worker gestione respuestas desde la primera pregunta |
| `game-state-updated` | Delta de puntuación `{ nickname, score, currentIndex }` | Workers remotos → actualiza `game.scores[nickname]` sin sobreescribir el resto |
| `next-question-sync` | `{ currentIndex, startTime }` — startTime canónico del worker origen | **Crítico**: todos los workers comparten el mismo epoch para el cálculo de bonus por tiempo; sin esto, los workers remotos obtienen `timeBonus = 0` en Q2+ |
| `team-config-sync` | Configuración de equipos | Todos → `teamConfigs.set(roomId, teamConfig)` |
| `session-abandoned` | `{ roomId }` | Workers remotos → elimina `activeGames`, `lobbyPlayers`, `teamConfigs`, players de la sala y llama a `clearGameTimer`, evita temporizadores residuales |
| `player-data-sync` | Objeto completo del jugador (join / reconexión) | Workers remotos → `players.set(playerId, playerData)` con merge por `lastSeen`; permite reconexión cross-worker |
| `player-disconnected-sync` | Jugador con status `disconnected` | Workers remotos → actualiza estado sin sobreescribir si ya está desconectado |
| `player-answered-sync` | `{ roomId, nickname, correct }` | No-op en receptor: el adaptador Redis de Socket.IO ya propaga el emit |
| `reveal-answer-sync` | `{ presenterPayload, playerPayload }` | Todos → emite `reveal-answer` a las rooms `:presenter` y `:players` del worker local |
| `question-revealed` | `{ questionIndex, presenterPayload, allowLateAnswers }` | Workers remotos → marca la pregunta como revelada en `revealedQuestions`, guarda `revealPayloads[index]` para reconexiones del presentador, y llama a `clearGameTimer` |
| `streak-reset-sync` | Lista de nicknames cuya racha se resetea (timeout) | Workers remotos → pone `playerStreaks[nickname] = 0` sin mostrar animación |
| `streak-restored-sync` | `{ nickname, streak, streakInfo }` tras reconexión | Workers remotos → restaura la racha del jugador reconectado |
| `timer-paused-sync` | `{ roomId }` | Workers remotos → `clearGameTimer(roomId)` para cancelar la cuenta atrás local |
| `timer-resumed-sync` | `{ roomId }` | Notificación; el timer lo crea solo el worker que gestiona el `resume-timer` |
| `config-updated` | `{ keys }` — claves modificadas en runtime | Todos → `runtimeConfig.reload()`; si incluye `LOG_LEVEL`, recarga el nivel de log de Winston |

---

## Stack tecnológico

<img src="https://xiro.pro/images/chamaleon/thumbsup.svg" alt="mascota thumbsup" width="100" align="left">
<img src="https://xiro.pro/images/chamaleon/cool.svg" alt="mascota cool" width="100" align="right">

| Capa | Tecnología |
|------|-----------|
| **Runtime** | Node.js 20 (Alpine) |
| **Framework HTTP** | Express.js 4 |
| **WebSockets** | Socket.IO 4 (WebSocket only en producción) |
| **Base de datos** | PostgreSQL 15 (pg_trgm para búsqueda de texto) |
| **Caché / Pub-Sub** | Redis 8.4 |
| **Proceso** | PM2 (cluster mode, 4 workers) |
| **State Machine** | XState **v5** (`idle → lobby → questionActive → scoring → gameEnd`) |
| **CSS** | Tailwind CSS v3.4 (5 bundles separados por vista: common, admin, player, presenter, index) |
| **PDF** | Puppeteer v24 + Chromium 147 (HTML→PDF) · PDFKit (generación programática) |
| **IA** | Groq API (`llama-3.3-70b-versatile` por defecto) |
| **QR Code** | Server-side: `qrcode` v1.5.4 (npm) · Client-side: `qr-code-styling` v1.9.2 (CDN) |
| **Contenerización** | Docker + Docker Compose |
| **Validación** | Joi 18 |
| **Métricas** | Prometheus-compatible (`/metrics`) |
| **Uploads** | Multer v2 (PDF, DOCX, TXT hasta 10 MB) |
| **Rate Limiting** | express-rate-limit + rate-limit-redis (Redis-backed) |

---

## Instalación y despliegue

<img src="https://xiro.pro/images/chamaleon/worker.svg" alt="mascota trabajando" width="100" align="left">

<br>

### Requisitos
- Docker y Docker Compose instalados
- Puertos `3000` (app), `5439` (Postgres), `6379` (Redis) disponibles (o red `host`)

<br clear="left">

### Pasos

```bash
# 1. Clonar el repositorio
git clone <repo-url> xiro
cd xiro

# 2. Crear archivo de entorno
cp app/.env.example app/.env   # o crear manualmente (ver sección Variables de entorno)

# 3. Configurar contraseñas (admin.config.js)
#    Editar app/admin.config.js con ADMIN_PASSWORD y EDITOR_PASSWORD

# 4. Levantar los servicios
docker compose up -d

# 5. La app estará disponible en http://<ip-del-servidor>:3000
```

Las migraciones SQL se ejecutan automáticamente al arrancar el servidor.

### Gestión con manage.sh

```bash
./manage.sh start                              # Inicia todos los servicios
./manage.sh stop                               # Para todos los servicios
./manage.sh restart                            # Reinicia todos los servicios
./manage.sh status                             # Estado completo + monitor
./manage.sh logs                               # Ver logs de todos los servicios
./manage.sh logs backend                       # Ver logs de un servicio concreto
./manage.sh backup                             # Crea un backup de PostgreSQL
./manage.sh restore backups/archivo.sql.gz     # Restaura un backup (requiere nombre de fichero)
./manage.sh update                             # Pull de imágenes y reconstruye contenedores
./manage.sh clean                              # Limpia recursos Docker no utilizados (prune)
./manage.sh db                                 # Abre psql interactivo en xiro_postgres
./manage.sh stats                              # Muestra uso de CPU/RAM de contenedores
./manage.sh health                             # Health check del backend (/health)
```

### Compilar CSS (desarrollo)

<img src="https://xiro.pro/images/chamaleon/jardinero.svg" alt="mascota jardinero" width="80" align="right">

Los scripts CSS están en el `package.json` de la **raíz** del repositorio, no en `app/`:

```bash
# Desde la raíz del repositorio
npm run build:css          # Compila todos los bundles Tailwind (minificados)
npm run watch:css          # Watch mode para todos los bundles en paralelo
npm run build:css:admin    # Compila un bundle individual (admin|player|presenter|common|index)
```

> No edites los ficheros compilados (`common.css`, `output-*.css`) directamente — se sobreescriben en cada build.

---

## Backup automático y restauración

<img src="https://xiro.pro/images/chamaleon/afraid.svg" alt="mascota asustada" width="90" align="left">
<img src="https://xiro.pro/images/chamaleon/pirata.svg" alt="mascota pirata" width="100" align="right">

### Funcionamiento

El servicio `xiro_backup` (contenedor Docker independiente basado en `postgres:15-alpine`) ejecuta `pg_dump` de forma automática según la programación configurada. Los backups se guardan como `.sql.gz` en la carpeta `backups/`.

La configuración es editable desde el **Panel de administración → Configuración → Backup** sin reiniciar nada. El contenedor detecta los cambios en `runtime-overrides.json` cada 30 segundos y recarga el crontab automáticamente.

| Parámetro | Descripción | Por defecto |
|-----------|-------------|-------------|
| `BACKUP_SCHEDULE` | Programación cron (`disabled` para desactivar) | `0 2 * * *` (diario 2:00 AM) |
| `BACKUP_RETENTION_DAYS` | Días que se conservan los backups | `7` |

Opciones de programación disponibles:
- **Diario** — `0 2 * * *` (cada día a las 2:00 AM)
- **Semanal** — `0 2 * * 0` (domingos a las 2:00 AM)
- **Mensual** — `0 2 1 * *` (día 1 de cada mes a las 2:00 AM)
- **Desactivado** — `disabled`

### Levantar el servicio de backup

```bash
# Primera vez (dar permisos y levantar)
chmod +x scripts/docker-backup-entrypoint.sh scripts/docker-backup-run.sh
docker compose up -d backup

# Ver logs
docker logs xiro_backup

# Forzar un backup manual inmediato
docker exec xiro_backup sh /scripts/docker-backup-run.sh

# Listar backups disponibles
ls -lh backups/
```

### Restaurar una copia de seguridad

```bash
# 1. Identificar el backup a restaurar
ls -lh backups/
# → xiro_backup_20260319_020000.sql.gz

# 2. Restaurar (sustituye el nombre del archivo)
docker exec -i xiro_postgres psql \
  -U "${DB_USER:-postgres}" \
  -p 5439 \
  -d "${DB_NAME:-xiro_db}" \
  < <(gunzip -c backups/xiro_backup_20260319_020000.sql.gz)
```

> **Nota:** si la restauración debe partir de una base de datos limpia (p.ej. recuperación total tras pérdida de datos), descarta primero las tablas existentes añadiendo la flag `--clean` al psql o recrea el esquema manualmente.

Alternativamente usando `manage.sh`:

```bash
./manage.sh restore
```

---

## Variables de entorno

<img src="https://xiro.pro/images/chamaleon/cooking.svg" alt="mascota cocinando" width="100" align="right">

Configuradas en `docker-compose.yml` o en `app/.env`:

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del servidor | `3000` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Puerto PostgreSQL | `5439` |
| `DB_NAME` | Nombre de la BD | `xiro` |
| `DB_USER` | Usuario PostgreSQL | — |
| `DB_PASSWORD` | Contraseña PostgreSQL | — |
| `REDIS_URL` | URL Redis TCP | `redis://localhost:6379` |
| `REDIS_SOCKET_PATH` | Path socket Unix Redis | `/var/run/redis/redis.sock` |
| `JWT_SECRET` | Secreto para tokens JWT | — |
| `CORS_ORIGIN` | Origen permitido CORS | `*` |
| `GROQ_MODEL` | Modelo Groq para IA | `llama-3.3-70b-versatile` |
| `BASE_POINTS` | Puntos base por respuesta | `20` |
| `MAX_TIME_BONUS` | Bonificación máxima por tiempo | `20` |
| `TEAM_SCORE_LAMBDA` | Peso puntuación individual en equipos | `0.5` |

---

## Vistas del juego

### `index.html` — Selector de rol
<img src="https://xiro.pro/images/chamaleon/hello.svg" alt="mascota saludando" width="90" align="right">

Pantalla de entrada con fondo WebGL animado. El usuario elige su rol: **Jugador**, **Presentador** o **TV**. También hay acceso directo a los modos Trivial y Personalizado.

### `jugador.html` — Vista del jugador

<img src="https://xiro.pro/images/chamaleon/gamer.svg" alt="mascota gamer" width="100" align="right">

1. **Paso 1**: Introduce el PIN de sesión (formato `PIN-XXXX`) — si se accede con `jugador.html?pin=PIN`, el PIN se rellena automáticamente y se salta directamente al paso del nombre
2. **Paso 2**: Introduce su nickname (mayúsculas, máx. 15 caracteres)
3. **Sala de espera**: muestra la lista de jugadores conectados
4. Durante la partida, la interfaz se adapta automáticamente al tipo de pregunta activa
5. Persistencia de sesión en `localStorage` para reconexión automática
6. Wake Lock API para evitar que la pantalla del móvil se apague
7. En modo **Trivial**, se muestra una barra inferior fija con las cuñas por categoría (gris si no conseguida, color sólido si conseguida); se sincroniza en vivo por eventos `trivial-token-update` / `trivial-turn-changed` y se restaura tras `reconnect-player`

**Interfaz por tipo de pregunta:**

| Tipo | Interfaz |
|------|---------|
| `quiz` / `survey` | Cuadrícula 2×3 de botones con colores (rojo/azul/amarillo/verde/morado/rosa) |
| `multiple_choice` | Misma cuadrícula pero multi-selección con checkmark verde; botón "Enviar" separado |
| `order` | Lista draggable (táctil y ratón); badge de posición actualizable; botón "Enviar" |
| `numeric_approximation` | Campo de texto numérico grande con hint opcional; envío con Enter o botón |
| `word_scramble` | Cajas vacías (longitud de la palabra) + 10 botones de letras desordenadas |
| `matching` | Dos columnas; los elementos de la columna derecha son arrastrables; botón "Enviar" |

### `presentador.html` — Vista presentador completa
<img src="https://xiro.pro/images/chamaleon/musico.svg" alt="mascota músico" width="90" align="left">

Vista rica con control total de la partida:
- **Lobby**: selectora de PIN, configuración de equipos, barra lateral con jugadores en tiempo real, QR con logo XIRO embebido
- **Partida**: temporizador circular, contador de respuestas, revelado de respuesta con tarjeta de justificación y mini-ranking
- **Final**: podio animado con fuegos artificiales configurables
- **Trivial**: tablero SVG interactivo con tokens de jugadores animados
- **Botón Terminar**: disponible en todos los modos durante la partida; muestra modal de confirmación y finaliza el juego mostrando el podio con la clasificación actual. Al confirmar, detiene inmediatamente el temporizador en el cliente y publica `session-abandoned` vía Redis para cancelar cualquier temporizador activo en todos los workers
- **Mascota de fin de juego**: al mostrar el podio, la mascota `gameover.svg` aparece animada en la esquina inferior izquierda
- **Botón Abandonar juego**: cancela la sesión y redirige al inicio

<br clear="left">

### `tv.html` — Vista TV / proyector
<img src="https://xiro.pro/images/chamaleon/surfero.svg" alt="mascota surfero" width="90" align="right">

Diseñada para pantalla grande. Carga más ligera que la vista presentador. Namespace global `TVApp`. Mismas funcionalidades de tablero Trivial en formato SVG.
- **Botón Finalizar partida**: modal de confirmación → emit `end-game` → podio
- **Botón Abortar partida**: modal de confirmación → emit `abandon-game` → redirect a `/tv.html`
- Ambos botones visibles solo cuando hay sesión activa; implementados en JS vanilla puro (compatible Chrome 38 / WebOS 3.5)

---

## Panel de administración

<img src="https://xiro.pro/images/chamaleon/albanil.svg" alt="mascota constructor" width="100" align="right">

Acceso en `/admin.html`. **Login** con contraseña → JWT (12h). Dos roles:
- **admin**: acceso completo (CRUD + eliminación + reinicio)
- **editor**: CRUD sin operaciones destructivas

### Secciones

#### Bancos de Preguntas
- Crear, editar y eliminar bancos
- Editor de preguntas con soporte para los 6 tipos
- Por pregunta: límite de tiempo, multimedia (texto/imagen/audio), justificación, pista (numérico), estrategia de puntuación
- **Exportar banco** → descarga JSON con nombre y array de preguntas
- **Importar banco** → drag-and-drop de un archivo JSON
- **Mezclar bancos** → genera un banco nuevo combinando seleccionados

#### Mezcla de Preguntas
- Crear juegos que combinen varios bancos con un PIN propio
- Configurar rachas, bonificaciones dobles, temporizadores, puntuación por equipos

#### Juegos Personalizados
- Ordenar preguntas individuales de cualquier banco
- Insertar diapositivas (texto, imagen, actividad libre, informativa)
- **Exportar a PDF** (genera el PDF en el servidor con Puppeteer)
- **Exportar banco JSON** del subconjunto de preguntas

#### Trivial Pursuit
- Crear juego Trivial con nombre, PIN y número de casillas exteriores
- Definir 2-6 categorías con nombre, color y banco vinculado
- Configurar rachas y bonificaciones dobles

#### Generador IA
Asistente en 3 pasos:
1. **Fuente** — dos modos:
   - **Subir documento** (PDF, DOCX, TXT hasta 10MB): el texto se extrae en el servidor
   - **Escribir tema**: campo de texto libre, ej. *"Haz preguntas sobre la Primera República Española"*
2. Configurar tipos y cantidad de preguntas por tipo, dificultad
3. Revisar, editar y guardar el banco generado

#### Sección Config
- Parámetros de partida, puntuación, logging, conexiones, equipos
- Fuegos artificiales (físicas, sonido, modo final) — incluye botón **Vista previa** que abre `/fireworks-preview.html` con la configuración actual sin necesidad de iniciar una partida
- Personalización de UI (colores, temas)
- Herramientas: limpiar uploads huérfanos, vaciar caché Redis, borrar logs
- **Historial de partidas** (solo admin): lista las últimas 100 partidas con PIN, fecha, tipo, jugadores y duración; botón **Ver** que abre el visor gráfico directamente (`?id=`); descarga CSV o JSON por sesión; borrado individual o masivo con modal de confirmación
- **Juegos en Curso** (solo admin): listado en tiempo real de sesiones activas y botón **Controlar** para abrir `presentador.html?pin=PIN&remote=true` desde móvil
- **Visor gráfico** de resultados: abre `/xiro-results-viewer.html` para visualizar cualquier CSV exportado con podio animado, estadísticas y detalle por pregunta
- **Botón PANIC**: reinicia el contenedor Docker completo

### Control remoto del presentador (admin)

Permite controlar una partida proyectada en PC desde otro dispositivo (p.ej. móvil) usando los mismos eventos del presentador principal:

- `next-question`
- `reveal-answer`
- `end-game`
- `pause-timer` / `resume-timer`

Flujo:
1. Entrar en **Config → Juegos en Curso**.
2. Pulsar **Controlar** en la sesión deseada.
3. Se abre `presentador.html?pin=PIN&remote=true` con interfaz táctil simplificada.
4. El cliente remoto realiza handshake por socket (`join-remote-presenter`) y recibe snapshot inicial.

Funcionalidades de la interfaz remota:
- Botones de acción: **Siguiente pregunta**, **Revelar respuesta**, **Finalizar juego** y **Terminar partida** (con modal de confirmación)
- **Temporizador circular** sincronizado con el presentador: muestra la cuenta atrás en tiempo real, cambia a amarillo cuando está pausado y pulsa en rojo en los últimos 5 segundos. Tocarlo pausa o reanuda el temporizador (emite `pause-timer` / `resume-timer`). Se oculta automáticamente al revelar la respuesta.

Seguridad:
- El control remoto exige **JWT de admin válido** tanto por REST como por socket.
- Aunque se conozca la URL del presentador remoto, sin token admin el servidor rechaza la unión (`remote-join-failed`).

Implementación técnica:
- Query CQRS: `app/application/queries/GetActiveSessionsQuery.js` (escaneo Redis `session:*`).
- Endpoint: `GET /api/admin/active-sessions` en `app/routes/admin.remote.routes.js`.
- Socket helper: `app/sockets/utils/RemoteControlHelper.js`.
- Frontend admin: `app/public/js/admin/modules/remote-tab.js`.
- Frontend presentador móvil: `app/public/js/presenter/presenter-remote.js`, `presenter-remote-ui.js` y `app/public/css/presenter-remote.css`.

### Rate limit de login admin (reset)

El endpoint `/api/admin-login` está protegido con rate limit (5 intentos / 15 min por IP). Cuando Redis está disponible, el contador se guarda con claves `rl:*`.

Comandos útiles en servidor:

```bash
# Ver claves bloqueadas
redis-cli --scan --pattern 'rl:*'

# Ver TTL de una IP
redis-cli TTL rl:<ip>

# Reset de una IP concreta
redis-cli DEL rl:<ip>

# Reset global de bloqueos de login
redis-cli --scan --pattern 'rl:*' | xargs -r redis-cli DEL
```

---

## Modo por equipos

<img src="https://xiro.pro/images/chamaleon/bailarina.svg" alt="mascota bailarina" width="100" align="left">

Disponible en todos los modos de juego (Banco, Mezcla, Personalizado, Trivial).

- En la sala de espera, el presentador activa el modo equipos y configura nombres y colores
- Los jugadores eligen su equipo desde `jugador.html`
- **Revelación sincronizada**: ningún miembro del equipo ve el resultado hasta que todo el equipo haya respondido
- Si el equipo completo responde antes del tiempo, el temporizador se detiene
- **Puntuación de equipo**: suma ponderada de puntuaciones individuales (λ configurable)
- **Rachas de equipo**: el equipo como unidad puede activar bonificaciones de racha

<br clear="left">

---

## Generador IA

<img src="https://xiro.pro/images/chamaleon/inteligencia-artificial.svg" alt="mascota IA" width="120" align="right">

El módulo `app/ai-generator/` genera bancos de preguntas a partir de documentos o prompts libres:

```
Documento / Prompt libre → Extracción / Texto directo → Construcción de prompt → API Groq → Validación → Banco
```

- Soporta los 6 tipos de preguntas en la generación
- La clave API Groq se almacena en `app/ai-generator/groq-key.json` (editable desde el panel Config)
- Temperatura: 0.7 para mayor variedad de salidas
- Timeout: 60s por petición
- Modelos disponibles: cualquier modelo compatible con la API de Groq (configurable desde el panel)

---

## Exportación y visualización de resultados

<img src="https://xiro.pro/images/chamaleon/gameover.svg" alt="mascota gameover" width="100" align="left">
<img src="https://xiro.pro/images/chamaleon/busca-tesoros.svg" alt="mascota resultados" width="100" align="right">

Cada partida que finaliza (completada o abandonada) se persiste automáticamente en la tabla `game_sessions` de PostgreSQL. No bloquea el flujo del juego: el guardado es asíncrono y los errores se registran sin interrumpir la sesión.

### Tabla `game_sessions`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `SERIAL` | Identificador único |
| `pin` | `TEXT` | PIN del juego |
| `game_type` | `TEXT` | `bank`, `mix`, `custom`, `trivial` |
| `played_at` | `TIMESTAMPTZ` | Fecha y hora de finalización |
| `duration_ms` | `INTEGER` | Duración total en milisegundos |
| `player_count` | `INTEGER` | Número de jugadores |
| `question_count` | `INTEGER` | Número de preguntas |
| `reason` | `TEXT` | `completed` o `abandoned` |
| `final_ranking` | `JSONB` | Ranking final con puntos por jugador |
| `questions_snapshot` | `JSONB` | Preguntas con opciones y respuesta correcta |
| `player_answers` | `JSONB` | Respuestas individuales por pregunta (tiempo, puntos, acierto) |

Las respuestas individuales se rastrean en un hash Redis `game:playeranswers:<roomId>` durante la partida y se consolidan al finalizar, incluso en despliegues multi-worker.

### Endpoints REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/results/history?limit=100` | Lista las últimas N sesiones (sin columnas JSONB pesadas) |
| `GET` | `/api/results/session/:id/export.csv` | Descarga CSV de la sesión (BOM UTF-8, separador `;`) |
| `GET` | `/api/results/session/:id/export.json` | Devuelve JSON completo de la sesión *(sin autenticación — necesario para el visor con enlace directo)* |
| `DELETE` | `/api/results/history` | Borra todas las sesiones *(requiere rol admin)* |
| `DELETE` | `/api/results/session/:id` | Borra una sesión individual *(requiere rol admin)* |

### Formato CSV

El CSV exportado contiene secciones separadas por cabeceras:

```
RANKING FINAL           → posición, jugador, puntos totales
PREGUNTAS               → índice, enunciado, tipo, respuesta correcta
DETALLE POR PREGUNTA    → por cada pregunta: jugador, respuesta, tiempo (ms), puntos, acierto
CATEGORÍAS OBTENIDAS    → (solo Trivial) jugador y cuñas conseguidas
```

### Visor gráfico (`/xiro-results-viewer.html`)

Página HTML standalone (sin dependencias externas) accesible de dos formas:

- **Con CSV**: arrastra el archivo descargado a la zona drop — los datos no salen del navegador
- **Con enlace directo**: `/xiro-results-viewer.html?id=<id>` carga la partida automáticamente desde la BD sin necesidad de descargar nada. Este enlace se puede compartir con cualquier persona sin requerir autenticación

Funcionalidades:
- **Cabecera**: PIN, fecha, tipo de juego, jugadores, preguntas, estado (completada / abandonada)
- **Tarjetas de estadísticas**: jugadores, preguntas, % de acierto global, tiempo medio de respuesta, cuñas máximas (Trivial)
- **Podio animado**: bloques de altura proporcional, corona 👑 al primero, barras de puntuación para todos los jugadores
- **Cuñas** (Trivial): cuadrícula por jugador con las categorías conseguidas
- **Acordeón por pregunta**: porcentaje de acierto con barra visual, tabla de respuestas individuales con tiempo y puntos
- **Confeti** al cargar partidas completadas
- **Botón imprimir**: todas las preguntas se despliegan automáticamente en la impresión

---

## Sistema de puntuación

<img src="https://xiro.pro/images/chamaleon/quimico.svg" alt="mascota químico" width="110" align="left">

<br>

### Puntuación base

| Tipo | Fórmula |
|------|---------|
| `quiz`, `word_scramble` | `BASE_POINTS + (timeLeft / timeLimit) × MAX_TIME_BONUS` |
| `multiple_choice` | Suma de aciertos × pts_correcta − errores × pts_penalización + bonus_perfecto |
| `order` | `BASE_POINTS × posiciones_correctas` |
| `matching` | `BASE_POINTS × pares_emparejados_correctamente` |
| `numeric_approximation` | Proporcional a la proximidad al valor correcto (según modo de tolerancia) |
| `survey` | 0 (encuesta, sin puntuación) |

### Estrategias de puntuación (pluggables)

| Estrategia | Descripción |
|-----------|-------------|
| `time_based` | Base + bonificación por tiempo (por defecto) |
| `streak_bonus` | `time_based × (1 + multiplicador_racha)` |
| `betting` | El jugador apuesta sus puntos existentes. **PENDIENTE**|
| `numeric_approximation` | Puntuación por proximidad |

### Rachas
Configurables por juego con `use_streaks`, `streak_threshold`, `streak_bonus_percentage`:
- **Racha individual**: N respuestas correctas consecutivas → +X% de bonificación
- **Racha doble**: M respuestas consecutivas → +Y% adicional (acumulable)

<br clear="left">

---

## Reconexión y sesiones

<img src="https://xiro.pro/images/chamaleon/running.svg" alt="mascota corriendo" width="100" align="right">

- El estado completo de la partida se persiste en Redis con clave `session:{roomId}` (TTL 6h)
- Los jugadores almacenan `playerId` (UUID), `sessionId` y `nickname` en `localStorage`
- Al recargar la página o reconectarse, el cliente emite `reconnect-player` automáticamente
- El servidor valida la sesión en Redis, restaura el jugador en la partida y envía un snapshot del estado actual
- Los presentadores también pueden reconectarse mediante `reconnect-presenter`
- El control remoto admin puede coexistir con el presentador principal: múltiples sockets de presentador por sala (`join-remote-presenter`) sin expulsar al socket original
- **Restauración del estado revelado**: si la pregunta actual ya fue revelada cuando el presentador reconecta, el servidor re-emite automáticamente el evento `reveal-answer` con el payload completo hacia ese socket. Esto funciona aunque la reconexión aterrice en un worker diferente al que procesó la revelación, gracias a que el payload se sincroniza vía el canal `question-revealed` de `RedisSyncBus` en el momento de la revelación
- **Resiliencia de transporte del presentador**: el socket del presentador usa `transports: ['websocket', 'polling']` con upgrade automático. Si el handshake WebSocket falla puntualmente (reinicio de backend, proxy, red), cae a long-polling y recupera la conexión sin mostrar error al usuario
- **Reconexión cross-worker**: cuando un jugador cambia de red (p.ej. WiFi → datos móviles), el cliente obtiene un nuevo socket. Si ese socket aterriza en un worker distinto al que procesó el `join-lobby`, el canal `player-data-sync` de `RedisSyncBus` garantiza que el objeto completo del jugador esté disponible en todos los workers. El guard `isDifferentSocket` en `ReconnectPlayerHandler` acepta cualquier estado activo (no solo `connected`), ya que el socket anterior puede tardar hasta ~80 s en expirar por TCP keepalive

---

## Estructura del proyecto

<img src="https://xiro.pro/images/chamaleon/branch.svg" alt="mascota branch" width="100" align="right">

```
xiro/
├── app/                        # Aplicación Node.js
│   ├── index.js                # Entrada principal (inicialización)
│   ├── server.js               # Servidor estado-sync (segundo proceso)
│   ├── ai-generator/           # Módulo generador IA (Groq)
│   ├── application/            # Capa de aplicación (CQRS)
│   │   ├── chain/              # Cadenas de responsabilidad
│   │   ├── commands/           # Comandos de escritura
│   │   ├── helpers/            # Helpers de aplicación (extracción de respuestas, lookup, rate limiter)
│   │   ├── queries/            # Consultas de lectura
│   │   ├── services/           # Servicios de aplicación
│   │   ├── use-cases/          # Casos de uso
│   │   └── validators/         # Validaciones de entrada
│   ├── config/                 # Configuración y constantes
│   ├── domain/                 # Lógica de dominio
│   │   ├── events/             # EventBus y manejadores
│   │   ├── services/           # Servicios de dominio puros
│   │   ├── state/              # Máquina de estados (XState)
│   │   └── strategies/         # Strategies (juego y puntuación)
│   ├── infrastructure/         # Infraestructura
│   │   ├── health/             # Health checks
│   │   ├── resilience/         # Circuit breakers
│   │   └── shutdown/           # Apagado graceful
│   ├── middlewares/            # Autenticación, rate limiting, métricas, seguridad
│   ├── migrations/             # Migraciones SQL (auto-ejecutadas)
│   ├── public/                 # Frontend estático
│   │   ├── *.html              # Vistas del juego
│   │   ├── ppt-addin/          # Add-in para PowerPoint (Office.js)
│   │   ├── css/                # CSS compilado (Tailwind) + artesanal
│   │   │   ├── common.css      # Base Tailwind compartida (todas las vistas)
│   │   │   ├── output-*.css    # Bundles Tailwind por vista (components only)
│   │   │   ├── jugador-base.css    # ─┐
│   │   │   ├── jugador-quiz.css    #  ├─ jugador.css dividido en 3 módulos
│   │   │   ├── jugador-effects.css # ─┘
│   │   │   ├── tv.css          # CSS standalone para TV/WebOS
│   │   │   └── drag-drop.css, neon.css, dice3d.css, …
│   │   └── js/
│   │       ├── admin/          # Módulos del panel de administración
│   │       ├── core/           # Abstracciones compartidas (EventEmitter, GameState, etc.)
│   │       ├── fireworks/      # Motor de fuegos artificiales (canvas)
│   │       ├── player/         # Módulos del jugador (ES modules)
│   │       ├── presenter/      # Módulos del presentador (ES modules)
│   │       ├── shared/         # Componentes compartidos
│   │       │   ├── modal.js    # Modal genérico (ES module)
│   │       │   └── trivial/    # Lógica del tablero Trivial (sin módulos, Chrome 40+)
│   │       │       ├── trivial-board-geometry.js   # Constantes + posToXY, isHQ, labelXY, playerColor
│   │       │       ├── trivial-board-builder.js    # renderBoardBackground + SVG scaffold
│   │       │       ├── trivial-token-renderer.js   # updateBoardTokens, updateBoardTokensTeam
│   │       │       └── trivial-highlights-renderer.js # updateBoardHighlights, showTurnOrderOverlay
│   │       └── tv/             # Módulos de TV (IIFE namespace TVApp)
│   ├── routes/                 # Enrutadores Express
│   ├── services/               # Servicios de infraestructura (caché, DB, Redis)
│   └── sockets/                # Capa Socket.IO
│       ├── handlers/           # Manejadores de eventos por tipo
│       │   └── trivial/        # Manejadores específicos del Trivial
│       ├── services/           # Servicios de socket (Trivial, Reconexión, etc.)
│       ├── sync/               # RedisSyncBus (sincronización entre workers)
│       ├── utils/              # Utilidades (timers, rankings, equipos, etc.)
│       └── validators/         # Validadores a nivel socket
├── docs/                       # Documentación técnica adicional
├── scripts/                    # Scripts de utilidad
├── docker-compose.yml          # Orquestación de servicios
├── Dockerfile                  # Imagen Docker (Node 20 Alpine + Chromium)
├── manage.sh                   # Script de gestión del sistema
└── tailwind.config.js          # Configuración Tailwind raíz
```

---

## Tests y cobertura

<img src="https://xiro.pro/images/chamaleon/detective.svg" alt="mascota detective" width="100" align="right">

```
cd app && npm test                        # todos los tests
cd app && npm test -- --coverage          # con informe de cobertura
cd app && npm test -- --coverage --silent # silencioso (sin logs del servidor)
```

### Estado actual *(10/04/2026 — Final de sesión)*

| Métrica | Global | Objetivo | Estado |
|---------|--------|----------|--------|
| **Suites** | 161 | — | ✅ |
| **Tests** | 3074 | — | ✅ (+5) |
| **Statements** | 83.4 % | ≥ 85 % | 🟡 (-1.6%) |
| **Branches** | 72.03 % | ≥ 72 % | ✅ (+0.06%) |
| **Functions** | 83.72 % | ≥ 85 % | 🟡 (-1.28%) |
| **Lines** | 84.57 % | ≥ 85 % | 🟡 (-0.43%) |

### Cobertura por capa *(datos de la última ejecución completa)*

| Carpeta | Stmts | Branch | Funcs | Estado |
|---------|-------|--------|-------|--------|
| `config/` | 98.76 % | 95.98 % | 96.77 % | ✅ |
| `middlewares/` | 97.10 % | 97.05 % | 96.55 % | ✅ |
| `routes/` | 96.31 % | 93.47 % | 95.23 % | ✅ |
| `services/` | 96.27 % | 87.80 % | 96.31 % | ✅ |
| `services/db/` | 99.53 % | 96.46 % | 100 % | ✅ |
| `application/chain/` | 98.14 % | 88.23 % | 100 % | ✅ |
| `application/queries/` | 86.87 % | 75.72 % | 91.66 % | ✅ |
| `domain/strategies/scoring/` | 90.69 % | 86.55 % | 91.22 % | ✅ |
| `infrastructure/resilience/` | 98.14 % | 95.00 % | 96.55 % | ✅ |
| `domain/state/` | 81.81 % | 68.22 % | 96.29 % | 🟡 |
| `domain/services/` | ~78 % | ~65 % | ~80 % | 🟡 |
| `domain/events/` | 89.62 % | 79.71 % | 74.35 % | 🟡 |
| `application/use-cases/` | 82.91 % | 56.96 % | 87.50 % | 🟡 |
| `application/commands/` | 73.13 % | 51.47 % | 63.33 % | 🟡 |
| `sockets/handlers/` | 86.74 % | 75.00 % | 81.25 % | 🟡 |
| `sockets/services/` | 77.46 % | 62.52 % | 86.91 % | 🟡 |
| `sockets/utils/` | 94.25 % | 85.37 % | 95.00 % | ✅ |
| `infrastructure/shutdown/` | 86.31 % | 79.16 % | 76.47 % | 🟡 |
| `sockets/handlers/trivial/` | 22.58 % | 17.64 % | 21.15 % | 🔴 |
| `sockets/sync/` | 27.02 % | 3.50 % | 26.82 % | 🔴 |

### Tests añadidos en esta sesión *(10/04/2026 — Completada)*

| Archivo | Tests | Mejora | Impacto |
|---------|-------|--------|--------|
| `routes/__tests__/admin.routes.test.js` | +2 (fix) | clear-logs: corregidos 2 fallos | 43/43 ✅ |
| `sockets/services/ReconnectionService.test.js` | +23 | checkNicknameDuplicate, disconnectOldSocket, updatePlayerState, setupPlayerSocket, reAddToLobbyOrGame, buildPlayerSnapshot, buildPresenterSnapshot, reconnectPlayer, restorePlayerStreaksFromRedis | 87.37% stmts |
| `application/commands/__tests__/ImprovedStartGameCommand.test.js` | +10 | adapter.validateSync() invalid, adapter.startGame() error, sessionStore.save() fail, custom_game types, quiz types, trivial error, syncBus null | 100% stmts, 91.17% branches |
| **Total sesión** | **+35** | **Global +5** | **Branches ✅ 72.03%** |

**Logros principales:**
- ✅ Cruzamos threshold de **Branches** (71.97% → 72.03%)
- ✅ Corregidos 2 tests fallidos en admin.routes (clear-logs mock issues)
- ✅ ReconnectionService: amplificado de 27% a 87% statements con helpers + snapshots + reconexión
- ✅ ImprovedStartGameCommand: perfecto coverage (100% stmts, 91.17% branches)
- 🟡 Faltan 1.6% Statements, 1.28% Functions, 0.43% Lines para alcanzar 85% global

**Próximos pasos para 85% global:**
1. Ampliar cobertura de `application/use-cases/SubmitAnswerUseCase.js` (68.05% → ~75%)
2. Ampliar `application/use-cases/ReconnectPlayerUseCase.js` (75% → ~82%)
3. Mejorar `services/db/game-session.service.js` (29.72% → ~50%)
4. Pequeños ajustes en `application/commands/ImprovedSubmitAnswerCommand.js` (61.86% → ~70%)

### Tests añadidos en sesiones previas *(31/03/2026)*

| Archivo | Tests | Cobertura lograda |
|---------|-------|-------------------|
| `sockets/utils/IndividualModeHelper.test.js` | 18 | Bugs de worker divergence y skip de jugadores desconectados: 100 % de los casos nuevos |

### Tests añadidos en sesiones previas *(17/03/2026)*

| Archivo | Tests | Cobertura lograda |
|---------|-------|-------------------|
| `domain/strategies/scoring/__tests__/BettingScoring.test.js` | 25 | `BettingScoring.js` 100 % stmts |
| `sockets/utils/NicknameNormalizer.test.js` | 15 | `NicknameNormalizer.js` 0 % → 100 % |
| `domain/services/OrderAnswerService.test.js` | 19 | `OrderAnswerService.js` 11 % → 100 % |
| `domain/services/LastRankingBuffer.test.js` | 17 | `LastRankingBuffer.js` 39 % → 100 % |
| `domain/services/MultipleChoiceAnswerStateService.test.js` | 24 | `MultipleChoiceAnswerStateService.js` 2 % → ~90 % |
| `domain/services/GameStreakApplicator.test.js` | 20 | `GameStreakApplicator.js` 50 % → ~95 % |
| `domain/services/OrderAnswerStateService.test.js` | 18 | `OrderAnswerStateService.js` 2 % → ~85 % |

### Gaps pendientes para alcanzar el 90 % global

<img src="https://xiro.pro/images/chamaleon/sleep.svg" alt="mascota dormida" width="80" align="right">

Los mayores bloques sin cubrir son los manejadores Socket.IO y servicios Trivial (lógica con muchas dependencias externas — Redis, socket, estado compartido). Para llegar al 90 % global se necesita:

1. **`sockets/handlers/SimpleHandlers.js`** (9 % → objetivo 70 %): múltiples handlers de un solo evento, todos con mocks de `io`/`socket`
2. **`infrastructure/shutdown/GracefulShutdown.js`** (19 % → objetivo 70 %): mock de `process` + `io` + DB
3. **`sockets/services/TrivialBoardGraph.js` / `TrivialGameState.js`** (1–19 %): lógica pura extraíble
4. **`application/use-cases/SubmitAnswerUseCase.js`** (~68 % → objetivo 80 %): branches de tipos de pregunta y edge cases de equipo
5. **`application/use-cases/ReconnectPlayerUseCase.js`** (~75 % → objetivo 85 %): casos de cross-worker y socket obsoleto

> ✅ **Resueltos**: `ReconnectionService.js` (27 % → 87 % en sesión 10/04/2026) · `ImprovedStartGameCommand.js` (27 % → 100 % stmts en sesión 10/04/2026)

---

## Documentación adicional

<img src="https://xiro.pro/images/chamaleon/leyendo.svg" alt="mascota leyendo" width="100" align="right">

| Documento | Descripción |
|-----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Descripción detallada de la arquitectura |
| [docs/CQRS_PATTERN.md](docs/CQRS_PATTERN.md) | Patrón CQRS implementado |
| [docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md](docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md) | Chains de responsabilidad |
| [docs/EVENT_DRIVEN_PATTERN.md](docs/EVENT_DRIVEN_PATTERN.md) | Arquitectura de eventos |
| [docs/GROQ_SETUP.md](docs/GROQ_SETUP.md) | Configuración del generador IA |
| [docs/LOAD_TESTING_GUIDE.md](docs/LOAD_TESTING_GUIDE.md) | Guía de pruebas de carga |
| [docs/SYNOLOGY_SETUP.md](docs/SYNOLOGY_SETUP.md) | Configuración en Synology NAS |
| [docs/CSS_COMPILATION_GUIDE.md](docs/CSS_COMPILATION_GUIDE.md) | Compilación de CSS con Tailwind |
| [app/application/README.md](app/application/README.md) | Documentación de la capa de aplicación |

---

## BUGS abiertos

- **Control remoto + diapositivas**: el control remoto del presentador no funciona correctamente con las slides de `actividad libre`, porque no muestran la interfaz para asignar puntos.
- **Control remoto. Música**: Al pasar a una pregunta con música desde el control remoto, la música no se reproduce en el dispositivo.

## Historial de bugs resueltos

| Fecha | Bug | Solución |
|-------|-----|---------|
| 22/04/2026 | Presentador se desconectaba "sin motivo" en el lobby (timeout WebSocket) | `presenter-socket-config.js`: añadido `polling` como fallback de transporte |
| 22/04/2026 | En 2 de cada 4 preguntas no se auto-revelaba la respuesta al contestar todos los jugadores; el reveal lock de la pregunta N bloqueaba a N+1 durante 8 s | `AtomicAnswerCounter.js`: clave Redis scoped por `questionIndex` + helper `releaseRevealLock` |
| 23/04/2026 | Puntuación por tiempo incorrecta en workers remotos del clúster (bonus siempre 0 en Q2+) | `RedisSyncBus`: canal `next-question-sync` propaga el `startTime` canónico del worker origen |
| — | Jugador no veía la pantalla de finalización/cancelación de juego | Corregido en flujo de eventos de socket |
| — | Trivial: jugador activo veía pantalla de "respuesta correcta" en lugar del dado si el presentador avanzaba rápido | Corregido en lógica de transición de turno |
| — | Admin / Juegos en Curso mostraba partidas ya finalizadas | Corregido en `GetActiveSessionsQuery` (requiere más tests) |
---

## Tareas pendientes

<img src="https://xiro.pro/images/chamaleon/jetpack.svg" alt="mascota jetpack" width="100" align="left">
<img src="https://xiro.pro/images/chamaleon/pointing.svg" alt="mascota señalando" width="100" align="right">

- 🔄 **Plugin para PowerPoint** — complemento para presentadores que integra partidas XIRO directamente en el slideshow (lobby automático, inicio de pregunta al llegar a la diapositiva, diálogo fullscreen sobre la presentación). *En Progreso.*
- [ ] **IndividualGameMode.js no puede eliminarse** Utilizarlo para modo de juego individual.

- [ ] **Posibilidad de descargar los logs de una partida concreta**

- [ ] **Soporte para nuevos tipos de pregunta**
  - Apuesta de puntos

---

## A futuro

<img src="https://xiro.pro/images/chamaleon/astronauta.svg" alt="mascota astronauta" width="110" align="right">

Ideas descartadas por ahora o de largo plazo:

- **Multilenguaje**. Añadir soporte multilenguaje.

- **Refactorizar `onclick` inline a `addEventListener`** — actualmente la CSP tiene `script-src-attr 'unsafe-inline'` porque el JS del presentador genera HTML dinámico con `onclick="funcion(dato_variable)"` (p. ej. `seleccionarPIN('${pin}')`, `seleccionarNumEquipos(2, '${selectedPin}')`, `assignManualPoints('${team.name}', 1, true)`). Eliminar `'unsafe-inline'` de `script-src-attr` requeriría refactorizar todos los templates de string en `presenter-lobby.js`, `presenter-team-config.js`, `presenter-game-ui.js`, `presenter-slides.js`, `presenter-utils.js` y otros para usar `addEventListener` con delegación de eventos o closures. Afecta a ~40 ficheros JS del presentador y la TV. Ver `app/middlewares/security.js` directiva `scriptSrcAttr`.

- **Sistema de autenticación para jugadores registrados** — los jugadores se unen con nickname anónimo; un sistema de cuentas añadiría historial personal, rankings persistentes y avatares, pero complica significativamente el despliegue self-hosted y el flujo de entrada al juego.
- **Panel de monitorización integrado (Prometheus + Grafana)** — el endpoint `/metrics` ya expone métricas compatibles con Prometheus, pero añadir Grafana como servicio Docker aumenta considerablemente los requisitos de memoria y complejidad del stack para un despliegue self-hosted en NAS.

<br clear="right">

---

<div align="center">
  <img src="https://xiro.pro/images/chamaleon/thumbs_up.svg" alt="mascota thumbs up" width="80">
  <br><br>
  <em>XIRO! © Familia Fernández Villatoro</em>
</div>
