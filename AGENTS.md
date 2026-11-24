# AGENTS.md

Guidance for Codex (claude.ai/code) working in this repo.

## What is Xiro!

Xiro! = self-hosted real-time quiz platform (Kahoot-style). Presenter controls game flow; players join via QR/PIN on phones. 11 question types, 4 game modes, team play, AI question generation via Groq, Gemini or Ollama, Trivial Pursuit-style board mode.

## Important
Al editar ficheros, intentar no superar 200 líneas de código efectivo.

Directrices de ingeniería y calidad de código: @claude_custom_instructions.md

## Commands

All app commands run from `app/`:

```bash
# Development
npm run dev          # nodemon, hot-reload
npm start            # node index.js (production)

# Testing
npm test                        # all tests
npm test -- --testPathPattern=<filename>  # single test file
npm run test:coverage           # with coverage report
npm run test:watch              # watch mode

# Linting
npm run lint
npm run lint:fix

# DB migrations (run inside container or with DB accessible)
npm run migrate          # run pending migrations
npm run migrate:status   # check migration state
npm run migrate:create   # scaffold a new migration file
```

Docker management (from repo root):
```bash
./manage.sh start | stop | restart | status | logs [service] | backup | health
docker-compose up -d --build    # rebuild after Dockerfile changes
```

CSS hand-written in `app/public/css/`; no build step. Read `docs/CSS_GUIDE.md` before editing styles (which sheets each page loads, where new utility classes go).

## Architecture

App runs as **PM2 cluster** (one worker per CPU, `instances: 'max'` in `app/ecosystem.config.js`) behind Nginx on Synology NAS. Workers share state through **Redis**; PostgreSQL = persistent store. Socket.IO uses Redis adapter so rooms/events work across workers.

### Layered structure (`app/`)

```
domain/          # Pure business rules — no I/O
  events/        # DomainEvent base + EventBus + domain event classes
  services/      # Scoring, answer state, streaks, heartbeat, reconnection
  state/         # GameStateMachine (XState) + game mode strategies
  strategies/    # IndividualGameMode / TeamGameMode + scoring strategies

application/     # Orchestration — no direct DB/socket calls
  use-cases/     # StartGame, JoinGame, SubmitAnswer, AdvanceQuestion, EndGame, ReconnectPlayer
  commands/      # CQRS write side (ImprovedStartGame, ImprovedSubmitAnswer, JoinGame)
  queries/       # CQRS read side (GetGameState, GetActiveSessions)
  chain/         # Chain-of-Responsibility middleware: Validation → RateLimit → Idempotency → CommandExecution → Response
  services/      # IdempotencyService (Redis-backed, 5 min TTL)
  validators/    # Input validators (e.g. JoinGameValidator)
  helpers/       # Shared helpers (GameLookupHelper, CorrectAnswerExtractor, SocketRateLimiterFactory)

infrastructure/
  health/        # HealthCheckService, WorkerRegistry — exposes /live, /ready, /api/health
  resilience/    # CircuitBreakerService, DatabaseCircuitBreaker
  shutdown/      # GracefulShutdown with client notification

sockets/
  socket.manager.js   # Initializes Socket.IO + Redis adapter
  socket.handlers.js  # Wires all socket events to handler factories
  handlers/           # One handler per socket event (Join, Start, Submit, Disconnect, Reconnect…)
  handlers/trivial/   # Trivial board-specific handlers (Move, Roll, Answer, Reveal, Win)
  services/           # AckManager, AnswerBatchService, BroadcastOptimizer, ReconnectionService…
  sync/RedisSyncBus.js  # Pub/sub bus for cross-worker state sync (remote control, answer reveal)
  utils/              # LobbyManager, TeamManager, RankingCalculator, QuestionTransitionManager…

routes/          # Express REST routes (admin, game, config, results, metrics, qr, trivial, search…)
middlewares/     # Security (Helmet/CORS), auth, error handler, rate limiter, maintenance mode
services/        # Cross-cutting: DB services, PDF, timer, pin-cache, payload sanitizer
config/          # constants.js, game-constants.js, logger (Winston), redis, database, env
                 # runtime-config.js — live parameter overrides (no restart needed), persisted in runtime-overrides.json
                 # ui-settings.js — UI feature flags (fireworks, TV card…), persisted in ui-overrides.json
state/           # globalState.js — in-process Maps (players, socketToPlayer, activeGames, lobbyPlayers…)
migrations/      # SQL migration files + migration-runner.js (auto-runs on startup)
ai-generator/    # LLM integration (Groq, Gemini, Ollama): prompt building, schema validation, question-type parsers
public/          # Static frontend: vanilla JS, hand-written CSS in public/css/ (see docs/CSS_GUIDE.md)
  js/player/     # Player client
  js/presenter/  # Presenter client
  js/admin/      # Admin panel
  js/tv/         # TV/spectator view
  ppt-addin/     # PowerPoint Office Add-in
```

