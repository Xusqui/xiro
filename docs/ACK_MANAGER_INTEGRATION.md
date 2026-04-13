# AckManager Integration Guide

## Resumen

El **AckManager** es un servicio que garantiza la entrega confiable de mensajes críticos en Socket.io mediante:
- **Acknowledgments (ACK)**: Confirmación de recepción por parte del cliente
- **Retry automático**: Reenvío si no se recibe ACK en el timeout configurado
- **Tracking**: Monitoreo de mensajes pendientes y estadísticas de entrega

---

## Configuración

```javascript
const AckManager = require('./sockets/services/AckManager');

const ackManager = new AckManager({
    timeout: 5000,      // 5 segundos de timeout para ACK
    maxRetries: 3,      // Máximo 3 reintentos
    retryDelay: 1000    // 1 segundo entre reintentos
});
```

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

---

## Cliente (Frontend)

El cliente debe **enviar ACK** al recibir el evento:

```javascript
socket.on('answer-result', (data, callback) => {
    console.log('Answer result received:', data);
    
    // Actualizar UI
    updateAnswerUI(data);
    
    // IMPORTANTE: Confirmar recepción
    if (callback) {
        callback({ ok: true, receivedAt: Date.now() });
    }
});
```

---

## Eventos Críticos a Integrar

### 1. `answer-result` (Resultado de respuesta)

**Archivos a modificar:**
- `domain/strategies/IndividualGameMode.js` (línea 44)
- `domain/strategies/TeamGameMode.js` (líneas 176, 246)
- `domain/services/AnswerProcessingService.js` (línea 33)
- `domain/services/TeamRevealService.js` (línea 160)
- `sockets/utils/TeamManager.js` (línea 38)

**Ejemplo de integración:**
```javascript
// ANTES
io.to(socketId).emit('answer-result', resultPayload);

// DESPUÉS
const socket = io.sockets.sockets.get(socketId);
if (socket) {
    const delivered = await ackManager.emitWithAck(
        socket, 
        'answer-result', 
        resultPayload
    );
    
    if (!delivered) {
        logger.error('Failed to deliver answer result', {
            socketId,
            nickname: player.nickname
        });
        // Opcional: guardar para reenvío posterior
    }
}
```

### 2. `game-started` (Inicio de juego)

**Archivos a modificar:**
- `domain/events/handlers/GameStartedHandler.js` (líneas 73, 94)
- `sockets/handlers/StartGameHandler.js` (líneas 54, 58)

**Ejemplo de integración:**
```javascript
// ANTES
io.to(playersRoom).emit('game-started', payload);

// DESPUÉS
const sockets = await io.in(playersRoom).fetchSockets();
const promises = sockets.map(socket => 
    ackManager.emitWithAck(socket, 'game-started', payload)
);

const results = await Promise.allSettled(promises);
const failures = results.filter(r => r.status === 'rejected' || r.value === false);

if (failures.length > 0) {
    logger.warn('Some players did not receive game-started', {
        roomId,
        total: sockets.length,
        failures: failures.length
    });
}
```

### 3. `question-revealed` (Revelación de pregunta)

**Buscar en el código y aplicar mismo patrón que `game-started`**

---

## Cleanup al Desconectar

Integrar en el handler de desconexión:

```javascript
socket.on('disconnect', () => {
    // Limpiar mensajes pendientes de este socket
    ackManager.cleanupSocket(socket.id);
    
    logger.info('Socket disconnected and cleaned up', {
        socketId: socket.id
    });
});
```

---

## Eventos del AckManager

El AckManager emite eventos que puedes escuchar para monitoreo:

```javascript
// Mensaje confirmado correctamente
ackManager.on('message-acknowledged', (data) => {
    logger.debug('Message acknowledged', {
        messageId: data.messageId,
        event: data.event,
        attempts: data.attempts
    });
});

// Mensaje falló después de todos los reintentos
ackManager.on('message-failed', (data) => {
    logger.error('Message failed after retries', {
        messageId: data.messageId,
        event: data.event,
        attempts: data.attempts,
        reason: data.reason
    });
    
    // Opcional: Enviar a sistema de alertas
    // alerting.send('Socket delivery failure', data);
});
```

---

## Estadísticas y Monitoreo

```javascript
const stats = ackManager.getStats();

console.log({
    sent: stats.sent,
    acknowledged: stats.acknowledged,
    failed: stats.failed,
    retried: stats.retried,
    pending: stats.pending,
    successRate: stats.successRate  // Ej: "95.5%"
});
```

---

## Testing

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
        // Simular emisión
        const delivered = await ackManager.emitWithAck(
            mockSocket,
            'answer-result',
            { isCorrect: true, points: 100 }
        );
        
        // Simular ACK del cliente
        const callback = mockSocket.emissions[0].callback;
        callback({ ok: true });
        
        expect(delivered).toBe(true);
    });
});
```

---

## Shutdown Graceful

Al cerrar el servidor:

```javascript
process.on('SIGTERM', async () => {
    logger.info('Shutting down AckManager...');
    
    // Limpiar mensajes pendientes
    ackManager.cleanup();
    
    // Cerrar sockets
    io.close();
});
```

---

## Notas de Implementación

### ✅ Ventajas
- Garantiza entrega de mensajes críticos
- Retry automático sin intervención manual
- Métricas de entrega out-of-the-box
- Limpieza automática al desconectar

### ⚠️ Consideraciones
- Solo usar en eventos **críticos** (answer-result, game-started, question-revealed)
- No usar en eventos de alta frecuencia (typing, mouse-move, etc.)
- El cliente DEBE implementar el callback de ACK
- Timeout adecuado según latencia esperada (5s es razonable)

### 🔧 Próximos Pasos
1. Integrar en `IndividualGameMode.processAnswer()`
2. Integrar en `TeamGameMode.processAnswer()`
3. Integrar en `GameStartedHandler.notifyPlayers()`
4. Actualizar clientes (jugador.js, presentador.js) para enviar ACKs
5. Añadir monitoreo de `message-failed` en sistema de alertas

---

## Referencias

- Socket.io Acknowledgments: https://socket.io/docs/v4/emitting-events/#acknowledgements
- Código: `app/sockets/services/AckManager.js`
- Tests: `app/sockets/services/AckManager.test.js`
