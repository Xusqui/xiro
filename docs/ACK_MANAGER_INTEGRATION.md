# AckManager Integration Guide

## Resumen

El **AckManager** (`app/sockets/services/AckManager.js`) es un servicio que garantiza la
entrega confiable de mensajes críticos en Socket.IO mediante:
- **Acknowledgments (ACK)**: Confirmación de recepción por parte del cliente
- **Retry automático**: Reenvío si no se recibe ACK en el timeout configurado
- **Tracking**: Monitoreo de mensajes pendientes y estadísticas de entrega

> El AckManager hereda de `EventEmitter` y emite `message-acknowledged` / `message-failed`
> para monitoreo.

---

## Configuración

La instancia global se crea una vez en `app/index.js` y se inyecta como dependencia en
los handlers de sockets y de eventos de dominio:

```javascript
const AckManager = require('./sockets/services/AckManager');

const ackManager = new AckManager({
    timeout: 5000,      // 5 segundos de timeout para ACK
    maxRetries: 3,      // Máximo 3 reintentos
    retryDelay: 1000    // 1 segundo entre reintentos
});
```

Flujo de inyección real:
1. `index.js` crea `ackManager` y registra el listener `message-failed`.
2. `index.js` lo pasa a `initializeSocketIO(server, { ackManager })` y a
   `setupSocketHandlers(io, ackManager)`.
3. `socket.handlers.js` → `createSocketDependencies(ackManager)` lo distribuye a los
   handlers.
4. `index.js` lo registra también en `registerShutdownHandlers({ ..., ackManager })`.

---

## Uso Básico

### Antes (sin AckManager)
```javascript
socket.emit('answer-result', resultPayload);
```

### Después (con AckManager)
```javascript
const success = await ackManager.emitWithAck(socket, 'answer-result', resultPayload);

if (!success) {
    logger.error('Failed to deliver answer-result after retries', {
        socketId: socket.id,
        nickname: player.nickname
    });
}
```

> `emitWithAck(socket, event, data, options)` admite un cuarto argumento `options`
> (`options.maxRetries`) para sobrescribir el máximo de reintentos por mensaje.
> Requiere un **objeto socket** (no un `socketId`); obtén el socket con
> `io.sockets.sockets.get(socketId)` o `io.in(room).fetchSockets()`.

---

## Cliente (Frontend)

El cliente debe **invocar el callback de ACK** al recibir el evento. Por convención en
este proyecto el callback se invoca de forma defensiva:

```javascript
socket.on('answer-result', (data, ack) => {
    // Actualizar UI...
    updateAnswerUI(data);

    // IMPORTANTE: Confirmar recepción
    if (typeof ack === 'function') ack();
});
```

Los clientes que ya envían ACK:
- `public/js/player/player-answer.js` → `answer-result`
- `public/js/presenter/presenter-socket-handlers-game.js` → `game-started`, `answer-result`
- `public/js/tv/tv-socket-game.js` → `game-started` (y otros eventos de TV)

---

## Eventos Críticos integrados

> **Estado real:** la cobertura del AckManager es *parcial*. No todos los emisores de un
> mismo evento usan ACK; muchos siguen usando broadcast tradicional (`io.to(room).emit`).
> El AckManager solo se aplica cuando se dispone del objeto socket individual.

### 1. `game-started`

Implementado en `domain/events/handlers/GameStartedHandler.js`
(`notifyPlayers()` y `notifyPresenter()`). Patrón real: bucle **secuencial** por socket,
con fallback a broadcast si no hay `ackManager`:

```javascript
async notifyPlayers(roomId, gameConfig, players) {
    const playersRoom = `${roomId}:players`;
    const payload = { /* ... */ };

    if (this.ackManager) {
        const sockets = await this.io.in(playersRoom).fetchSockets();
        let failedCount = 0;
        for (const socket of sockets) {
            const delivered = await this.ackManager.emitWithAck(socket, 'game-started', payload);
            if (!delivered) {
                failedCount++;
                this.log('error', 'Failed to deliver game-started to player', {
                    socketId: socket.id, roomId
                });
            }
        }
    } else {
        this.io.to(playersRoom).emit('game-started', payload); // fallback
    }
}
```

### 2. `answer-result`

Cobertura **parcial**. Solo la ruta de *fallback individual* dentro de
`domain/strategies/TeamGameMode.js` (`_emitFallbackResult()`) usa `emitWithAck`:

```javascript
_emitFallbackResult(io, ackManager, socketId, nickname, resultPayload) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    if (ackManager) {
        ackManager.emitWithAck(socket, 'answer-result', resultPayload).then(delivered => {
            if (!delivered) {
                logger.error('Failed to deliver individual fallback answer-result', { nickname, socketId });
            }
        });
        return;
    }
    io.to(socketId).emit('answer-result', resultPayload); // fallback
}
```