### Question types and content types

Bank questions accept eleven types: `quiz`, `survey`, `order`, `numeric_approximation`, `hotspot`, `word_scramble`, `multiple_choice`, `matching`, `word_search`, `fill_blanks`, `survey_multiple`. Single source: catalog `public/js/core/question-types.js` (UMD, shared by server and clients; survey / random points / Trivial flags). `__tests__/question-types.contract.test.js` fails if DB CHECK, Joi, editor picker, Trivial SQL guard or player screens disagree with it. Adding a type: see `docs/QUESTION_TYPES.md`.

Three content/game types at DB and socket layer: `bank` (question bank — sequential or shuffled), `custom` (hand-picked question set), `trivial` (Trivial Pursuit board mode).

### Feature docs

Read the feature's doc before touching it. Rules that apply outside the feature stay in this file.
- `docs/QUESTION_TYPES.md` — `hotspot` («Toca la imagen»: polygon area in 0-1 coordinates, rules in `public/js/core/hotspot-area.js`; the area never reaches phones before the reveal), `fill_blanks` (rules in `public/js/core/fill-blanks-text.js`, shared by server and every client), `survey_multiple` and the single `survey` results list. Trivial never picks `survey_multiple` (literal SQL guard, no interpolation).
- `docs/FREE_SLIDES.md` — video slides (legacy type), free `canvas` slides (1920×1080 model, render, editor), `.xiroslide` export/import (SSRF-guarded downloads, svg-guard) and shared library. `__tests__/slide-types.contract.test.js` fails if a slide dispatch point forgets `'canvas'`.
- `omit/SLIDE_TABLES_CHARTS.md` — `table` and `chart` elements of free slides: a chart reads its numbers from a table of the same canvas (hidden or not); `hidden` elements never reach screens or PDF, except tables feeding a chart; «Sin datos» labels per surface; `.xiroslide` `formatVersion` 6.
- `omit/SLIDE_THEMES.md` — themes (palette, fonts, 6 accents) and master layouts of free slides: `role` on elements and `layout` on the canvas; applying a theme rewrites resolved values and keeps unroled elements readable; whole-game and per-slide apply with their own undo; `slide_theme` on custom games; AI slides carry roles; `.xiroslide` `formatVersion` 7.
- `docs/HOWTO_SLIDES.md` — `howto` instruction slides: hardcoded voiced animation, DB only stores a topic from a closed list (`HowToSlideValidator`), never user HTML. Presenter with audio, TV without, players get a notice.
- `docs/AI_CANVAS_SLIDES.md` — `POST /api/ai-generator/canvas-slides`: AI only fills 15 layouts, server places elements; images (attached, URL, Wikimedia Commons); steps to add a layout.
- `docs/BANK_JSON_MEDIA.md` — JSON de bancos, formato 2: todas las imágenes y audios (portada, recurso, enunciado, opciones) en la tabla `media`, referenciados como `media:<clave>`; `POST /api/upload/bank-media` binario. Si cambia el formato: `public/data/schema.json` y el prompt de la IA externa (10 idiomas).
- `docs/EMOJI_REACTIONS.md` — anonymous, never stored or scored, travel only as catalog ids, never free text; when allowed: `domain/services/ReactionPolicy.js`.
- `docs/PLAYER_AVATARS.md` — avatar beside name, never inside: mark with `data-avatar-of`, `core/avatar-chips.js` inserts `<img>`. Never build `<img>` strings from a nickname.
- `docs/SLIDE_NAVIGATION.md` — back/forward in custom games only; review mode until `game.maxShownIndex` never replays, rescores or touches per-question Redis counters.
- `docs/XIRO_SKILL.md` — skill `/xiro` de Codex (genera `.xiroslide`): copia en `skills/xiro/`, instalación con `skills/install.sh`. Si cambia el formato de diapositivas libres: `sync-xiro.mjs` + `selftest --xiro app` + reinstalar.
- `docs/SECRETS.md` — passwords and keys generated on first start (volume `xiro_secrets`, `*_FILE` variables, never rotated, `.env` values adopted). Never put secrets back in `.env.example`; a direct env var always beats its `_FILE`.
- `docs/UPDATES.md` — one-click updates through `updater` container (`UPDATER_TOKEN`, rollback by re-tagging).
- `docs/METRICS.md` — `/metrics` only when `METRICS_PORT` set, internal network. No Prometheus/Grafana stack; never expose `/metrics` through Caddy or a published port; never a label whose values come from the client.
- `docs/PODIUM_3D.md` — three.js 3D podium, presenter only, loaded with `import()`; classic rows on any failure.
- `docs/PLAYER_TIMER.md` — informative timer pill on player phones; presenter countdown is the source of truth (`presenter-timer-sync` anchors in server time, `clock-sync` offset). Never decides question closing.
- `docs/GAME_MUSIC.md` — Tone.js music, presenter only (plus admin «Música» preview); never on player, TV or standalone. Admin «Música» settings are binding. Never pause on `visibilitychange`/blur. CSP needs `worker-src 'self' blob:`. Tests: `npm test -- --testPathPattern=public/js/audio`.

