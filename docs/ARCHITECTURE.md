# Arquitectura de Xiro!

## Vision general

Xiro! es un juego en tiempo real con presentador y jugadores, construido sobre Node.js, Socket.IO y PostgreSQL, con Redis para sincronizacion en modo cluster. La arquitectura busca separacion estricta de responsabilidades y alta resiliencia.

## Capas

- **Domain**: reglas de negocio puras (eventos, estrategias, servicios de dominio).
- **Application**: orquestacion de casos de uso, comandos y queries (CQRS).
- **Infrastructure**: detalles de integracion (DB, Redis, sockets, health, shutdown).
- **Interface**: rutas HTTP y handlers de Socket.IO.

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
- **Use cases**: StartGame, JoinGame, SubmitAnswer, NextQuestion, EndGame.
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
  application/      # CQRS y use cases
  domain/           # eventos, estado, estrategias
  infrastructure/   # health, resilience, shutdown
  routes/           # HTTP
  sockets/          # Socket.IO
  services/         # servicios transversales
  state/            # estado global
```

## Referencias internas

- CQRS: app/application/README.md
- Handlers Socket.IO: app/sockets/handlers/README.md