Los siguientes emisores de `answer-result` **todavía usan broadcast tradicional** (sin ACK)
y son candidatos a migrar:
- `domain/strategies/IndividualGameMode.js` (`_emitAnswerResult`)
- `domain/services/AnswerProcessingService.js` (payload de respuesta duplicada)
- `sockets/utils/TeamRevealHelper.js`
- `sockets/utils/TeamManager.js`
- `sockets/services/AnswerBatchService.js` (batch al presentador)

`ackManager` se propaga a las estrategias a través del flujo de `submit-answer`
(`application/commands/submit-answer/*`) y `SubmitAnswerHandler.js`.

---

## Cleanup al Desconectar

Integrado en `sockets/socket.handlers.js` → `registerDisconnectAndErrorEvents()`:

```javascript
socket.on('disconnect', (reason) => {
    if (ackManager && typeof ackManager.cleanupSocket === 'function') {
        ackManager.cleanupSocket(socket.id);
    }
    // ... resto del manejo de desconexión
});
```

`cleanupSocket(socketId)` cancela los timeouts pendientes y resuelve sus promesas con
`false` para los mensajes de ese socket.

---

## Eventos del AckManager

El AckManager emite eventos para monitoreo (es un `EventEmitter`):

```javascript
// Mensaje confirmado correctamente
ackManager.on('message-acknowledged', (data) => {
    logger.debug('Message acknowledged', {
        messageId: data.messageId,
        event: data.event,
        attempts: data.attempts,
        ackData: data.ackData
    });
});

// Mensaje falló después de todos los reintentos
ackManager.on('message-failed', (data) => {
    logger.error('Message failed after retries', {
        messageId: data.messageId,
        event: data.event,
        attempts: data.attempts,
        reason: data.reason   // 'max_retries_exceeded'
    });
});
```

> `index.js` ya registra un listener de `message-failed` que escribe el error en el log.

---

## Estadísticas y Monitoreo

```javascript
const stats = ackManager.getStats();

console.log({
    sent: stats.sent,
    acknowledged: stats.acknowledged,
    failed: stats.failed,
    retried: stats.retried,
    pending: stats.pending,          // = pendingMessages.size
    successRate: stats.successRate    // Ej: "95.50%"
});
```

`resetStats()` reinicia los contadores (útil para testing).

---

## Testing

Los tests viven en `app/sockets/services/__tests__/AckManager.test.js`.

```javascript
describe('Answer submission with ACK', () => {
    let ackManager;

    beforeEach(() => {
        ackManager = new AckManager({ timeout: 100, maxRetries: 2 });
    });

    afterEach(() => {
        ackManager.cleanup();
    });

    it('should deliver answer-result with ACK', async () => {
        const delivered = await ackManager.emitWithAck(
            mockSocket,
            'answer-result',
            { isCorrect: true, points: 100 }
        );

        // Simular ACK del cliente invocando el callback pasado a socket.emit
        // ...

        expect(delivered).toBe(true);
    });
});
```

---

## Shutdown Graceful

El cleanup en el apagado está integrado en
`infrastructure/shutdown/GracefulShutdown.js` (`registerShutdownHandlers`), que llama a
`deps.ackManager.cleanup()` como uno de sus pasos:

```javascript
// dentro de registerShutdownHandlers({ server, io, pool, ackManager })
if (deps.ackManager) {
    deps.ackManager.cleanup();
    logger.info('Step 3/6: AckManager cleaned up');
}
```

`cleanup()` limpia todos los timeouts pendientes, resuelve sus promesas con `false`,
vacía `pendingMessages` y elimina todos los listeners.

---

## Notas de Implementación

### ✅ Ventajas
- Garantiza entrega de mensajes críticos
- Retry automático sin intervención manual
- Métricas de entrega out-of-the-box
- Limpieza automática al desconectar

### ⚠️ Consideraciones
- Solo usar en eventos **críticos** (p. ej. `game-started`, `answer-result`)
- No usar en eventos de alta frecuencia (typing, mouse-move, etc.)
- El cliente DEBE invocar el callback de ACK
- `emitWithAck` necesita el objeto socket, no un `socketId`
- Timeout adecuado según latencia esperada (5s es razonable)

### 🔧 Posibles mejoras pendientes
La integración actual es parcial. Para una cobertura completa de `answer-result` habría
que migrar los emisores que aún usan broadcast tradicional (ver lista en la sección
"Eventos Críticos integrados"):
1. `IndividualGameMode._emitAnswerResult()`
2. `TeamRevealHelper` y `TeamManager`
3. `AnswerProcessingService` (respuesta duplicada)
4. Considerar `emitWithAck` para `new-question` / `reveal-answer` si se requiere garantía

---

## Referencias

- Socket.IO Acknowledgments: https://socket.io/docs/v4/emitting-events/#acknowledgements
- Código: `app/sockets/services/AckManager.js`
- Tests: `app/sockets/services/__tests__/AckManager.test.js`
- Instanciación e inyección: `app/index.js`, `app/sockets/socket.handlers.js`
- Integraciones: `app/domain/events/handlers/GameStartedHandler.js`,
  `app/domain/strategies/TeamGameMode.js`
- Shutdown: `app/infrastructure/shutdown/GracefulShutdown.js`