### Key data flow

1. Socket event arrives → `socket.handlers.js` → handler factory → **Chain of Responsibility** (validation → rate-limit → idempotency → command/use-case execution)
2. Use case executes, mutates `globalState` Maps, emits **domain events** via `EventBus`
3. Domain event handlers (e.g. `RankingCacheHandler`, `PlayerScoredHandler`) react async
4. Socket responses broadcast via `io.to(room).emit(…)` — Redis adapter ensures all workers receive
5. Cross-worker sync (remote control, answer reveal state) goes through `RedisSyncBus` (pub/sub, not adapter)

### Global state vs Redis

- **In-process Maps** (`globalState.js`): `activeGames`, `players`, `socketToPlayer`, `lobbyPlayers`, `teamConfigs`, `timerPausedState`. Per-worker; consistency kept through Redis pub/sub.
- **Redis**: Socket.IO adapter rooms, session persistence (TTL 6h for reconnection), idempotency keys, ranking cache, rate limit counters, remote control state.
- **Per-worker DB caches** (`pinCache`, `questionBankCache`): public `invalidate*` / `clear` methods clear locally and broadcast on Redis channel `cache-invalidate` (`services/cache-invalidation-bus.js`, attached by `RedisSyncBus`). Other workers run matching `<op>Local` method, which never re-broadcasts. Use `*Local` variants only for worker-local cleanup (e.g. `destroy`).

### Session IDs

`activeGames` keyed by **sessionId** (`PIN-XXXX`, 4 random digits; see `sessionIdSchema`), not PIN. Allows multiple concurrent sessions of same game bank. Each game object also carries `game.pin` for reference.

## Testing

**Where tests live**
- Tests local only. `.gitignore` excludes `**/__tests__/` and `**/jest.setup.js` on purpose: write and run normally, but never `git add -f` them or change `.gitignore` to publish them.
- Tests in `__tests__/` dirs co-located with tested code, plus `app/__tests__/` for integration/E2E. Shared helpers and fixtures in `__tests__/helpers/` (Jest ignores that path as test).
- Integration socket tests use helpers in `app/__tests__/helpers/socket-test-utils.js`.
- `app/config/__mocks__/logger.js` provides silent logger mock; tests opt in with `jest.mock('<relative path>/config/logger')`.
- `app/__mocks__/puppeteer-core.js` replaces puppeteer-core in every test automatically: v25 is ESM-only and Jest (CommonJS) cannot load it. Production loads real package through Node 24's `require()` of ES modules.

**Running them**
- Run relevant tests before every commit; all must pass. Before running, ensure no `._*` Apple Double files exist (`npm run test:clean` handles this).
- Only coverage thresholds are in `app/package.json`: branches 72%, functions/lines/statements 85%. Coverage must not go down.
- Never hide failure by raising timeout. Fix flaky test right away.

**Writing them**
- Test behavior through public interface, not implementation details or private methods; test must fail if covered code deleted.
- One behavior per test, descriptive name. Tests independent: no shared mutable state, no order dependency.
- Mock at boundaries (DB, Redis, HTTP, filesystem, clock, randomness), never unit under test. Prefer fakes for complex interfaces.
- Prefer asserting outputs over counting mock calls, unless count is the behavior (idempotency, debounce, batching).
- Parameterize with `it.each` instead of copy-pasting tests.

## Environment

