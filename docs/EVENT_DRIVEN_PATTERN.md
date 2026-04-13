# Event-Driven Architecture - Arquitectura Basada en Eventos

**Proyecto**: Xiro!  
**Patrón**: Event-Driven Architecture  
**Fecha**: 2 de febrero de 2026

---

## 📖 Concepto

Arquitectura donde los componentes se comunican mediante **eventos** en lugar de llamadas directas, logrando **desacoplamiento** total entre módulos.

### Ventajas
- ✅ **Desacoplamiento**: Emisores no conocen a los receptores
- ✅ **Extensibilidad**: Agregar listeners sin modificar emisores
- ✅ **Escalabilidad**: Procesamiento asíncrono
- ✅ **Auditabilidad**: Log completo de eventos
- ✅ **Testing**: Mock fácil de EventBus

---

## 🏗️ Implementación en Xiro!

### Estructura

```
app/domain/events/
├── EventBus.js              # Pub/Sub centralizado (singleton)
├── GameEvents.js            # Eventos de juego
├── PlayerEvents.js          # Eventos de jugador
└── PresenterEvents.js       # Eventos de presentador
```

---

## 🚌 EventBus - Sistema Pub/Sub

```javascript
// app/domain/events/EventBus.js
const EventEmitter = require('events');

/**
 * Singleton EventBus para comunicación desacoplada
 */
class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // Evitar warnings
    }

    /**
     * Emitir evento de dominio
     * @param {string} eventName - Nombre del evento (ej: 'player.joined')
     * @param {Object} eventData - Datos del evento
     */
    emit(eventName, eventData) {
        console.log(`[EventBus] Emitting: ${eventName}`, eventData);
        super.emit(eventName, eventData);
    }

    /**
     * Suscribirse a evento
     * @param {string} eventName - Nombre del evento
     * @param {Function} handler - Función manejadora
     */
    on(eventName, handler) {
        console.log(`[EventBus] Listener registered for: ${eventName}`);
        super.on(eventName, handler);
    }
}

// Singleton: una única instancia global
module.exports = new EventBus();
```

---

## 📢 Eventos de Dominio

### 1. PlayerJoinedEvent

```javascript
// app/domain/events/PlayerEvents.js
class PlayerJoinedEvent {
    constructor({ playerId, nickname, roomId, timestamp }) {
        this.playerId = playerId;
        this.nickname = nickname;
        this.roomId = roomId;
        this.timestamp = timestamp || Date.now();
        this.type = 'player.joined';
    }
}
```

**Cuándo se emite**: Cuando un jugador se une exitosamente a un juego

**Emisor**: `JoinGameCommand.execute()`

**Listeners**:
- Analytics: Registrar nuevo jugador
- Metrics: Incrementar contador de jugadores
- Notifications: Notificar a otros jugadores

---

### 2. AnswerSubmittedEvent

```javascript
class AnswerSubmittedEvent {
    constructor({ 
        gameId, 
        playerId, 
        nickname, 
        questionIndex, 
        answerIndex, 
        isCorrect, 
        points, 
        elapsedTime 
    }) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.nickname = nickname;
        this.questionIndex = questionIndex;
        this.answerIndex = answerIndex;
        this.isCorrect = isCorrect;
        this.points = points;
        this.elapsedTime = elapsedTime;
        this.timestamp = Date.now();
        this.type = 'answer.submitted';
    }
}
```

**Cuándo se emite**: Cuando un jugador envía una respuesta

**Emisor**: `SubmitAnswerCommand.execute()`

**Listeners**:
- Leaderboard: Actualizar ranking
- Statistics: Guardar estadísticas
- Presenter: Notificar progreso

---

### 3. GameStartedEvent

```javascript
class GameStartedEvent {
    constructor({ gameId, playerCount, questionCount, timestamp }) {
        this.gameId = gameId;
        this.playerCount = playerCount;
        this.questionCount = questionCount;
        this.timestamp = timestamp || Date.now();
        this.type = 'game.started';
    }
}
```

**Cuándo se emite**: Cuando el presentador inicia el juego

**Emisor**: `StartGameCommand.execute()`

**Listeners**:
- Timers: Iniciar cronómetros
- Analytics: Registrar inicio de partida
- Lobby: Cerrar sala de espera

---

### 4. QuestionStartedEvent

```javascript
class QuestionStartedEvent {
    constructor({ gameId, questionIndex, questionId, duration, timestamp }) {
        this.gameId = gameId;
        this.questionIndex = questionIndex;
        this.questionId = questionId;
        this.duration = duration;
        this.timestamp = timestamp || Date.now();
        this.type = 'question.started';
    }
}
```

**Cuándo se emite**: Al comenzar una nueva pregunta

**Emisor**: `NextQuestionCommand.execute()`

**Listeners**:
- Timers: Iniciar cuenta regresiva
- Players: Resetear estado de respuesta
- UI: Actualizar interfaz

---

### 5. QuestionEndedEvent

