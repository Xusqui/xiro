# Arquitectura de Xiro!

## Vision general

Xiro! es un juego en tiempo real con presentador y jugadores, construido sobre Node.js, Socket.IO y PostgreSQL, con Redis para sincronizacion en modo cluster. La arquitectura busca separacion estricta de responsabilidades y alta resiliencia.

## Capas

- **Domain**: reglas de negocio puras (eventos, estado/state machine, estrategias, servicios de dominio).
- **Application**: orquestacion de casos de uso, comandos y queries (CQRS).
- **Infrastructure**: detalles de integracion (Redis adapter, health, resilience, shutdown).
- **Interface**: rutas HTTP (`routes/`) y handlers de Socket.IO (`sockets/`).

## Patrones clave

- **Clean Architecture**: dependencias hacia adentro.
- **CQRS**: Commands para escritura, Queries para lectura.
- **Event-Driven**: EventBus y handlers de dominio.
- **State Machine**: flujo del juego en estados formales.
- **Strategy**: modos de juego y scoring.
- **Circuit Breaker**: proteccion ante fallos de dependencias.

## Flujo de juego (alto nivel)

1) Presentador crea sesion.
2) Jugadores se unen al lobby.
3) Inicio de juego -> preguntas -> respuestas -> scoring.
4) Resultados y cierre de juego.

Socket.IO es el canal principal de eventos, con Redis adapter para sincronizar rooms entre workers.

## Componentes principales

- **Socket manager**: inicializa Socket.IO y el Redis adapter.
- **Use cases** (`application/use-cases/`): StartGame, JoinGame, SubmitAnswer, AdvanceQuestion, EndGame, ReconnectPlayer.
- **Commands / Queries** (CQRS): escritura (ImprovedStartGame, ImprovedSubmitAnswer, JoinGame) y lectura (GetGameState, GetRanking, GetPlayerStats, GetActiveSessions).
- **Servicios de dominio**: scoring, estado de respuestas, ranking.
- **State machine**: fuente de verdad para `canAnswer` y `currentIndex`.

## Persistencia y cache

- **PostgreSQL**: juegos, preguntas, configuracion y datos persistentes.
- **Redis**: cache, sincronizacion y estado de sesiones.

## Observabilidad y resiliencia

- Health checks: `/live`, `/ready`, `/api/health`.
- Graceful shutdown con notificacion a clientes.
- Circuit breaker para DB.

## Estructura de carpetas (alto nivel)

```
app/
  application/      # CQRS (commands/queries), use cases, chain de middleware
  domain/           # eventos, estado (state machine), estrategias, servicios de dominio
  infrastructure/   # health, resilience (circuit breaker), shutdown
  routes/           # rutas HTTP (Express)
  middlewares/      # seguridad, auth, errores, rate limit, mantenimiento
  sockets/          # Socket.IO (manager, handlers, services, sync, utils)
  services/         # servicios transversales (DB, PDF, timer, pin-cache...)
  config/           # constantes, logger, redis, database, runtime/ui config
  ai-generator/     # integracion Groq (generacion de preguntas)
  migrations/       # migraciones SQL + runner
  state/            # estado global en proceso (globalState.js)
```

> Para el detalle completo de subcarpetas, ver `CLAUDE.md` en la raiz del repositorio.

## Referencias internas

- CQRS y application: `app/application/README.md`
- Handlers Socket.IO: `app/sockets/handlers/README.md`
- Patrones extendidos: `docs/CQRS_PATTERN.md`, `docs/EVENT_DRIVEN_PATTERN.md`, `docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md`
