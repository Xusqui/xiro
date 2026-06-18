# Chain of Responsibility Pattern - Cadena de Responsabilidad

**Proyecto**: Xiro!
**Patrón**: Chain of Responsibility
**Código**: `app/application/chain/`

---

## 📖 Concepto

Patrón que permite pasar requests a través de una **cadena de handlers**, donde cada handler decide si procesa la request o la pasa al siguiente.

### Ventajas
- ✅ **Desacoplamiento**: Cada handler es independiente
- ✅ **Flexibilidad**: Agregar/remover handlers sin afectar otros
- ✅ **Responsabilidad única**: Cada handler una tarea específica
- ✅ **Orden configurable**: Pipeline personalizable
- ✅ **Testing**: Testear cada handler aisladamente

---

## 🏗️ Implementación en Xiro!

### Estructura real

```
app/application/chain/
├── Handler.js                    # Clase base abstracta
├── IdempotencyHandler.js          # Devuelve resultado cacheado si la request ya se procesó
├── RateLimitHandler.js           # Rate limiting (Redis, ya implementado)
├── ValidationHandler.js          # Validación de entrada
├── CommandExecutionHandler.js    # Ejecución de comando CQRS
├── ResponseHandler.js            # Formateo de respuesta + ACK callback
└── index.js                      # Exports
```

> El orden real de la cadena (ver `SubmitAnswerUseCase`) es:
> **Idempotency → RateLimit → Validation → CommandExecution → Response**,
> no "Validation → RateLimit → ..." — la idempotencia va primero para devolver el
> resultado cacheado sin volver a consumir cuota de rate limit ni revalidar.

---

## 🔗 Clase Base: Handler

```javascript
// app/application/chain/Handler.js
class Handler {
    constructor() {
        this.nextHandler = null;
    }

    setNext(handler) {
        this.nextHandler = handler;
        return handler; // Permite encadenamiento fluido
    }

    // Las subclases NO implementan handle() desde cero: hacen su trabajo y
    // luego llaman a `super.handle(context)` para continuar la cadena.
    async handle(context) {
        if (this.nextHandler) {
            const result = await this.nextHandler.handle(context);
            if (result === undefined || result === null) {
                // Defensa contra handlers mal implementados que no retornan nada
                return { success: false, reason: 'internal-error' };
            }
            return result;
        }
        return { success: true }; // Fin de la cadena
    }
}

module.exports = Handler;
```

> A diferencia de un Chain of Responsibility "de libro" (con `passToNext()` explícito),
> aquí el propio `Handler.handle()` base ya delega al siguiente. Cada handler concreto
> sobreescribe `handle()`, hace su trabajo, y termina con `return super.handle(context)`
> para continuar (o retorna un `{ success: false, ... }` para detener la cadena).

---

## 🔒 Handler 1: IdempotencyHandler

**Responsabilidad**: Si `context.data.requestId` ya fue procesado, devuelve el resultado
cacheado sin ejecutar el resto de la cadena. Si no, continúa y cachea el resultado al
finalizar (vía `IdempotencyService`, Redis con TTL 5 min — ver `application/services/idempotency.js`).

```javascript
// app/application/chain/IdempotencyHandler.js (resumen)
class IdempotencyHandler extends Handler {
    constructor(idempotencyService, contextName = 'unknown') {
        super();
        this.idempotencyService = idempotencyService;
        this.contextName = contextName;
    }

    async handle(context) {
        const requestId = context?.data?.requestId;
        if (!requestId) {
            return super.handle(context); // sin requestId, no hay idempotencia
        }

        const cached = await this.idempotencyService.isProcessed(requestId);
        if (cached) {
            context.fromCache = true;
            return cached; // detiene la cadena, no se reejecuta el comando
        }

        const result = await super.handle(context);
        if (result && result.success !== false) {
            await this.idempotencyService.markProcessed(requestId, result);
        }
        return result;
    }
}
```

---

## ⚡ Handler 2: RateLimitHandler

**Responsabilidad**: Limitar tasa de requests por socket usando un rate limiter externo
(Redis-backed, ver `application/helpers/SocketRateLimiterFactory.js`). **No** implementa
su propia ventana en memoria — delega en `rateLimiter.checkLimit(socketId, operation)`.

```javascript
// app/application/chain/RateLimitHandler.js (resumen)
class RateLimitHandler extends Handler {
    constructor(rateLimiter, operation) {
        super();
        this.rateLimiter = rateLimiter;
        this.operation = operation;
    }

    async handle(context) {
        const { socket } = context;
        if (!socket || !socket.id) {
            return super.handle(context); // sin socket, no aplica
        }

        const isAllowed = await this.rateLimiter.checkLimit(socket.id, this.operation);
        if (!isAllowed) {
            return {
                success: false,
                reason: 'rate-limit-exceeded',
                message: 'Demasiadas peticiones. Espera un momento.'
            };
        }

        return super.handle(context);
    }
}
```