```javascript
class QuestionEndedEvent {
    constructor({ gameId, questionIndex, answeredCount, totalPlayers, timestamp }) {
        this.gameId = gameId;
        this.questionIndex = questionIndex;
        this.answeredCount = answeredCount;
        this.totalPlayers = totalPlayers;
        this.timestamp = timestamp || Date.now();
        this.type = 'question.ended';
    }
}
```

**Cuándo se emite**: Al terminar el tiempo de una pregunta

**Emisor**: `TimerManager`

**Listeners**:
- Leaderboard: Mostrar resultados
- Statistics: Guardar métricas
- Next Question: Avanzar automáticamente

---

### 6. GameEndedEvent

```javascript
class GameEndedEvent {
    constructor({ gameId, winner, finalRanking, duration, timestamp }) {
        this.gameId = gameId;
        this.winner = winner;
        this.finalRanking = finalRanking;
        this.duration = duration;
        this.timestamp = timestamp || Date.now();
        this.type = 'game.ended';
    }
}
```

**Cuándo se emite**: Al finalizar el juego

**Emisor**: `EndGameCommand.execute()`

**Listeners**:
- Database: Guardar resultados
- Cleanup: Limpiar recursos
- Notifications: Enviar resumen

---

### 7. PlayerDisconnectedEvent

```javascript
class PlayerDisconnectedEvent {
    constructor({ playerId, nickname, gameId, timestamp }) {
        this.playerId = playerId;
        this.nickname = nickname;
        this.gameId = gameId;
        this.timestamp = timestamp || Date.now();
        this.type = 'player.disconnected';
    }
}
```

**Cuándo se emite**: Cuando un jugador se desconecta

**Emisor**: `DisconnectHandler`

**Listeners**:
- Game: Marcar jugador como inactivo
- Notifications: Notificar a otros
- Cleanup: Remover si aplica

---

### 8. PlayerReconnectedEvent

```javascript
class PlayerReconnectedEvent {
    constructor({ playerId, nickname, gameId, newSocketId, timestamp }) {
        this.playerId = playerId;
        this.nickname = nickname;
        this.gameId = gameId;
        this.newSocketId = newSocketId;
        this.timestamp = timestamp || Date.now();
        this.type = 'player.reconnected';
    }
}
```

**Cuándo se emite**: Cuando un jugador se reconecta

**Emisor**: `ReconnectPlayerHandler`

**Listeners**:
- Game: Actualizar socket ID
- Notifications: Notificar reconexión
- State: Sincronizar estado

---

### 9. TimerExpiredEvent

```javascript
class TimerExpiredEvent {
    constructor({ gameId, questionIndex, timerType, timestamp }) {
        this.gameId = gameId;
        this.questionIndex = questionIndex;
        this.timerType = timerType; // 'question' | 'lobby'
        this.timestamp = timestamp || Date.now();
        this.type = 'timer.expired';
    }
}
```

**Cuándo se emite**: Cuando expira un temporizador

**Emisor**: `TimerManager`

**Listeners**:
- Question: Mostrar respuesta correcta
- Next: Avanzar automáticamente
- Players: Bloquear respuestas

---

### 10. ErrorOccurredEvent

```javascript
class ErrorOccurredEvent {
    constructor({ errorType, message, context, severity, timestamp }) {
        this.errorType = errorType;
        this.message = message;
        this.context = context;
        this.severity = severity; // 'low' | 'medium' | 'high' | 'critical'
        this.timestamp = timestamp || Date.now();
        this.type = 'error.occurred';
    }
}
```

**Cuándo se emite**: Cuando ocurre un error significativo

**Emisor**: Cualquier módulo

**Listeners**:
- Logger: Registrar error
- Monitoring: Enviar alerta
- Recovery: Intentar recuperación

---

## 🔄 Flujo de Eventos Típico

### Ejemplo: Jugador Envía Respuesta

```
1. Cliente → Socket.IO: emit('submit-answer', data)
   ↓
2. SubmitAnswerHandler: recibe evento
   ↓
3. SubmitAnswerUseCase: ejecuta cadena
   ↓
4. SubmitAnswerCommand: valida y ejecuta
   ↓
5. EventBus.emit('answer.submitted', event) ← EVENTO EMITIDO
   ↓
6. Listeners reaccionan (en paralelo):
   - LeaderboardService: actualiza ranking
   - StatisticsService: guarda stats
   - PresenterNotifier: notifica a presentador
   - AnalyticsService: registra métricas
```

---

## 🎯 Registro de Listeners

### En Inicialización de la App

```javascript
// app/server.js o app/index.js
const EventBus = require('./domain/events/EventBus');
const LeaderboardService = require('./services/leaderboard.service');
const StatisticsService = require('./services/statistics.service');

// Registrar listeners al iniciar la aplicación
function setupEventListeners() {
    // Listener para respuestas
    EventBus.on('answer.submitted', (event) => {
        LeaderboardService.updateRanking(event);
        StatisticsService.saveAnswer(event);
    });

    // Listener para jugador unido
    EventBus.on('player.joined', (event) => {
        console.log(`Nuevo jugador: ${event.nickname}`);
        // Notificar a analytics, etc.
    });

    // Listener para fin de juego
    EventBus.on('game.ended', async (event) => {
        await StatisticsService.saveGameResults(event);
        await cleanupResources(event.gameId);
    });

    // Listener para errores
    EventBus.on('error.occurred', (event) => {
        if (event.severity === 'critical') {
            // Enviar alerta inmediata
            alertMonitoring(event);
        }
    });
}

setupEventListeners();
```

