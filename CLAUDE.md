# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Xiro!

Xiro! is a self-hosted real-time quiz platform (Kahoot-style). A presenter controls the game flow; players join via QR/PIN on their phones. Supports 6 question types, 4 game modes, team play, AI question generation via Groq, and a Trivial Pursuit-style board mode.

## Important
Cuando se editen ficheros, intentar que no superen las 200 líneas de código efectivo.

`app/public/clientes.html` no forma parte del sistema de juego (es un dashboard interno aparte). Excluirlo siempre de auditorías de diseño/accesibilidad (`/impeccable audit` u otras) y de cualquier pase de fixes de UI, salvo que el usuario lo pida explícitamente para ese fichero en concreto.

## Commands

All application commands run from `app/`:

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

CSS (Tailwind, from repo root — must rebuild after editing `input-*.css` or adding new Tailwind classes):
```bash
npm run build:css        # compile all CSS bundles (minified)
npm run watch:css        # watch mode for all bundles in parallel
npm run build:css:admin  # compile a single bundle (admin|player|presenter|common|index)
```
> Do **not** edit the compiled output files (`common.css`, `output-*.css`) directly — they are overwritten on every build.

Load testing (from `app/`):
```bash
npm run load-test               # main scenario
npm run load-test:join          # lobby join
npm run load-test:answers       # answer submission
npm run load-test:reconnect     # reconnection
```

## Architecture

The app runs as a **PM2 cluster** (4 workers) behind Nginx on Synology NAS. All workers share state through **Redis**; PostgreSQL is the persistent store. Socket.IO uses the Redis adapter so rooms and events work across workers.

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
  queries/       # CQRS read side (GetGameState, GetRanking, GetPlayerStats, GetActiveSessions)
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
ai-generator/    # Groq LLM integration: prompt building, schema validation, question-type parsers
public/          # Static frontend: vanilla JS, Tailwind CSS (compiled; edit input-*.css, not output-*.css)
  js/player/     # Player client
  js/presenter/  # Presenter client
  js/admin/      # Admin panel
  js/tv/         # TV/spectator view
  ppt-addin/     # PowerPoint Office Add-in
```

### Question types and content types

Six question types (defined in `config/game-constants.js` → `QUESTION_TYPES`): `multiple`, `quiz`, `survey`, `true_false`, `order`, `word_scramble`.

Three content/game types used at the DB and socket layer: `bank` (question bank — sequential or shuffled), `custom` (hand-picked question set), `trivial` (Trivial Pursuit board mode).

### Key data flow

1. Socket event arrives → `socket.handlers.js` → handler factory → **Chain of Responsibility** (validation → rate-limit → idempotency → command/use-case execution)
2. Use case executes, mutates `globalState` Maps, emits **domain events** via `EventBus`
3. Domain event handlers (e.g. `RankingCacheHandler`, `PlayerScoredHandler`) react asynchronously
4. Socket responses are broadcast via `io.to(room).emit(…)` — Redis adapter ensures all workers receive them
5. Cross-worker sync (remote control, answer reveal state) goes through `RedisSyncBus` (pub/sub, not the adapter)

### Global state vs Redis

- **In-process Maps** (`globalState.js`): `activeGames`, `players`, `socketToPlayer`, `lobbyPlayers`, `teamConfigs`, `timerPausedState`. These are per-worker; consistency is maintained through Redis pub/sub.
- **Redis**: Socket.IO adapter rooms, session persistence (TTL 6h for reconnection), idempotency keys, ranking cache, rate limit counters, remote control state.

### Session IDs

`activeGames` is keyed by **sessionId** (`PIN-UUID`), not PIN. This allows multiple concurrent sessions of the same game bank. Each game object also carries `game.pin` for reference.

## Testing conventions

- Tests live in `__tests__/` directories co-located with the code they test, plus `app/__tests__/` for integration/E2E.
- Jest coverage thresholds: branches 72%, functions/lines/statements 85%.
- Integration socket tests use the helpers in `app/__tests__/helpers/socket-test-utils.js`.
- `app/config/__mocks__/logger.js` provides a silent logger mock — Jest picks it up automatically via `moduleNameMapper` conventions.
- Before running tests locally, ensure no `._*` Apple Double files exist (`npm run test:clean` handles this).

## Environment

Copy `.env.example` to `.env`. Required vars: `JWT_SECRET` (≥32 chars), `DB_*`, `REDIS_PASSWORD`, `ADMIN_PASSWORD`, `EDITOR_PASSWORD`, `CORS_ORIGIN`. Groq AI requires `GROQ_API_KEY` (stored in `app/ai-generator/groq-key.json`, not the env file).

PostgreSQL runs on port **5439** (non-standard, configured in docker-compose).

Maintenance mode: set `MAINTENANCE_MODE=true` in env, or create `.maintenance.lock` in the project root.

## Docs

Extended pattern documentation is in `docs/`:
- `ARCHITECTURE.md` — layer overview
- `CQRS_PATTERN.md`, `EVENT_DRIVEN_PATTERN.md`, `CHAIN_OF_RESPONSIBILITY_PATTERN.md`
- `ACK_MANAGER_INTEGRATION.md`, `MIGRATION_SCORING_STRATEGIES_GUIDE.md`
- `GROQ_SETUP.md`
- `TAILWIND_CSS_GUIA.md`, `CSS_COMPILATION_GUIDE.md` — frontend CSS workflow
- `MANUAL_MANTENIMIENTO_RAPIDO.md` — quick operational runbook

`xiro-chrome-extension/` — companion Chrome extension (separate project, own README).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