### Uso real
```javascript
const rateLimiter = createRedisRateLimiter({ getRedisClient, windowMs: 1000, maxAttempts: 5 });
const rateLimitHandler = new RateLimitHandler(rateLimiter, 'submit-answer');
```

---

## 🛡️ Handler 3: ValidationHandler

**Responsabilidad**: Validar `context.socket` / `context.data` / `context.playerId`
(requisitos configurables) y luego ejecutar una `validateFn(data)` específica del caso
de uso (no necesariamente Joi — en `SubmitAnswerUseCase` son funciones a medida por
`answerType`). El resultado validado se guarda en `context.validatedData`.

```javascript
// app/application/chain/ValidationHandler.js (resumen)
class ValidationHandler extends Handler {
    constructor(validateFn, options = {}) {
        super();
        this.validateFn = validateFn;
        this.options = {
            passFullContext: options.passFullContext === true,
            requireSocket: options.requireSocket !== false,
            requireData: options.requireData !== false,
            requirePlayerId: options.requirePlayerId !== false
        };
    }

    handle(context) {
        const missing = this._validateRequiredContext(context);
        if (missing) {
            return { success: false, reason: 'validation-failed', error: missing };
        }

        const dataToValidate = this.options.passFullContext ? context : (context.data || context);
        const validation = this.validateFn(dataToValidate);

        if (!validation.valid) {
            return { success: false, reason: 'validation-failed', errors: validation.errors };
        }

        context.validatedData = validation.value || context.data || context;
        return super.handle(context);
    }
}
```

### Uso real en `SubmitAnswerUseCase`
```javascript
const validationHandler = new ValidationHandler(validateSubmitAnswerPayload);
// validateSubmitAnswerPayload despacha a un validador distinto según answerType
// (numeric, word_scramble, multiple_choice, matching) o usa el schema Joi por defecto
```

---

## 🎯 Handler 4: CommandExecutionHandler

**Responsabilidad**: Ejecutar el Command CQRS correspondiente con el payload mapeado
desde el contexto. Siempre continúa la cadena (incluso si el comando falla) para que
`ResponseHandler` pueda invocar el callback de ACK.

```javascript
// app/application/chain/CommandExecutionHandler.js (resumen)
class CommandExecutionHandler extends Handler {
    constructor(CommandClass, payloadMapper) {
        super();
        this.CommandClass = CommandClass;
        this.payloadMapper = payloadMapper;
    }

    async handle(context) {
        const payload = this.payloadMapper ? this.payloadMapper(context) : context.validatedData;
        const command = new this.CommandClass(payload);
        const result = await command.execute(context.dependencies);

        context.commandResult = result;
        return super.handle(context); // siempre continúa
    }
}
```

> Nota: a diferencia de lo que podría sugerir el nombre, este handler **no llama** a
> `command.validate()` por separado — la validación ya ocurrió en `ValidationHandler`.

### Uso real
```javascript
const commandHandler = new CommandExecutionHandler(
    ImprovedSubmitAnswerCommand,
    mapSubmitAnswerCommandContext
);
```

---

## 📤 Handler 5: ResponseHandler

**Responsabilidad**: Formatear la respuesta final con un `responseMapper` opcional,
invocar el **callback de ACK** de Socket.IO si existe, y emitir `socket.emit('error', ...)`
si el comando falló.

```javascript
// app/application/chain/ResponseHandler.js (resumen)
class ResponseHandler extends Handler {
    constructor(responseMapper) {
        super();
        this.responseMapper = responseMapper;
    }

    handle(context) {
        const { socket, commandResult, callback } = context;
        if (!commandResult) return super.handle(context);

        const response = this.responseMapper
            ? this.responseMapper(commandResult, context)
            : commandResult;

        if (callback && typeof callback === 'function') {
            callback(response); // ACK al cliente
        }

        if (!commandResult.success && commandResult.reason && socket) {
            socket.emit('error', { message: commandResult.message || commandResult.reason });
        }

        return response; // último handler: no llama a super.handle()
    }
}
```

---

## 🔄 Ejemplo Real: SubmitAnswerUseCase

```javascript
// app/application/use-cases/SubmitAnswerUseCase.js (resumen)
const {
    ValidationHandler, RateLimitHandler, CommandExecutionHandler,
    ResponseHandler, IdempotencyHandler
} = require('../chain');

class SubmitAnswerUseCase {
    constructor() {
        this.pipeline = this.buildPipeline();
    }

    buildPipeline() {
        const idempotencyService = getIdempotencyService();
        const idempotencyHandler = idempotencyService
            ? new IdempotencyHandler(idempotencyService, 'submit-answer')
            : null;

        const rateLimiter = createRedisRateLimiter({ getRedisClient, windowMs: 1000, maxAttempts: 5 });
        const rateLimitHandler = new RateLimitHandler(rateLimiter, 'submit-answer');
        const validationHandler = new ValidationHandler(validateSubmitAnswerPayload);
        const commandHandler = new CommandExecutionHandler(ImprovedSubmitAnswerCommand, mapSubmitAnswerCommandContext);
        const responseHandler = new ResponseHandler(mapSubmitAnswerResponse);

        // Orden real: idempotency -> rateLimit -> validation -> command -> response
        rateLimitHandler.setNext(validationHandler);
        validationHandler.setNext(commandHandler);
        commandHandler.setNext(responseHandler);

        if (!idempotencyHandler) return rateLimitHandler;
        idempotencyHandler.setNext(rateLimitHandler);
        return idempotencyHandler;
    }

    async execute(context) {
        return await this.pipeline.handle(context);
    }
}

module.exports = SubmitAnswerUseCase;
```