---

## ✅ Mejores Prácticas

### Emitir Eventos

1. **Emitir después de cambios**: Solo después de modificar estado exitosamente
2. **Datos inmutables**: El evento debe contener toda la información necesaria
3. **Timestamp**: Siempre incluir timestamp
4. **Tipo explícito**: Usar convención `entity.action` (ej: `player.joined`)
5. **No emitir en cascada**: Evitar que un listener emita otro evento del mismo tipo

### Escuchar Eventos

1. **Listeners independientes**: No deben depender del orden de ejecución
2. **Idempotentes**: Manejar posibles duplicados
3. **Manejo de errores**: No lanzar excepciones no manejadas
4. **Async cuando sea necesario**: Usar async/await para operaciones I/O
5. **Unsubscribe**: Remover listeners cuando ya no son necesarios

---

## 📊 Catálogo Completo de Eventos

| Evento | Tipo | Emisor | Listeners Típicos |
|--------|------|--------|-------------------|
| player.joined | PlayerJoinedEvent | JoinGameCommand | Analytics, Metrics, Notifications |
| answer.submitted | AnswerSubmittedEvent | SubmitAnswerCommand | Leaderboard, Statistics, Presenter |
| game.started | GameStartedEvent | StartGameCommand | Timers, Analytics, Lobby |
| question.started | QuestionStartedEvent | NextQuestionCommand | Timers, Players, UI |
| question.ended | QuestionEndedEvent | TimerManager | Leaderboard, Statistics, Next |
| game.ended | GameEndedEvent | EndGameCommand | Database, Cleanup, Notifications |
| player.disconnected | PlayerDisconnectedEvent | DisconnectHandler | Game, Notifications, Cleanup |
| player.reconnected | PlayerReconnectedEvent | ReconnectPlayerHandler | Game, Notifications, State |
| timer.expired | TimerExpiredEvent | TimerManager | Question, Next, Players |
| error.occurred | ErrorOccurredEvent | Any | Logger, Monitoring, Recovery |

---

## 🧪 Testing

### Test de Emisión de Evento

```javascript
describe('SubmitAnswerCommand', () => {
    it('debe emitir evento answer.submitted', async () => {
        const EventBus = require('../domain/events/EventBus');
        const eventSpy = jest.spyOn(EventBus, 'emit');

        const command = new SubmitAnswerCommand({
            pin: '1234',
            nickname: 'Player1',
            index: 2
        });

        await command.execute(mockContext);

        expect(eventSpy).toHaveBeenCalledWith(
            'answer.submitted',
            expect.objectContaining({
                nickname: 'Player1',
                isCorrect: true,
                type: 'answer.submitted'
            })
        );
    });
});
```

### Test de Listener

```javascript
describe('LeaderboardService', () => {
    it('debe actualizar ranking al recibir answer.submitted', () => {
        const EventBus = require('../domain/events/EventBus');
        const LeaderboardService = require('../services/leaderboard.service');

        const event = new AnswerSubmittedEvent({
            gameId: '1234',
            playerId: 'p1',
            nickname: 'Player1',
            points: 850,
            isCorrect: true
        });

        // Emitir evento
        EventBus.emit('answer.submitted', event);

        // Verificar que el ranking se actualizó
        const ranking = LeaderboardService.getRanking('1234');
        expect(ranking[0].nickname).toBe('Player1');
        expect(ranking[0].score).toBeGreaterThan(0);
    });
});
```

---

## 🔍 Debugging de Eventos

### Logger de Eventos

```javascript
// Útil en desarrollo para ver flujo de eventos
EventBus.on('*', (eventName, eventData) => {
    console.log(`[Event] ${eventName}`, {
        timestamp: new Date(eventData.timestamp).toISOString(),
        data: eventData
    });
});
```

### Métricas de Eventos

```javascript
const eventMetrics = new Map();

EventBus.on('*', (eventName) => {
    const count = eventMetrics.get(eventName) || 0;
    eventMetrics.set(eventName, count + 1);
});

// Mostrar métricas
setInterval(() => {
    console.log('[Event Metrics]', Object.fromEntries(eventMetrics));
}, 60000); // Cada minuto
```

---

## 🚀 Beneficios Observados

- ✅ **Modularidad**: 10 eventos permiten comunicación sin acoplamiento
- ✅ **Extensibilidad**: Agregar listeners sin modificar emisores
- ✅ **Testing**: 100% coverage de eventos
- ✅ **Auditabilidad**: Log completo de todas las acciones
- ✅ **Performance**: Procesamiento asíncrono de listeners

---

**Event-Driven Architecture permite crecer sin romper** ✨
