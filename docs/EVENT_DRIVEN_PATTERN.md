# Event-Driven Architecture - Arquitectura Basada en Eventos

**Proyecto**: Xiro!
**Patrón**: Event-Driven Architecture
**Código**: `app/domain/events/`

---

## 📖 Concepto

Arquitectura donde los componentes se comunican mediante **eventos** en lugar de llamadas directas, logrando **desacoplamiento** entre la lógica de negocio (Commands/Use Cases) y los efectos secundarios (broadcasts por socket, persistencia, cache, logging).

### Ventajas
- ✅ **Desacoplamiento**: Emisores no conocen a los receptores
- ✅ **Extensibilidad**: Agregar handlers sin modificar emisores
- ✅ **Prioridad configurable**: Orden de ejecución explícito entre handlers
- ✅ **Auditabilidad**: Métricas de eventos emitidos/errores incorporadas
- ✅ **Testing**: Mock fácil de EventBus

---

## 🏗️ Implementación en Xiro!

### Estructura real

```
app/domain/events/
├── DomainEvent.js            # Clase base de todos los eventos de dominio
├── EventBus.js                # Pub/Sub con wildcards, prioridades, métricas (singleton)
├── GameEvents.js              # Las 14 clases de eventos del ciclo de vida del juego
└── handlers/
    ├── EventHandler.js                # Clase base para handlers (subscribe/unregister/log)
    ├── GameStartedHandler.js          # game.started
    ├── QuestionRevealedHandler.js     # question.revealed (+ emite timer.started)
    ├── PlayerScoredHandler.js         # player.scored
    ├── GameEndedHandler.js            # game.ended
    ├── RankingCacheHandler.js         # player.scored, game.ended (cache de ranking)
    ├── bootstrap.js                   # initializeEventHandlers() / cleanupEventHandlers()
    └── index.js                       # registerAllHandlers() / unregisterAllHandlers()
```

> No existen `PlayerEvents.js` ni `PresenterEvents.js`: **todos** los eventos de dominio
> viven en `GameEvents.js`. Tampoco existe un evento `question.started`/`question.ended`
> separado — la pregunta se revela vía `question.revealed`, que internamente emite
> `timer.started`.

---

## 🚌 EventBus - Sistema Pub/Sub

```javascript
// app/domain/events/EventBus.js (resumen)
class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // clusters con muchos listeners
        this.metrics = { emitted: new Map(), handled: new Map(), errors: new Map() };
        this.handlers = new Map(); // eventName -> [{ handler, priority }]
    }

    // priority: mayor = se ejecuta primero. Retorna función de unsubscribe.
    on(eventName, handler, priority = 0) { /* ... */ }

    once(eventName, handler, priority = 0) { /* ... */ }

    off(eventName, handler) { /* ... */ }

    // Soporta wildcards: 'game.*' escucha 'game.started', '**' escucha todo.
    // Atrapa errores por handler (un handler roto no detiene a los demás).
    emit(eventName, event) { /* ... */ }

    // No bloquea: usa setImmediate
    emitAsync(eventName, event) { /* ... */ }

    getMetrics() { /* emitted / errors / activeListeners */ }
}

module.exports = new EventBus(); // singleton
```

Diferencias clave frente a un `EventEmitter` plano:
- **Prioridad por handler**: los suscritos con mayor `priority` se ejecutan antes.
- **Wildcards**: `'game.*'` y `'**'`.
- **Aislamiento de errores**: si un handler lanza, se captura, se registra en
  `metrics.errors` y se emite `eventbus.error` (sin recursión infinita); el resto de
  handlers sigue ejecutándose.
- **Métricas incorporadas** vía `getMetrics()` — no hace falta instrumentarlas a mano.

---

## 📦 DomainEvent — Clase base

Todos los eventos de `GameEvents.js` extienden `DomainEvent`, que aporta `eventName`,
`timestamp`, `eventId` único y copia las claves del `payload` al propio objeto evento
(por eso un handler puede leer `event.gameId` o `event.payload.gameId` indistintamente):