Copy `.env.example` to `.env`. Secrets (`DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` ≥32 chars, `UPDATER_TOKEN`) are not typed by hand: the `secrets` service (`app/scripts/generate-secrets.js`) creates them on first start in volume `xiro_secrets`; see `docs/SECRETS.md`. Vars you do set: `DB_USER`/`DB_NAME`/`DB_PORT`, `CORS_ORIGIN`, `ALLOWED_ORIGINS`, `SERVER_HOST`. AI provider settings (Groq and Gemini API keys, Ollama URL and model) set from admin panel, stored in `app/ai-generator/groq-key.json`, not `.env`; see `docs/AI_SETUP.md`.

PostgreSQL on port **5439** (non-standard, configured in docker-compose).

Maintenance mode: set `MAINTENANCE_MODE=true` in env, or create `.maintenance.lock` in project root.

## Docs

Extended pattern docs in `docs/`:
- `ARCHITECTURE.md` — layer overview
- `CQRS_PATTERN.md`, `EVENT_DRIVEN_PATTERN.md`, `CHAIN_OF_RESPONSIBILITY_PATTERN.md`
- `ACK_MANAGER_INTEGRATION.md`, `MIGRATION_SCORING_STRATEGIES_GUIDE.md`
- `AI_SETUP.md` — AI providers (Groq, Gemini, Ollama)
- `CSS_GUIDE.md` — frontend CSS workflow
- `MANUAL_MANTENIMIENTO_RAPIDO.md` — quick operational runbook
- Feature docs (question types, slides, AI slides, reactions, avatars, navigation, updates, metrics, podium, music): see *Feature docs* under Architecture

`xiro-chrome-extension/` — companion Chrome extension (separate project, own README).

## graphify

Knowledge graph at app/graphify-out/ with god nodes, community structure, cross-file relationships. Covers `app/` only; paths inside relative to `app/`.

Rules:
- Codebase questions: first run `graphify query "<question>"` from `app/` when app/graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts. Return scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If app/graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read app/graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain don't surface enough context.
- After modifying code, remind user to run `graphify update .` from `app/` on their Mac to keep graph current (AST-only, no API cost). Never run from NAS.

## Performance rules

- Load heavy features on demand with dynamic `import()`, like three.js (podium) and Tone.js (music). Never add to bundles that don't use them.
- Debounce input handlers (search, resize, scroll). Use `requestAnimationFrame` for visual updates, not `setTimeout`.
- Avoid layout shifts: give images and dynamic content explicit dimensions; lazy-load images below fold.
- Send only fields each client needs (see payload sanitizer). Responses already go through `compression`.
- Before adding cache, decide invalidation. Per-worker caches must broadcast on `cache-invalidate` (see *Global state vs Redis*); shared state goes in Redis.
- Every outgoing request has timeout (e.g. image downloads: 10 s).
- Measure before optimizing; don't optimize on intuition.

## Security rules

- Never hardcode secrets. They go in `.env` or admin-managed files (`app/ai-generator/groq-key.json`), and those files stay in `.gitignore`. Rotate any committed secret.
- Validate all external input at boundary (routes, socket events, uploads) with Joi schemas: lengths, types, allowed values. Check uploaded files by bytes, not declared type. Where code sanitises on purpose (`normalizeCanvas`, AI `spec.js`), keep it; elsewhere reject invalid input.
- Escape user data before rendering in HTML or writing to logs. SQL always parameterized; never interpolate values.
- Passwords hashed with scrypt (`services/auth/password-hasher.js`). Auth endpoints use `loginLimiter`.
- Check authorization on every request on server, not only in UI (admin vs editor, `resource-ownership.service.js`).
- Admin cookie HttpOnly, SameSite=Lax, Secure in production. Plain HTTP on LAN must keep working.
- CSP and security headers in `middlewares/security.js`; CORS uses explicit `CORS_ORIGIN`, never wildcard.
- Review new dependency (maintenance, size, license) before adding, run `npm audit`.

## Database rules

- Select only needed columns; batch inserts and updates instead of looping.
- Avoid N+1 queries: use `JOIN`s or batch queries for parent-child data.
- Index columns used in `WHERE`, `JOIN` and `ORDER BY`, and foreign keys. Use composite or partial indexes when query calls for them.
- Use DB constraints (NOT NULL, UNIQUE, CHECK, FK) as source of truth for data integrity.
- Migrations = forward-only SQL files created with `npm run migrate:create` (`YYYYMMDDNNNNNN_description.sql`). Never edit applied migration; add new one. On large tables: add column, backfill, then add constraint.
- Always use shared pool (`config/database.js`), which sets connection and statement timeouts; never open connection per request.
- Keep transactions short, never hold open during I/O.
