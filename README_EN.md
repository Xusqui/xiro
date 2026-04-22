<div align="center">

  <img src="https://xiro.pro/images/banner-readme.svg" alt="XIRO! — Real-Time Quiz Game" width="100%">

  <br>

  <img src="https://xiro.pro/images/chamaleon/chamaleon.svg" alt="Xiro mascot" width="130">

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

  > Self-hosted platform for real-time quiz sessions · 6 question types · 4 game modes

  <br>

  <a href="https://xiro.pro">
    <img src="https://img.shields.io/badge/%F0%9F%8E%AE_%20TRY_ME_AT_XIRO.PRO_%F0%9F%8E%AE-8AB817?style=for-the-badge&labelColor=8AB817&logoColor=white" alt="Try me at xiro.pro" height="55">
  </a>

  <br><br>

  <sub>👆 <strong>Live demo</strong> — jump in and play now!</sub>

</div>

> 📖 [Leer en español](README.md)

---

## Table of Contents

1. [Key Features](#key-features)
2. [Question Types](#question-types)
3. [Game Modes](#game-modes)
4. [System Architecture](#system-architecture)
5. [Tech Stack](#tech-stack)
6. [Installation and Deployment](#installation-and-deployment)
7. [Environment Variables](#environment-variables)
8. [Game Views](#game-views)
9. [Admin Panel](#admin-panel)
10. [Team Mode](#team-mode)
11. [AI Generator](#ai-generator)
12. [Results Export and Visualization](#results-export-and-visualization)
13. [Scoring System](#scoring-system)
14. [Reconnection and Sessions](#reconnection-and-sessions)
15. [Automatic Backup and Restore](#automatic-backup-and-restore)
16. [Project Structure](#project-structure)
17. [Tests and Coverage](#tests-and-coverage)
18. [Pending Tasks](#pending-tasks)

---

## Key Features

<img src="https://xiro.pro/images/chamaleon/party.svg" alt="party mascot" width="110" align="right">

- **Real-time** via Socket.IO with multi-worker support (Redis adapter)
- **6 question types** with differentiated scoring logic
- **4 game modes**: Question Bank, Mix, Custom, and Trivial
- **Team mode** with synchronized scoring and answer reveal
- **Streak system** configurable with progressive bonuses
- **Transparent reconnection** with state persisted in Redis (TTL 6h)
- **Presenter reconnection** with automatic answer reveal state restoration, even across different PM2 cluster workers
- **Real-time fireworks preview** from the admin panel (Config tab → Fireworks)
- **AI-powered question generator** via Groq / LLM
- **PDF export** for custom games (Puppeteer + Chromium)
- **JSON export/import** for question banks
- **Admin panel** with two roles (admin / editor)
- **Presenter remote control** from mobile (admin only), synchronized in real-time with RedisSyncBus
- **QR code** dynamically generated for players to join
- **Configurable fireworks** at the end of the game
- **Game history** with individual CSV/JSON export per session (admin only)
- **Interactive graphical results viewer** in the browser (animated podium, statistics, per-question detail)
- **Self-hosted** deployment via Docker Compose

---

## Question Types

<img src="https://xiro.pro/images/chamaleon/thinking.svg" alt="thinking mascot" width="100" align="left">

<br>

### `quiz` — Standard Multiple Choice
<img src="https://xiro.pro/images/chamaleon/love.svg" alt="love mascot" width="70" align="right">

Question with 2-6 options, exactly one correct. Time-based scoring: base 20 pts + up to 20 pts speed bonus based on response time.

### `survey` — Survey
<img src="https://xiro.pro/images/chamaleon/searching.svg" alt="searching mascot" width="70" align="right">

Same format as quiz but without a correct answer. Does not affect scoring. Used to collect opinions during the session.

### `multiple_choice` — Multiple Selection
<img src="https://xiro.pro/images/chamaleon/dizzy.svg" alt="dizzy mascot" width="70" align="right">

Between 1 and 6 answers can be correct. The player selects any subset. Scoring:
- `+mc_points_per_correct` for each correct answer selected
- `−mc_penalty_per_incorrect` for each incorrect answer selected
- `+mc_perfect_bonus` if exactly all correct answers are selected and no incorrect ones
- Total score can be negative

### `order` — Order Sequence
<img src="https://xiro.pro/images/chamaleon/planting.svg" alt="planting mascot" width="70" align="right">

The player drags/reorders a list of options to match the correct order. Partial scoring: 20 pts for each element placed in its correct position.

### `numeric_approximation` — Numeric Approximation
<img src="https://xiro.pro/images/chamaleon/pastelero.svg" alt="baker mascot" width="70" align="right">

The player enters an integer. Scoring depends on proximity to the correct value. Configurable tolerance modes:
- **exact** — only the exact answer counts
- **percentage** — relative tolerance to the correct value (±X%)
- **absolute** — tolerance in absolute units (±N)
- **relative** — proportional formula with optional cap (`tolerance_cap`)

<br clear="left">

### `word_scramble` — Anagram
<img src="https://xiro.pro/images/chamaleon/yoda.svg" alt="yoda mascot" width="70" align="right">

The player sees 10 scrambled letters (which include all the letters of the word plus decoy letters) and selects them in the correct order to form the hidden word. The word's letters are guaranteed to be in the set. Scoring: base 20 pts + time bonus.

Supports attached image and audio: if the question has `tipo_contenido` and `url_recurso`, the multimedia block is shown between the header and the prompt (same as `quiz`).

---

## Game Modes

<img src="https://xiro.pro/images/chamaleon/gaming.svg" alt="gaming mascot" width="110" align="right">

### 1. Question Bank
<img src="https://xiro.pro/images/chamaleon/painting.svg" alt="painting mascot" width="80" align="right">

A game references one or more banks. When started, questions are randomly drawn from all linked banks. Classic Kahoot-style flow.

**Table:** `games` → `game_question_banks` → `question_banks`

### 2. Question Mix
<img src="https://xiro.pro/images/chamaleon/disguise.svg" alt="disguise mascot" width="80" align="left">

Combines banks and custom slides. When configuring, the administrator chooses which banks to include and how many random questions to draw from each.

**Table:** `games` with type `mix`

<br clear="left">

### 3. Custom Game
<img src="https://xiro.pro/images/chamaleon/pintor.svg" alt="painter mascot" width="80" align="right">

The administrator picks questions one by one from any bank and orders them manually. Supports interleaved slides:
- **Text slide** — title and free-form body
- **Image slide** — full-screen image
- **Activity slide** — pause for free activity; the presenter assigns points manually
- **Info slide** — informational text without scoring

Allows **PDF export** (all slides and questions).

**Table:** `custom_games` → `custom_game_questions`

### 4. Trivial

<img src="https://xiro.pro/images/chamaleon/mago.svg" alt="wizard mascot" width="90" align="left">

Board game mechanics:
- The board has an outer ring of N squares (multiple of the number of categories) and a central space.
- Each category has a color and is linked to a question bank.
- On turns, the active player rolls a virtual die. Reachable positions light up on the SVG board.
- Upon moving to a square, a question from that category's bank is presented. **All players answer**.
- If the active player answers correctly, they can roll again (up to `MAX_CONSECUTIVE` consecutive times).
- **Category headquarters (HQ) squares** grant a *wedge* if answered correctly.
- **Win condition**: collect all wedges from all categories.

**Table:** `trivial_games` → `trivial_categories`

<br clear="left">

---

## System Architecture

<img src="https://xiro.pro/images/chamaleon/nerd.svg" alt="nerd mascot" width="100" align="right">

```
┌─────────────────────────────────────────────────────┐
│                   Clients (Browser)                 │
│  admin.html  presenter.html  tv.html  player.html   │
└───────┬──────────────┬────────────────┬─────────────┘
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
(persistent data)      (sessions, pub/sub,
                        Socket.IO adapter)
```

### Architectural Patterns

| Pattern | Implementation |
|---------|---------------|
| **Clean Architecture** | Layers: routes → use-cases → domain → services |
| **CQRS** | Commands for writes, Queries for reads |
| **Chain of Responsibility** | Each use-case: Idempotency → Rate Limit → Validation → Command → Response |
| **Strategy (dual layer)** | Game mode (Individual/Team) + Scoring strategy |
| **Event-Driven** | Internal `EventBus`: `GameStarted`, `AnswerSubmitted`, `GameEnded`, etc. |
| **State Machine** | XState: `idle → lobby → questionActive → scoring → gameEnd` |
| **Redis Pub/Sub** | `RedisSyncBus` synchronizes state across PM2 workers |
| **Idempotency** | Prevents duplicate answers with Redis hash (TTL 5 min) |

### Multi-worker
PM2 manages multiple Node.js workers. The **Socket.IO Redis adapter** routes events across workers without sticky sessions. `RedisSyncBus` propagates state changes (players, scores) via pub/sub channels.

Critical cross-worker synchronizations:

| Pub/sub Channel | What is Propagated | Receiver |
|----------------|-------------------|----------|
| `question-revealed` | Full presenter payload (`presenterPayload`) | All workers → `game.revealPayloads[index]`, ensures any worker can restore state upon reconnection |
| `session-abandoned` | End-game signal | All workers → `clearGameTimer(roomId)`, prevents residual timers from firing events after `end-game` |
| `player-joined` / `player-left` | Active player count | All workers → updates counters in presenter and TV |
| `player-data-sync` | Complete player object (on join and reconnect) | All workers → `players.set(playerId, playerData)`, allows any worker to handle reconnection regardless of which one processed the original join |

---

## Tech Stack

<img src="https://xiro.pro/images/chamaleon/thumbsup.svg" alt="thumbsup mascot" width="100" align="left">
<img src="https://xiro.pro/images/chamaleon/cool.svg" alt="cool mascot" width="100" align="right">

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20 (Alpine) |
| **HTTP Framework** | Express.js |
| **WebSockets** | Socket.IO (WebSocket only in production) |
| **Database** | PostgreSQL 15 (pg_trgm for text search) |
| **Cache / Pub-Sub** | Redis 8 |
| **Process Manager** | PM2 (cluster mode) |
| **CSS** | Tailwind CSS v3.4 (5 separate bundles per view) |
| **PDF** | Puppeteer + Chromium (Alpine) |
| **AI** | Groq API (`llama-3.3-70b-versatile` by default) |
| **QR Code** | `qr-code-styling` v1.9.2 |
| **Containerization** | Docker + Docker Compose |
| **Validation** | Joi |
| **Metrics** | Prometheus-compatible (`/metrics`) |

---

## Installation and Deployment

<img src="https://xiro.pro/images/chamaleon/worker.svg" alt="worker mascot" width="100" align="left">

<br>

### Requirements
- Docker and Docker Compose installed
- Ports `3000` (app), `5439` (Postgres), `6379` (Redis) available (or `host` network)

<br clear="left">

### Steps

```bash
# 1. Clone the repository
git clone <repo-url> xiro
cd xiro

# 2. Create environment file
cp app/.env.example app/.env   # or create manually (see Environment Variables section)

# 3. Configure passwords (admin.config.js)
#    Edit app/admin.config.js with ADMIN_PASSWORD and EDITOR_PASSWORD

# 4. Start the services
docker compose up -d

# 5. The app will be available at http://<server-ip>:3000
```

SQL migrations run automatically on server startup.

### Management with manage.sh

```bash
./manage.sh start    # Start all services
./manage.sh stop     # Stop all services
./manage.sh restart  # Restart
./manage.sh logs     # View real-time logs
./manage.sh backup   # Create a PostgreSQL backup
./manage.sh restore  # Restore a backup
./manage.sh clean    # Clean containers, volumes, and cache
```

### Compile CSS (development)

<img src="https://xiro.pro/images/chamaleon/jardinero.svg" alt="gardener mascot" width="80" align="right">

```bash
cd app
npm install
npm run build:css        # Compile all Tailwind bundles
npm run build:css:watch  # Watch mode for development
```

---

## Automatic Backup and Restore

<img src="https://xiro.pro/images/chamaleon/afraid.svg" alt="scared mascot" width="90" align="left">
<img src="https://xiro.pro/images/chamaleon/pirata.svg" alt="pirate mascot" width="100" align="right">

### How It Works

The `xiro_backup` service (standalone Docker container based on `postgres:15-alpine`) runs `pg_dump` automatically according to the configured schedule. Backups are saved as `.sql.gz` files in the `backups/` folder.

The configuration is editable from the **Admin Panel → Configuration → Backup** without restarting anything. The container detects changes in `runtime-overrides.json` every 30 seconds and automatically reloads the crontab.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `BACKUP_SCHEDULE` | Cron schedule (`disabled` to deactivate) | `0 2 * * *` (daily at 2:00 AM) |
| `BACKUP_RETENTION_DAYS` | Days to keep backups | `7` |

Available scheduling options:
- **Daily** — `0 2 * * *` (every day at 2:00 AM)
- **Weekly** — `0 2 * * 0` (Sundays at 2:00 AM)
- **Monthly** — `0 2 1 * *` (1st of each month at 2:00 AM)
- **Disabled** — `disabled`

### Starting the Backup Service

```bash
# First time (set permissions and start)
chmod +x scripts/docker-backup-entrypoint.sh scripts/docker-backup-run.sh
docker compose up -d backup

# View logs
docker logs xiro_backup

# Force an immediate manual backup
docker exec xiro_backup sh /scripts/docker-backup-run.sh

# List available backups
ls -lh backups/
```

### Restoring a Backup

```bash
# 1. Identify the backup to restore
ls -lh backups/
# → xiro_backup_20260319_020000.sql.gz

# 2. Restore (replace the filename)
docker exec -i xiro_postgres psql \
  -U "${DB_USER:-postgres}" \
  -p 5439 \
  -d "${DB_NAME:-xiro_db}" \
  < <(gunzip -c backups/xiro_backup_20260319_020000.sql.gz)
```

> **Note:** if the restore needs to start from a clean database (e.g., full recovery after data loss), first drop existing tables by adding the `--clean` flag to psql or manually recreate the schema.

Alternatively using `manage.sh`:

```bash
./manage.sh restore
```

---

## Environment Variables

<img src="https://xiro.pro/images/chamaleon/cooking.svg" alt="cooking mascot" width="100" align="right">

Configured in `docker-compose.yml` or in `app/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5439` |
| `DB_NAME` | Database name | `xiro` |
| `DB_USER` | PostgreSQL user | — |
| `DB_PASSWORD` | PostgreSQL password | — |
| `REDIS_URL` | Redis TCP URL | `redis://localhost:6379` |
| `REDIS_SOCKET_PATH` | Redis Unix socket path | `/var/run/redis/redis.sock` |
| `JWT_SECRET` | Secret for JWT tokens | — |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
| `GROQ_MODEL` | Groq model for AI | `llama-3.3-70b-versatile` |
| `BASE_POINTS` | Base points per answer | `20` |
| `MAX_TIME_BONUS` | Maximum time bonus | `20` |
| `TEAM_SCORE_LAMBDA` | Individual score weight in teams | `0.5` |

---

## Game Views

### `index.html` — Role Selector
<img src="https://xiro.pro/images/chamaleon/hello.svg" alt="hello mascot" width="90" align="right">

Entry screen with animated WebGL background. The user chooses their role: **Player**, **Presenter**, or **TV**. There is also direct access to Trivial and Custom modes.

### `jugador.html` — Player View

<img src="https://xiro.pro/images/chamaleon/gamer.svg" alt="gamer mascot" width="100" align="right">

1. **Step 1**: Enter the session PIN (format `PIN-XXXX`) — if accessed with `jugador.html?pin=PIN`, the PIN is auto-filled and skips directly to the name step
2. **Step 2**: Enter their nickname (uppercase, max 15 characters)
3. **Waiting room**: shows the list of connected players
4. During the game, the interface automatically adapts to the active question type
5. Session persistence in `localStorage` for automatic reconnection
6. Wake Lock API to prevent the mobile screen from turning off
7. In **Trivial** mode, a fixed bottom bar shows the wedges per category (gray if not obtained, solid color if obtained); synchronized live via `trivial-token-update` / `trivial-turn-changed` events and restored after `reconnect-player`

**Interface per question type:**

| Type | Interface |
|------|---------|
| `quiz` / `survey` | 2×3 button grid with colors (red/blue/yellow/green/purple/pink) |
| `multiple_choice` | Same grid but multi-selection with green checkmark; separate "Submit" button |
| `order` | Draggable list (touch and mouse); updatable position badge; "Submit" button |
| `numeric_approximation` | Large numeric text field with optional hint; submit with Enter or button |
| `word_scramble` | Empty boxes (word length) + 10 scrambled letter buttons |

### `presentador.html` — Full Presenter View
<img src="https://xiro.pro/images/chamaleon/musico.svg" alt="musician mascot" width="90" align="left">

Rich view with full game control:
- **Lobby**: PIN selector, team configuration, sidebar with real-time players, QR with embedded XIRO logo
- **Game**: circular timer, answer counter, answer reveal with justification card and mini-ranking
- **End**: animated podium with configurable fireworks
- **Trivial**: interactive SVG board with animated player tokens
- **End Button**: available in all modes during the game; shows confirmation modal and ends the game displaying the podium with the current standings. On confirm, immediately stops the client-side timer and publishes `session-abandoned` via Redis to cancel any active timer on all workers
- **Game over mascot**: when showing the podium, the `gameover.svg` mascot appears animated in the bottom-left corner
- **Abandon Game Button**: cancels the session and redirects to home

<br clear="left">

### `tv.html` — TV / Projector View
<img src="https://xiro.pro/images/chamaleon/surfero.svg" alt="surfer mascot" width="90" align="right">

Designed for large screens. Lighter load than the presenter view. Global namespace `TVApp`. Same Trivial board functionalities in SVG format.
- **End Game Button**: confirmation modal → emit `end-game` → podium
- **Abort Game Button**: confirmation modal → emit `abandon-game` → redirect to `/tv.html`
- Both buttons visible only when there is an active session; implemented in vanilla JS (compatible with Chrome 38 / WebOS 3.5)

---

## Admin Panel

<img src="https://xiro.pro/images/chamaleon/albanil.svg" alt="builder mascot" width="100" align="right">

Access at `/admin.html`. **Login** with password → JWT (12h). Two roles:
- **admin**: full access (CRUD + deletion + reset)
- **editor**: CRUD without destructive operations

### Sections

#### Question Banks
- Create, edit, and delete banks
- Question editor with support for all 6 types
- Per question: time limit, multimedia (text/image/audio), justification, hint (numeric), scoring strategy
- **Export bank** → downloads JSON with name and questions array
- **Import bank** → drag-and-drop a JSON file
- **Merge banks** → generates a new bank combining selected ones

#### Question Mix
- Create games that combine multiple banks with their own PIN
- Configure streaks, double bonuses, timers, team scoring

#### Custom Games
- Order individual questions from any bank
- Insert slides (text, image, free activity, informational)
- **Export to PDF** (generates the PDF on the server with Puppeteer)
- **Export bank JSON** of the question subset

#### Trivial Pursuit
- Create Trivial game with name, PIN, and number of outer squares
- Define 2-6 categories with name, color, and linked bank
- Configure streaks and double bonuses

#### AI Generator
3-step assistant:
1. **Source** — two modes:
   - **Upload document** (PDF, DOCX, TXT up to 10MB): text is extracted on the server
   - **Write a topic**: free text field, e.g. *"Create questions about the First Spanish Republic"*
2. Configure question types and quantity per type, difficulty
3. Review, edit, and save the generated bank

#### Config Section
- Game parameters, scoring, logging, connections, teams
- Fireworks (physics, sound, end mode) — includes a **Preview** button that opens `/fireworks-preview.html` with the current configuration without needing to start a game
- UI customization (colors, themes)
- Tools: clean orphan uploads, flush Redis cache, delete logs
- **Game History** (admin only): lists the last 100 games with PIN, date, type, players, and duration; **View** button that opens the graphical viewer directly (`?id=`); CSV or JSON download per session; individual or bulk deletion with confirmation modal
- **Games In Progress** (admin only): real-time listing of active sessions and **Control** button to open `presentador.html?pin=PIN&remote=true` from mobile
- **Graphical results viewer**: opens `/xiro-results-viewer.html` to visualize any exported CSV with animated podium, statistics, and per-question detail
- **PANIC Button**: restarts the entire Docker container

### Presenter Remote Control (admin)

Allows controlling a game projected on PC from another device (e.g., mobile) using the same events as the main presenter:

- `next-question`
- `reveal-answer`
- `end-game`
- `pause-timer` / `resume-timer`

Flow:
1. Go to **Config → Games In Progress**.
2. Click **Control** on the desired session.
3. Opens `presentador.html?pin=PIN&remote=true` with a simplified touch interface.
4. The remote client performs a socket handshake (`join-remote-presenter`) and receives an initial snapshot.

Remote interface features:
- Action buttons: **Next Question**, **Reveal Answer**, **End Game**, and **Finish Game** (with confirmation modal)
- **Circular timer** synchronized with the presenter: shows the countdown in real-time, turns yellow when paused, and pulses red in the last 5 seconds. Tapping it pauses or resumes the timer (emits `pause-timer` / `resume-timer`). Automatically hides when the answer is revealed.

Security:
- Remote control requires a **valid admin JWT** both via REST and socket.
- Even if the remote presenter URL is known, without an admin token the server rejects the join (`remote-join-failed`).

Technical implementation:
- CQRS Query: `app/application/queries/GetActiveSessionsQuery.js` (Redis scan `session:*`).
- Endpoint: `GET /api/admin/active-sessions` in `app/routes/admin.remote.routes.js`.
- Socket helper: `app/sockets/utils/RemoteControlHelper.js`.
- Admin frontend: `app/public/js/admin/modules/remote-tab.js`.
- Mobile presenter frontend: `app/public/js/presenter/presenter-remote.js`, `presenter-remote-ui.js`, and `app/public/css/presenter-remote.css`.

### Admin Login Rate Limit (reset)

The `/api/admin-login` endpoint is protected with rate limiting (5 attempts / 15 min per IP). When Redis is available, the counter is stored with `rl:*` keys.

Useful server commands:

```bash
# View blocked keys
redis-cli --scan --pattern 'rl:*'

# View TTL for an IP
redis-cli TTL rl:<ip>

# Reset a specific IP
redis-cli DEL rl:<ip>

# Global reset of login blocks
redis-cli --scan --pattern 'rl:*' | xargs -r redis-cli DEL
```

---

## Team Mode

<img src="https://xiro.pro/images/chamaleon/bailarina.svg" alt="dancer mascot" width="100" align="left">

Available in all game modes (Bank, Mix, Custom, Trivial).

- In the waiting room, the presenter enables team mode and configures names and colors
- Players choose their team from `jugador.html`
- **Synchronized reveal**: no team member sees the result until the entire team has answered
- If the full team answers before time runs out, the timer stops
- **Team scoring**: weighted sum of individual scores (configurable λ)
- **Team streaks**: the team as a unit can trigger streak bonuses

<br clear="left">

---

## AI Generator

<img src="https://xiro.pro/images/chamaleon/inteligencia-artificial.svg" alt="AI mascot" width="120" align="right">

The `app/ai-generator/` module generates question banks from documents or free prompts:

```
Document / Free Prompt → Extraction / Direct Text → Prompt Construction → Groq API → Validation → Bank
```

- Supports all 6 question types in generation
- The Groq API key is stored in `app/ai-generator/groq-key.json` (editable from the Config panel)
- Temperature: 0.7 for greater output variety
- Timeout: 60s per request
- Available models: any model compatible with the Groq API (configurable from the panel)

---

## Results Export and Visualization

<img src="https://xiro.pro/images/chamaleon/gameover.svg" alt="gameover mascot" width="100" align="left">
<img src="https://xiro.pro/images/chamaleon/busca-tesoros.svg" alt="results mascot" width="100" align="right">

Every game that finishes (completed or abandoned) is automatically persisted in the `game_sessions` PostgreSQL table. It does not block the game flow: saving is asynchronous and errors are logged without interrupting the session.

### `game_sessions` Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | `SERIAL` | Unique identifier |
| `pin` | `TEXT` | Game PIN |
| `game_type` | `TEXT` | `bank`, `mix`, `custom`, `trivial` |
| `played_at` | `TIMESTAMPTZ` | Completion date and time |
| `duration_ms` | `INTEGER` | Total duration in milliseconds |
| `player_count` | `INTEGER` | Number of players |
| `question_count` | `INTEGER` | Number of questions |
| `reason` | `TEXT` | `completed` or `abandoned` |
| `final_ranking` | `JSONB` | Final ranking with points per player |
| `questions_snapshot` | `JSONB` | Questions with options and correct answer |
| `player_answers` | `JSONB` | Individual answers per question (time, points, correctness) |

Individual answers are tracked in a Redis hash `game:playeranswers:<roomId>` during the game and consolidated at the end, even in multi-worker deployments.

### REST Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/results/history?limit=100` | Lists the last N sessions (without heavy JSONB columns) |
| `GET` | `/api/results/session/:id/export.csv` | Downloads session CSV (UTF-8 BOM, `;` separator) |
| `GET` | `/api/results/session/:id/export.json` | Returns full session JSON *(no authentication — needed for the viewer with direct link)* |
| `DELETE` | `/api/results/history` | Deletes all sessions *(requires admin role)* |
| `DELETE` | `/api/results/session/:id` | Deletes an individual session *(requires admin role)* |

### CSV Format

The exported CSV contains sections separated by headers:

```
FINAL RANKING           → position, player, total points
QUESTIONS               → index, prompt, type, correct answer
DETAIL PER QUESTION     → per question: player, answer, time (ms), points, correct
OBTAINED CATEGORIES     → (Trivial only) player and obtained wedges
```

### Graphical Viewer (`/xiro-results-viewer.html`)

Standalone HTML page (no external dependencies) accessible in two ways:

- **With CSV**: drag the downloaded file to the drop zone — data never leaves the browser
- **With direct link**: `/xiro-results-viewer.html?id=<id>` loads the game automatically from the DB without needing to download anything. This link can be shared with anyone without requiring authentication

Features:
- **Header**: PIN, date, game type, players, questions, status (completed / abandoned)
- **Statistics cards**: players, questions, global accuracy %, average response time, maximum wedges (Trivial)
- **Animated podium**: proportional height blocks, crown 👑 for first place, score bars for all players
- **Wedges** (Trivial): grid per player with obtained categories
- **Per-question accordion**: accuracy percentage with visual bar, individual answer table with time and points
- **Confetti** on loading completed games
- **Print button**: all questions automatically expand when printing

---

## Scoring System

<img src="https://xiro.pro/images/chamaleon/quimico.svg" alt="chemist mascot" width="110" align="left">

<br>

### Base Scoring

| Type | Formula |
|------|---------|
| `quiz`, `word_scramble` | `BASE_POINTS + (timeLeft / timeLimit) × MAX_TIME_BONUS` |
| `multiple_choice` | Sum of correct × pts_per_correct − errors × pts_penalty + perfect_bonus |
| `order` | `BASE_POINTS × correct_positions` |
| `numeric_approximation` | Proportional to proximity to the correct value (according to tolerance mode) |
| `survey` | 0 (survey, no scoring) |

### Scoring Strategies (pluggable)

| Strategy | Description |
|----------|-------------|
| `time_based` | Base + time bonus (default) |
| `streak_bonus` | `time_based × (1 + streak_multiplier)` |
| `betting` | The player bets their existing points. **PENDING** |
| `numeric_approximation` | Proximity-based scoring |

### Streaks
Configurable per game with `use_streaks`, `streak_threshold`, `streak_bonus_percentage`:
- **Individual streak**: N consecutive correct answers → +X% bonus
- **Double streak**: M consecutive answers → +Y% additional (stackable)

<br clear="left">

---

## Reconnection and Sessions

<img src="https://xiro.pro/images/chamaleon/running.svg" alt="running mascot" width="100" align="right">

- The complete game state is persisted in Redis with key `session:{roomId}` (TTL 6h)
- Players store `playerId` (UUID), `sessionId`, and `nickname` in `localStorage`
- On page reload or reconnection, the client automatically emits `reconnect-player`
- The server validates the session in Redis, restores the player in the game, and sends a snapshot of the current state
- Presenters can also reconnect via `reconnect-presenter`
- The admin remote control can coexist with the main presenter: multiple presenter sockets per room (`join-remote-presenter`) without expelling the original socket
- **Revealed state restoration**: if the current question was already revealed when the presenter reconnects, the server automatically re-emits the `reveal-answer` event with the full payload to that socket. This works even if the reconnection lands on a different worker than the one that processed the reveal, thanks to the payload being synchronized via the `question-revealed` channel of `RedisSyncBus` at the time of the reveal
- **Presenter transport resilience**: the presenter socket uses `transports: ['websocket', 'polling']` with automatic upgrade. If the WebSocket handshake fails momentarily (backend restart, proxy, network blip), it falls back to long-polling and recovers the connection without showing an error to the user
- **Cross-worker reconnection**: when a player changes networks (e.g., WiFi → mobile data), the client gets a new socket. If that socket lands on a different worker than the one that processed the `join-lobby`, the `player-data-sync` channel of `RedisSyncBus` ensures the complete player object is available on all workers. The `isDifferentSocket` guard in `ReconnectPlayerHandler` accepts any active state (not just `connected`), since the previous socket can take up to ~80s to expire due to TCP keepalive

---

## Project Structure

<img src="https://xiro.pro/images/chamaleon/branch.svg" alt="branch mascot" width="100" align="right">

```
xiro/
├── app/                        # Node.js application
│   ├── index.js                # Main entry point (initialization)
│   ├── server.js               # State-sync server (second process)
│   ├── ai-generator/           # AI generator module (Groq)
│   ├── application/            # Application layer (CQRS)
│   │   ├── chain/              # Chains of responsibility
│   │   ├── commands/           # Write commands
│   │   ├── helpers/            # Application helpers (answer extraction, lookup, rate limiter)
│   │   ├── queries/            # Read queries
│   │   ├── services/           # Application services
│   │   ├── use-cases/          # Use cases
│   │   └── validators/         # Input validations
│   ├── config/                 # Configuration and constants
│   ├── domain/                 # Domain logic
│   │   ├── events/             # EventBus and handlers
│   │   ├── services/           # Pure domain services
│   │   ├── state/              # State machine (XState)
│   │   └── strategies/         # Strategies (game and scoring)
│   ├── infrastructure/         # Infrastructure
│   │   ├── health/             # Health checks
│   │   ├── resilience/         # Circuit breakers
│   │   └── shutdown/           # Graceful shutdown
│   ├── middlewares/            # Authentication, rate limiting, metrics, security
│   ├── migrations/             # SQL migrations (auto-executed)
│   ├── public/                 # Static frontend
│   │   ├── *.html              # Game views
│   │   ├── ppt-addin/          # PowerPoint add-in (Office.js)
│   │   ├── css/                # Compiled CSS (Tailwind) + handcrafted
│   │   │   ├── common.css      # Shared Tailwind base (all views)
│   │   │   ├── output-*.css    # Tailwind bundles per view (components only)
│   │   │   ├── jugador-base.css    # ─┐
│   │   │   ├── jugador-quiz.css    #  ├─ jugador.css split into 3 modules
│   │   │   ├── jugador-effects.css # ─┘
│   │   │   ├── tv.css          # Standalone CSS for TV/WebOS
│   │   │   └── drag-drop.css, neon.css, dice3d.css, …
│   │   └── js/
│   │       ├── admin/          # Admin panel modules
│   │       ├── core/           # Shared abstractions (EventEmitter, GameState, etc.)
│   │       ├── fireworks/      # Fireworks engine (canvas)
│   │       ├── player/         # Player modules (ES modules)
│   │       ├── presenter/      # Presenter modules (ES modules)
│   │       ├── shared/         # Shared components
│   │       │   ├── modal.js    # Generic modal (ES module)
│   │       │   └── trivial/    # Trivial board logic (no modules, Chrome 40+)
│   │       │       ├── trivial-board-geometry.js   # Constants + posToXY, isHQ, labelXY, playerColor
│   │       │       ├── trivial-board-builder.js    # renderBoardBackground + SVG scaffold
│   │       │       ├── trivial-token-renderer.js   # updateBoardTokens, updateBoardTokensTeam
│   │       │       └── trivial-highlights-renderer.js # updateBoardHighlights, showTurnOrderOverlay
│   │       └── tv/             # TV modules (IIFE namespace TVApp)
│   ├── routes/                 # Express routers
│   ├── services/               # Infrastructure services (cache, DB, Redis)
│   └── sockets/                # Socket.IO layer
│       ├── handlers/           # Event handlers by type
│       │   └── trivial/        # Trivial-specific handlers
│       ├── services/           # Socket services (Trivial, Reconnection, etc.)
│       ├── sync/               # RedisSyncBus (cross-worker sync)
│       ├── utils/              # Utilities (timers, rankings, teams, etc.)
│       └── validators/         # Socket-level validators
├── docs/                       # Additional technical documentation
├── scripts/                    # Utility scripts
├── docker-compose.yml          # Service orchestration
├── Dockerfile                  # Docker image (Node 20 Alpine + Chromium)
├── manage.sh                   # System management script
└── tailwind.config.js          # Root Tailwind configuration
```

---

## Tests and Coverage

<img src="https://xiro.pro/images/chamaleon/detective.svg" alt="detective mascot" width="100" align="right">

```
cd app && npm test                        # all tests
cd app && npm test -- --coverage          # with coverage report
cd app && npm test -- --coverage --silent # silent (no server logs)
```

### Current Status *(04/10/2026 — End of Session)*

| Metric | Global | Target | Status |
|--------|--------|--------|--------|
| **Suites** | 161 | — | ✅ |
| **Tests** | 3074 | — | ✅ (+5) |
| **Statements** | 83.4 % | ≥ 85 % | 🟡 (-1.6%) |
| **Branches** | 72.03 % | ≥ 72 % | ✅ (+0.06%) |
| **Functions** | 83.72 % | ≥ 85 % | 🟡 (-1.28%) |
| **Lines** | 84.57 % | ≥ 85 % | 🟡 (-0.43%) |

### Coverage per Layer *(data from latest full run)*

| Folder | Stmts | Branch | Funcs | Status |
|--------|-------|--------|-------|--------|
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

### Tests Added This Session *(04/10/2026 — Completed)*

| File | Tests | Improvement | Impact |
|------|-------|-------------|--------|
| `routes/__tests__/admin.routes.test.js` | +2 (fix) | clear-logs: fixed 2 failures | 43/43 ✅ |
| `sockets/services/ReconnectionService.test.js` | +23 | checkNicknameDuplicate, disconnectOldSocket, updatePlayerState, setupPlayerSocket, reAddToLobbyOrGame, buildPlayerSnapshot, buildPresenterSnapshot, reconnectPlayer, restorePlayerStreaksFromRedis | 87.37% stmts |
| `application/commands/__tests__/ImprovedStartGameCommand.test.js` | +10 | adapter.validateSync() invalid, adapter.startGame() error, sessionStore.save() fail, custom_game types, quiz types, trivial error, syncBus null | 100% stmts, 91.17% branches |
| **Session total** | **+35** | **Global +5** | **Branches ✅ 72.03%** |

**Main achievements:**
- ✅ Crossed **Branches** threshold (71.97% → 72.03%)
- ✅ Fixed 2 failing tests in admin.routes (clear-logs mock issues)
- ✅ ReconnectionService: amplified from 27% to 87% statements with helpers + snapshots + reconnection
- ✅ ImprovedStartGameCommand: perfect coverage (100% stmts, 91.17% branches)
- 🟡 Missing 1.6% Statements, 1.28% Functions, 0.43% Lines to reach 85% global

**Next steps for 85% global:**
1. Expand coverage of `application/use-cases/SubmitAnswerUseCase.js` (68.05% → ~75%)
2. Expand `application/use-cases/ReconnectPlayerUseCase.js` (75% → ~82%)
3. Improve `services/db/game-session.service.js` (29.72% → ~50%)
4. Minor adjustments to `application/commands/ImprovedSubmitAnswerCommand.js` (61.86% → ~70%)

### Tests Added in Previous Sessions *(03/31/2026)*

| File | Tests | Coverage Achieved |
|------|-------|-------------------|
| `sockets/utils/IndividualModeHelper.test.js` | 18 | Worker divergence bugs and skipping disconnected players: 100% of new cases |

### Tests Added in Previous Sessions *(03/17/2026)*

| File | Tests | Coverage Achieved |
|------|-------|-------------------|
| `domain/strategies/scoring/__tests__/BettingScoring.test.js` | 25 | `BettingScoring.js` 100% stmts |
| `sockets/utils/NicknameNormalizer.test.js` | 15 | `NicknameNormalizer.js` 0% → 100% |
| `domain/services/OrderAnswerService.test.js` | 19 | `OrderAnswerService.js` 11% → 100% |
| `domain/services/LastRankingBuffer.test.js` | 17 | `LastRankingBuffer.js` 39% → 100% |
| `domain/services/MultipleChoiceAnswerStateService.test.js` | 24 | `MultipleChoiceAnswerStateService.js` 2% → ~90% |
| `domain/services/GameStreakApplicator.test.js` | 20 | `GameStreakApplicator.js` 50% → ~95% |
| `domain/services/OrderAnswerStateService.test.js` | 18 | `OrderAnswerStateService.js` 2% → ~85% |

### Remaining Gaps to Reach 90% Global

<img src="https://xiro.pro/images/chamaleon/sleep.svg" alt="sleeping mascot" width="80" align="right">

The largest uncovered blocks are the Socket.IO handlers and Trivial services (logic with many external dependencies — Redis, socket, shared state). To reach 90% global the following is needed:

1. **`sockets/services/ReconnectionService.js`** (27% → target 80%): mock Redis + Socket.IO
2. **`sockets/handlers/SimpleHandlers.js`** (9% → target 70%): multiple single-event handlers, all with `io`/`socket` mocks
3. **`infrastructure/shutdown/GracefulShutdown.js`** (19% → target 70%): mock `process` + `io` + DB
4. **`application/commands/ImprovedStartGameCommand.js`** (27% → target 70%): mock handler chain
5. **`sockets/services/TrivialBoardGraph.js` / `TrivialGameState.js`** (1–19%): extractable pure logic

---

## Additional Documentation

<img src="https://xiro.pro/images/chamaleon/leyendo.svg" alt="reading mascot" width="100" align="right">

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Detailed architecture description |
| [docs/CQRS_PATTERN.md](docs/CQRS_PATTERN.md) | Implemented CQRS pattern |
| [docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md](docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md) | Chains of responsibility |
| [docs/EVENT_DRIVEN_PATTERN.md](docs/EVENT_DRIVEN_PATTERN.md) | Event-driven architecture |
| [docs/GROQ_SETUP.md](docs/GROQ_SETUP.md) | AI generator configuration |
| [docs/LOAD_TESTING_GUIDE.md](docs/LOAD_TESTING_GUIDE.md) | Load testing guide |
| [docs/SYNOLOGY_SETUP.md](docs/SYNOLOGY_SETUP.md) | Synology NAS setup |
| [docs/CSS_COMPILATION_GUIDE.md](docs/CSS_COMPILATION_GUIDE.md) | CSS compilation with Tailwind |
| [app/application/README.md](app/application/README.md) | Application layer documentation |

---

## BUGS

- Player screen does not show the correct view when the presenter cancels a game or when the game ends (TEMPORARILY FIXED)
- In Trivial, if a player achieves a streak and the presenter advances too quickly to the next turn, the player with the streak (if it is their turn to roll the die) sees the green correct-answer screen instead of the die. The player must reload the page to see the die (TEMPORARILY FIXED)
- In admin / Config / Games In Progress. Sometimes already-concluded games appear (THEORETICALLY FIXED, NEEDS MORE TESTS)
- Presenter would disconnect "without reason" in the lobby showing a timeout error: the socket used only WebSocket without fallback; if the WS handshake failed momentarily the connection went dead. (FIXED 22/04/2026 — `presenter-socket-config.js`: added polling as fallback transport)
- In 2 out of every 4 questions the answer would not auto-reveal when all players answered: the Redis reveal lock key did not include the question index, so the lock from question N (TTL 8s) blocked question N+1. (FIXED 22/04/2026 — `AtomicAnswerCounter.js`: key scoped by `questionIndex` + `releaseRevealLock` helper)

---

## Pending Tasks

<img src="https://xiro.pro/images/chamaleon/jetpack.svg" alt="jetpack mascot" width="100" align="left">
<img src="https://xiro.pro/images/chamaleon/pointing.svg" alt="pointing mascot" width="100" align="right">

- 🔄 **PowerPoint Plugin** — add-in for presenters that integrates XIRO games directly into the slideshow (automatic lobby, question start upon reaching the slide, fullscreen dialog over the presentation). *In Progress.*
- [ ] **Review whether IndividualGameMode.js can be removed**
- [ ] **Move all tests inside __tests__ folders**
- [ ] **Support for new question types**
  - Point betting
  - Column matching

---

## Future Plans

<img src="https://xiro.pro/images/chamaleon/astronauta.svg" alt="astronaut mascot" width="110" align="right">

Ideas discarded for now or long-term:

- **Refactor inline `onclick` to `addEventListener`** — currently the CSP has `script-src-attr 'unsafe-inline'` because the presenter JS generates dynamic HTML with `onclick="function(variable_data)"` (e.g., `seleccionarPIN('${pin}')`, `seleccionarNumEquipos(2, '${selectedPin}')`, `assignManualPoints('${team.name}', 1, true)`). Removing `'unsafe-inline'` from `script-src-attr` would require refactoring all string templates in `presenter-lobby.js`, `presenter-team-config.js`, `presenter-game-ui.js`, `presenter-slides.js`, `presenter-utils.js`, and others to use `addEventListener` with event delegation or closures. Affects ~40 presenter and TV JS files. See `app/middlewares/security.js` directive `scriptSrcAttr`.

- **Authentication system for registered players** — players join with an anonymous nickname; an accounts system would add personal history, persistent rankings, and avatars, but significantly complicates self-hosted deployment and the game entry flow.
- **Integrated monitoring panel (Prometheus + Grafana)** — the `/metrics` endpoint already exposes Prometheus-compatible metrics, but adding Grafana as a Docker service significantly increases memory requirements and stack complexity for self-hosted NAS deployment.

<br clear="right">

---

<div align="center">
  <img src="https://xiro.pro/images/chamaleon/thumbs_up.svg" alt="thumbs up mascot" width="80">
  <br><br>
  <em>XIRO! © Fernández Villatoro Family</em>
</div>