```javascript
// app/domain/events/DomainEvent.js (resumen)
class DomainEvent {
    constructor(eventName, payload) {
        this.eventName = eventName;
        this.timestamp = Date.now();
        this.eventId = `${eventName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.payload = payload;
        Object.keys(payload || {}).forEach(key => {
            if (this[key] === undefined) this[key] = payload[key];
        });
    }
}
```

---

## 📢 Catálogo Real de Eventos (`GameEvents.js`)

| Evento | Clase | Payload principal |
|--------|-------|--------------------|
| `game.started` | `GameStartedEvent` | gameId, pin, mode, questionCount, playerCount |
| `question.revealed` | `QuestionRevealedEvent` | roomId, question, questionIndex, timeLimit, totalQuestions, showAnswersToPlayers |
| `answer.submitted` | `AnswerSubmittedEvent` | gameId, playerId, nickname, questionIndex, answerIndex, isCorrect, timeElapsed |
| `player.scored` | `PlayerScoredEvent` | gameId, playerId, nickname, pointsEarned, totalScore, isCorrect, scoringDetails |
| `answer.revealed` | `AnswerRevealedEvent` | gameId, questionIndex, correctIndex, stats |
| `game.ended` | `GameEndedEvent` | roomId, ranking/finalRanking, totalQuestions, duration, stats, reason |
| `player.joined` | `PlayerJoinedEvent` | gameId, playerId, nickname, playerCount |
| `player.disconnected` | `PlayerDisconnectedEvent` | gameId, playerId, nickname, reason |
| `timer.started` | `TimerStartedEvent` | gameId, questionIndex, timeLimit |
| `timer.expired` | `TimeExpiredEvent` | gameId, questionIndex, answeredCount, totalPlayers |
| `player.streak.achieved` | `PlayerStreakAchievedEvent` | gameId, playerId, nickname, streakCount, bonusPercentage |
| `team.streak.achieved` | `TeamStreakAchievedEvent` | gameId, teamName, streakCount, bonusPercentage, playerCount |
| `bet.placed` | `BetPlacedEvent` | gameId, playerId, nickname, questionIndex, betAmount, currentScore |
| `bets.all_placed` | `AllBetsPlacedEvent` | gameId, questionIndex, betCount, totalBetAmount |

> No existen eventos `error.occurred` ni `player.reconnected` como clases de dominio.
> La reconexión se maneja en `application/use-cases/ReconnectPlayerUseCase.js` sin pasar
> por un `DomainEvent` dedicado.

---

## 🛠️ EventHandler — Clase base de los handlers

Los handlers **no** se registran como callbacks sueltos (`EventBus.on(...)` disperso por
el código): cada handler es una clase que extiende `EventHandler`, implementa
`register()` y usa `this.subscribe(eventName, fn, priority)`:

```javascript
// app/domain/events/handlers/EventHandler.js (resumen)
class EventHandler {
    constructor(eventBus, io, dependencies = {}) {
        this.eventBus = eventBus;
        this.io = io;
        this.dependencies = dependencies;
        this.subscriptions = [];
    }

    register() { throw new Error('register() must be implemented by subclass'); }

    unregister() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
    }

    subscribe(eventName, handler, priority = 5) {
        const unsubscribe = this.eventBus.on(eventName, handler, priority);
        this.subscriptions.push(unsubscribe);
        return unsubscribe;
    }

    log(level, message, data = {}) { /* usa dependencies.logger o el logger global */ }
}
```

---

## 🧩 Handlers Reales (`domain/events/handlers/`)

| Handler | Escucha | Prioridad | Responsabilidad |
|---------|---------|-----------|------------------|
| `GameStartedHandler` | `game.started` | 8 | Solo logging — la emisión real a sockets la hace `StartGameHandler` (capa de sockets), que tiene acceso al `gameState` completo. También expone `notifyPlayers()`/`notifyPresenter()` (con soporte AckManager, ver `ACK_MANAGER_INTEGRATION.md`) |
| `QuestionRevealedHandler` | `question.revealed` | 8 | Sanitiza la pregunta para jugadores (`sanitizeQuestionForPlayers`), emite `new-question` a jugadores y presentador vía Redis adapter, y emite `timer.started` |
| `PlayerScoredHandler` | `player.scored` | 7 | Recalcula ranking y lo emite con `BroadcastOptimizer` (debounce ~100ms) a `:presenter` y `:players`; persiste el score en background; expone `forceBroadcastRanking()` para flush inmediato |
| `GameEndedHandler` | `game.ended` | 9 | Emite `game-ended` (ranking) a jugadores/presentador, persiste stats finales, limpia timers/cache/state machine, y emite `game.cleanup.completed` |
| `RankingCacheHandler` | `player.scored`, `game.ended` | (default) | Mantiene un caché incremental de ranking (`services/RankingCache.js`) y lo invalida al terminar el juego |
| `CacheInvalidationService` | (ver `services/CacheInvalidationService.js`) | — | Registrado junto al resto de handlers en `registerAllHandlers()`, sigue el mismo contrato `register()`/`unregister()` |

Registro centralizado en `domain/events/handlers/index.js` →
`registerAllHandlers(eventBus, io, dependencies)`, invocado desde
`domain/events/handlers/bootstrap.js` → `initializeEventHandlers(io, dependencies)`
durante el arranque del servidor. El cleanup simétrico es
`cleanupEventHandlers()` → `unregisterAllHandlers()`.

---

## 🔄 Flujo de Eventos Real: Jugador Envía Respuesta

```
1. Cliente → Socket.IO: emit('submit-answer', data)
   ↓
2. SubmitAnswerHandler (sockets/handlers) recibe el evento de socket
   ↓
3. SubmitAnswerUseCase ejecuta la Chain of Responsibility
   (Idempotency → RateLimit → Validation → CommandExecution → Response)
   ↓
4. ImprovedSubmitAnswerCommand.execute() actualiza el estado y, vía las
   estrategias de modo de juego (IndividualGameMode/TeamGameMode), emite
   directamente 'answer-result' al jugador (no siempre pasa por EventBus)
   ↓