> `IdempotencyHandler` es **opcional**: si `getIdempotencyService()` no devuelve un
> servicio disponible, la cadena arranca directamente en `RateLimitHandler`.

Otros use cases que usan esta cadena: `JoinGameUseCase`, `StartGameUseCase`
(ver `application/use-cases/`).

---

## 🎨 Flujo Visual

```
Cliente envía "submit-answer" (con requestId, socket, callback de ACK)
        ↓
[IdempotencyHandler]  (si hay servicio de idempotencia disponible)
   ├─ 🔁 requestId ya procesado → devolver resultado cacheado, FIN
   └─ 🆕 nuevo → continuar y cachear el resultado al terminar
        ↓
[RateLimitHandler]
   ├─ ✅ Dentro del límite (Redis) → Continuar
   └─ ❌ Límite excedido → Detener y retornar error
        ↓
[ValidationHandler]
   ├─ ✅ Válido → guarda context.validatedData → Continuar
   └─ ❌ Inválido → Detener y retornar error
        ↓
[CommandExecutionHandler]
   ├─ Crear Command (p. ej. ImprovedSubmitAnswerCommand)
   ├─ Ejecutar → modifica estado, emite eventos de dominio
   └─ Guardar resultado en context.commandResult (siempre continúa)
        ↓
[ResponseHandler]
   ├─ Formatear respuesta con responseMapper
   ├─ Invocar callback de ACK si existe
   └─ Emitir 'error' al socket si commandResult.success === false
        ↓
   Fin de la cadena
```

---

## ✅ Beneficios en el Proyecto

### 1. Modularidad
Cada handler es independiente y testeable (ver `application/chain/__tests__/`).

### 2. Extensibilidad
Se puede insertar un nuevo handler sin modificar los existentes, siempre que respete
el contrato `handle(context)` / `super.handle(context)` para continuar.

### 3. Reusabilidad
Los mismos handlers (`RateLimitHandler`, `ValidationHandler`, etc.) se instancian con
distinta configuración en cada use case (`SubmitAnswerUseCase`, `JoinGameUseCase`,
`StartGameUseCase`).

---

## 📊 Handlers del Proyecto

| Handler | Responsabilidad | Constructor | Detiene la cadena si... |
|---------|----------------|--------------|--------------------------|
| IdempotencyHandler | Cache de resultados por `requestId` | `(idempotencyService, contextName)` | El `requestId` ya fue procesado |
| RateLimitHandler | Limitar tasa de requests (Redis) | `(rateLimiter, operation)` | Se excede el límite |
| ValidationHandler | Validar contexto + payload | `(validateFn, options)` | Falta socket/data/playerId o `validateFn` falla |
| CommandExecutionHandler | Ejecutar Command CQRS | `(CommandClass, payloadMapper)` | Nunca (siempre continúa) |
| ResponseHandler | Formatear respuesta + ACK | `(responseMapper)` | Es el último handler |

---

## 🧪 Testing

Los tests reales viven en `app/application/chain/__tests__/`, uno por handler, más los
tests de integración de cada use case en `application/use-cases/__tests__/`.

```javascript
describe('RateLimitHandler', () => {
    it('detiene la cadena si se excede el límite', async () => {
        const rateLimiter = { checkLimit: jest.fn().mockResolvedValue(false) };
        const handler = new RateLimitHandler(rateLimiter, 'submit-answer');

        const result = await handler.handle({ socket: { id: 's1' } });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('rate-limit-exceeded');
    });
});
```

---

## 🎯 Cuándo Usar Chain of Responsibility

### ✅ Usar cuando:
- Necesitas procesar la request en múltiples pasos (idempotencia, rate limit, validación...)
- Quieres separar esas preocupaciones en piezas testeables por separado
- El orden de procesamiento importa
- Necesitas handlers reutilizables entre varios use cases

### ❌ NO usar cuando:
- Procesamiento simple de un solo paso
- No hay validaciones, rate limiting ni idempotencia que aplicar
- El orden no importa

---

## Referencias

- Código: `app/application/chain/`
- Uso real: `app/application/use-cases/SubmitAnswerUseCase.js`, `JoinGameUseCase.js`, `StartGameUseCase.js`
- Servicio de idempotencia: `app/application/services/idempotency.js`
- Rate limiter Redis: `app/application/helpers/SocketRateLimiterFactory.js`
