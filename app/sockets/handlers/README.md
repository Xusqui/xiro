# Chain of Responsibility Pattern - Socket Handlers

## Estructura Implementada

```
app/sockets/handlers/
├── BaseHandler.js                    # Clase base abstracta
├── ValidateInputHandler.js           # Validación de input
├── CheckGameStateHandler.js          # Verificar estado del juego
├── CheckDuplicateHandler.js          # Idempotencia
├── ProcessAnswerHandler.js           # CQRS Command
├── UpdatePlayerStateHandler.js       # Actualizar estado
├── NotifyClientsHandler.js           # Notificaciones
└── AnswerHandlerFactory.js           # Factory para construir pipeline
```

## Pipeline de Procesamiento

```
ValidateInputHandler
    ↓
CheckGameStateHandler
    ↓
CheckDuplicateHandler (si duplicado → detener y retornar)
    ↓
ProcessAnswerHandler (usa SubmitAnswerCommand)
    ↓
UpdatePlayerStateHandler
    ↓
NotifyClientsHandler
```

## Uso

```javascript
const { createAnswerPipeline } = require('./handlers/AnswerHandlerFactory');

const answerPipeline = createAnswerPipeline({
    activeGames,
    players,
    socketToPlayer,
    io,
    teamConfigs,
    publishPlayerAnsweredSync
});

// En el handler de submit-answer:
const context = { socket, data };
const result = await answerPipeline.handle(context);
```

## Beneficios

1. **Separación de Responsabilidades**: Cada handler tiene una sola responsabilidad
2. **Testeable**: Cada handler se puede testear independientemente
3. **Extensible**: Fácil añadir/quitar handlers sin afectar el resto
4. **Mantenible**: Cambios localizados, sin efectos secundarios
5. **Legibilidad**: Pipeline autodocumentado

## Estado Actual

✅ Estructura creada (7 archivos)  
⏳ Migración del handler submit-answer pendiente (por complejidad del modo equipos)

## Próximos Pasos

1. Simplificar lógica de modo equipos
2. Migrar completamente submit-answer al pipeline
3. Crear pipelines para otros handlers (start-game, next-question)
4. Crear tests para cada handler del pipeline