5. EventBus.emit('player.scored', new PlayerScoredEvent({...}))
   ↓
6. Handlers reaccionan (por prioridad):
   - PlayerScoredHandler (7): recalcula y broadcastea ranking (debounced)
   - RankingCacheHandler: actualiza caché incremental de ranking
```

> A diferencia de lo que sugeriría un diseño "puro" event-driven, el resultado
> individual de la respuesta (`answer-result`) se emite **directamente** desde las
> estrategias de juego, no a través de un evento de dominio — el EventBus se usa para
> los efectos secundarios derivados (ranking, cache, persistencia), no para cada emisión
> de socket. Ver `ARCHITECTURE.md` y `CHAIN_OF_RESPONSIBILITY_PATTERN.md`.

---

## 🎯 Registro de Handlers en la Inicialización Real

```javascript
// domain/events/handlers/bootstrap.js, invocado durante el startup
const { initializeEventHandlers } = require('./domain/events/handlers/bootstrap');

initializeEventHandlers(io, {
    activeGames,      // Map global
    db,               // servicio de persistencia (opcional)
    broadcastOptimizer,
    logger
});
```

```javascript
// domain/events/handlers/index.js (resumen real)
function registerAllHandlers(eventBus, io, dependencies = {}) {
    const handlers = [
        new GameStartedHandler(eventBus, io, dependencies),
        new QuestionRevealedHandler(eventBus, io, dependencies),
        new PlayerScoredHandler(eventBus, io, dependencies),
        new GameEndedHandler(eventBus, io, dependencies),
        new RankingCacheHandler(eventBus, io, dependencies),
        new CacheInvalidationService(eventBus, io, dependencies)
    ];
    handlers.forEach(h => h.register());
    return handlers;
}
```

---

## ✅ Mejores Prácticas (aplicadas en el código real)

### Emitir Eventos
1. Emitir solo después de mutar el estado con éxito (ver `ImprovedSubmitAnswerCommand`).
2. El payload debe bastar para que el handler no necesite volver a consultar estado
   (aunque varios handlers sí leen `activeGames` para enriquecer el contexto).
3. Usar la convención `entity.action` (`game.started`, `player.scored`...).
4. Las clases `DomainEvent` ya añaden `timestamp` y `eventId` automáticamente.

### Escuchar Eventos
1. Los handlers son clases con `register()`/`unregister()` explícitos, no listeners sueltos.
2. `EventBus.emit()` ya aísla errores por handler — no es necesario un `try/catch`
   global, pero cada handler igualmente captura sus propios errores para loguearlos con
   contexto (`roomId`, `playerId`, etc.).
3. La prioridad (`subscribe(event, fn, priority)`) determina el orden cuando varios
   handlers escuchan el mismo evento (p. ej. `GameEndedHandler` con prioridad 9 antes
   que otros handlers de menor prioridad sobre `game.ended`).

---

## 🧪 Testing

Los tests reales están co-localizados en `domain/events/__tests__/` (EventBus, DomainEvent)
y `domain/events/handlers/__tests__/` (uno por handler).

```javascript
// Ejemplo de test de EventBus (estructura real)
describe('EventBus', () => {
    it('ejecuta handlers en orden de prioridad', () => {
        const order = [];
        EventBus.on('test.event', () => order.push('low'), 1);
        EventBus.on('test.event', () => order.push('high'), 10);

        EventBus.emit('test.event', {});

        expect(order).toEqual(['high', 'low']);
    });

    it('aísla errores: un handler roto no bloquea a los demás', () => {
        const spy = jest.fn();
        EventBus.on('test.event', () => { throw new Error('boom'); });
        EventBus.on('test.event', spy);

        EventBus.emit('test.event', {});

        expect(spy).toHaveBeenCalled();
    });
});
```

```javascript
// Ejemplo de test de handler (estructura real, ver PlayerScoredHandler.test.js)
describe('PlayerScoredHandler', () => {
    it('recalcula y broadcastea el ranking al recibir player.scored', async () => {
        const handler = new PlayerScoredHandler(mockEventBus, mockIo, { activeGames });
        handler.register();

        await mockEventBus.emit('player.scored', new PlayerScoredEvent({
            gameId: 'room1', playerId: 'p1', nickname: 'Ana', totalScore: 100
        }));

        expect(mockBroadcastOptimizer.emit).toHaveBeenCalledWith(
            'ranking-update', 'room1', expect.any(Object), 'room1:presenter'
        );
    });
});
```

---

## Referencias

- Código: `app/domain/events/` (EventBus, DomainEvent, GameEvents) y `app/domain/events/handlers/`
- Registro/bootstrap: `app/domain/events/handlers/bootstrap.js`, `index.js`
- Relación con la cadena de procesamiento de respuestas: `docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md`
- Entrega garantizada de eventos críticos por socket: `docs/ACK_MANAGER_INTEGRATION.md`
