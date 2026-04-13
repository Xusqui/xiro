# Chain of Responsibility Pattern - Cadena de Responsabilidad

**Proyecto**: Xiro!  
**Patrón**: Chain of Responsibility  
**Fecha**: 2 de febrero de 2026

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

### Estructura

```
app/application/chain/
├── Handler.js                    # Clase base abstracta
├── ValidationHandler.js          # Validación de entrada
├── RateLimitHandler.js          # Rate limiting (futuro)
├── CommandExecutionHandler.js   # Ejecución de comando
└── ResponseHandler.js            # Formateo de respuesta
```

---

## 🔗 Clase Base: Handler

```javascript
// app/application/chain/Handler.js
class Handler {
    constructor() {
        this.nextHandler = null;
    }

    /**
     * Establecer siguiente handler en la cadena
     * @param {Handler} handler - Siguiente handler
     * @returns {Handler} El handler pasado (para encadenar)
     */
    setNext(handler) {
        this.nextHandler = handler;
        return handler; // Permite encadenamiento fluido
    }

    /**
     * Manejar request
     * @param {Object} context - Contexto de la request
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    async handle(context) {
        throw new Error('handle() debe ser implementado');
    }

    /**
     * Pasar al siguiente handler (si existe)
     * @param {Object} context - Contexto
     * @returns {Promise<Object>} Resultado del siguiente handler
     */
    async passToNext(context) {
        if (this.nextHandler) {
            return await this.nextHandler.handle(context);
        }
        return { success: true }; // Fin de la cadena
    }
}

module.exports = Handler;
```

---

## 🛡️ Handler 1: ValidationHandler

**Responsabilidad**: Validar datos de entrada usando schemas Joi

```javascript
// app/application/chain/ValidationHandler.js
const Handler = require('./Handler');

class ValidationHandler extends Handler {
    /**
     * @param {Function} validationFn - Función que valida (retorna { valid, errors })
     */
    constructor(validationFn) {
        super();
        this.validationFn = validationFn;
    }

    async handle(context) {
        // Ejecutar validación
        const validation = this.validationFn(context.data);

        // Si la validación falla, detener la cadena
        if (!validation.valid) {
            return {
                success: false,
                error: 'Validation failed',
                details: validation.errors
            };
        }

        // Si es válido, pasar al siguiente handler
        return await this.passToNext(context);
    }
}

module.exports = ValidationHandler;
```

### Uso en Use Case

```javascript
// En SubmitAnswerUseCase
const validationHandler = new ValidationHandler(
    (data) => validateSocket(schemas.submitAnswer, data)
);
```

---

## ⚡ Handler 2: RateLimitHandler

**Responsabilidad**: Limitar tasa de requests por jugador

```javascript
// app/application/chain/RateLimitHandler.js
const Handler = require('./Handler');

class RateLimitHandler extends Handler {
    constructor(maxRequests = 10, windowMs = 1000) {
        super();
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requestCounts = new Map(); // playerId → [timestamps]
    }

    async handle(context) {
        const playerId = context.socket?.data?.playerId;
        
        if (!playerId) {
            // Si no hay playerId, pasar (no aplica rate limit)
            return await this.passToNext(context);
        }

        const now = Date.now();
        const timestamps = this.requestCounts.get(playerId) || [];

        // Filtrar timestamps dentro de la ventana
        const recentRequests = timestamps.filter(
            ts => now - ts < this.windowMs
        );

        // Verificar límite
        if (recentRequests.length >= this.maxRequests) {
            return {
                success: false,
                error: 'Rate limit exceeded',
                retryAfter: this.windowMs
            };
        }

        // Agregar timestamp actual
        recentRequests.push(now);
        this.requestCounts.set(playerId, recentRequests);

        // Pasar al siguiente
        return await this.passToNext(context);
    }

    // Limpiar timestamps antiguos periódicamente
    cleanup() {
        const now = Date.now();
        for (const [playerId, timestamps] of this.requestCounts.entries()) {
            const recent = timestamps.filter(ts => now - ts < this.windowMs);
            if (recent.length === 0) {
                this.requestCounts.delete(playerId);
            } else {
                this.requestCounts.set(playerId, recent);
            }
        }
    }
}

module.exports = RateLimitHandler;
```

---

## 🎯 Handler 3: CommandExecutionHandler

**Responsabilidad**: Ejecutar el Command o Query

```javascript
// app/application/chain/CommandExecutionHandler.js
const Handler = require('./Handler');

class CommandExecutionHandler extends Handler {
    /**
     * @param {Class} CommandClass - Clase del comando a ejecutar
     * @param {Function} paramsMapper - Función que mapea context a params del comando
     */
    constructor(CommandClass, paramsMapper) {
        super();
        this.CommandClass = CommandClass;
        this.paramsMapper = paramsMapper;
    }

    async handle(context) {
        try {
            // Crear instancia del comando con params mapeados
            const params = this.paramsMapper(context);
            const command = new this.CommandClass(params);

            // Validar comando
            const validation = await command.validate(context.dependencies);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'Command validation failed',
                    details: validation.errors
                };
            }

            // Ejecutar comando
            const result = await command.execute(context.dependencies);

            // Agregar resultado al contexto para próximos handlers
            context.commandResult = result;

            // Pasar al siguiente handler
            return await this.passToNext(context);

        } catch (error) {
            return {
                success: false,
                error: 'Command execution failed',
                message: error.message
            };
        }
    }
}

module.exports = CommandExecutionHandler;
```

### Uso en Use Case

```javascript
const commandHandler = new CommandExecutionHandler(
    SubmitAnswerCommand,
    (context) => ({
        pin: context.data.pin,
        nickname: context.data.nickname,
        index: context.data.index
    })
);
```

---

## 📤 Handler 4: ResponseHandler

**Responsabilidad**: Formatear y enviar respuesta al cliente

```javascript
// app/application/chain/ResponseHandler.js
const Handler = require('./Handler');

class ResponseHandler extends Handler {
    async handle(context) {
        const { socket, commandResult } = context;

        if (!commandResult) {
            // No hay resultado previo, retornar error
            socket.emit('error', {
                message: 'No command result available'
            });
            return { success: false };
        }

        if (commandResult.success) {
            // Éxito: el comando ya emitió eventos Socket.IO
            // Solo retornar confirmación
            return {
                success: true,
                data: commandResult
            };
        } else {
            // Error: emitir evento de error
            socket.emit('error', {
                message: commandResult.error || 'Command failed',
                details: commandResult.details
            });
            return {
                success: false,
                error: commandResult.error
            };
        }
    }
}

module.exports = ResponseHandler;
```

---

## 🔄 Ejemplo Completo: Use Case con Cadena

```javascript
// app/application/use-cases/SubmitAnswerUseCase.js
const {
    ValidationHandler,
    RateLimitHandler,
    CommandExecutionHandler,
    ResponseHandler
} = require('../chain');
const SubmitAnswerCommand = require('../commands/SubmitAnswerCommand');
const { validateSocket, schemas } = require('../../validation');

class SubmitAnswerUseCase {
    constructor() {
        this.setupChain();
    }

    setupChain() {
        // 1. Validación de entrada
        const validationHandler = new ValidationHandler(
            (data) => validateSocket(schemas.submitAnswer, data)
        );

        // 2. Rate limiting (10 requests por segundo)
        const rateLimitHandler = new RateLimitHandler(10, 1000);

        // 3. Ejecución del comando
        const commandHandler = new CommandExecutionHandler(
            SubmitAnswerCommand,
            (context) => ({
                pin: context.data.pin,
                nickname: context.data.nickname,
                index: context.data.index
            })
        );

        // 4. Formateo de respuesta
        const responseHandler = new ResponseHandler();

        // Encadenar: validation → rateLimit → command → response
        validationHandler
            .setNext(rateLimitHandler)
            .setNext(commandHandler)
            .setNext(responseHandler);

        // Guardar referencia al primer handler
        this.chain = validationHandler;
    }

    /**
     * Ejecutar cadena de handlers
     */
    async execute(context) {
        return await this.chain.handle(context);
    }
}

module.exports = SubmitAnswerUseCase;
```

---

## 🎨 Flujo Visual

```
Cliente envía "submit-answer"
        ↓
[ValidationHandler]
   ├─ ✅ Válido → Continuar
   └─ ❌ Inválido → Detener y retornar error
        ↓
[RateLimitHandler]
   ├─ ✅ Dentro del límite → Continuar
   └─ ❌ Límite excedido → Detener y retornar error
        ↓
[CommandExecutionHandler]
   ├─ Crear SubmitAnswerCommand
   ├─ Validar comando
   ├─ ✅ Válido → Ejecutar
   │   ├─ Modificar estado
   │   ├─ Emitir eventos
   │   └─ Retornar resultado
   └─ ❌ Inválido → Detener y retornar error
        ↓
[ResponseHandler]
   ├─ ✅ Éxito → Confirmar
   └─ ❌ Error → Emitir error al cliente
        ↓
   Fin de la cadena
```

---

## ✅ Beneficios en el Proyecto

### 1. Modularidad
Cada handler es independiente y testeable:
```javascript
// Test solo de ValidationHandler
it('debe rechazar datos inválidos', async () => {
    const handler = new ValidationHandler(mockValidator);
    const result = await handler.handle(invalidContext);
    expect(result.success).toBe(false);
});
```

### 2. Extensibilidad
Agregar nuevo handler sin modificar existentes:
```javascript
// Nuevo handler de autenticación
class AuthHandler extends Handler {
    async handle(context) {
        if (!context.socket.authenticated) {
            return { success: false, error: 'Unauthorized' };
        }
        return await this.passToNext(context);
    }
}

// Insertarlo en la cadena
validationHandler
    .setNext(new AuthHandler())  // ← Nuevo handler
    .setNext(rateLimitHandler)
    .setNext(commandHandler);
```

### 3. Orden Flexible
Cambiar orden de handlers fácilmente:
```javascript
// Opción A: Validar primero
validation → rateLimit → command → response

// Opción B: Rate limit primero (más eficiente)
rateLimit → validation → command → response
```

### 4. Reusabilidad
Mismo handler en múltiples Use Cases:
```javascript
// ValidationHandler reutilizado
const validationHandler1 = new ValidationHandler(schema1);
const validationHandler2 = new ValidationHandler(schema2);
```

---

## 📊 Handlers del Proyecto

| Handler | Responsabilidad | Input | Output |
|---------|----------------|-------|--------|
| ValidationHandler | Validar datos entrada | Schema Joi | ✅/❌ + errores |
| RateLimitHandler | Limitar tasa requests | Max/Window | ✅/❌ + retry |
| CommandExecutionHandler | Ejecutar Command/Query | Class + Mapper | Resultado |
| ResponseHandler | Formatear respuesta | Command result | Socket emit |

---

## 🧪 Testing

### Test de Handler Individual

```javascript
describe('ValidationHandler', () => {
    it('debe pasar si validación exitosa', async () => {
        const validator = (data) => ({ valid: true, errors: [] });
        const handler = new ValidationHandler(validator);
        
        const nextHandler = {
            handle: jest.fn().mockResolvedValue({ success: true })
        };
        handler.setNext(nextHandler);

        const result = await handler.handle({ data: {} });

        expect(nextHandler.handle).toHaveBeenCalled();
        expect(result.success).toBe(true);
    });

    it('debe detener si validación falla', async () => {
        const validator = (data) => ({ 
            valid: false, 
            errors: ['Invalid data'] 
        });
        const handler = new ValidationHandler(validator);

        const result = await handler.handle({ data: {} });

        expect(result.success).toBe(false);
        expect(result.details).toContain('Invalid data');
    });
});
```

### Test de Cadena Completa

```javascript
describe('SubmitAnswerUseCase', () => {
    it('debe procesar respuesta válida', async () => {
        const useCase = new SubmitAnswerUseCase();
        
        const context = {
            socket: mockSocket,
            data: {
                pin: '1234',
                nickname: 'Player1',
                index: 2
            },
            dependencies: mockDependencies
        };

        const result = await useCase.execute(context);

        expect(result.success).toBe(true);
    });

    it('debe rechazar si validación falla', async () => {
        const useCase = new SubmitAnswerUseCase();
        
        const context = {
            socket: mockSocket,
            data: { /* datos inválidos */ },
            dependencies: mockDependencies
        };

        const result = await useCase.execute(context);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation failed');
    });
});
```

---

## 🎯 Cuándo Usar Chain of Responsibility

### ✅ Usar cuando:
- Necesitas procesar request en múltiples pasos
- Quieres separar validación, ejecución, respuesta
- El orden de procesamiento es importante
- Necesitas handlers reutilizables
- Quieres agregar/remover pasos fácilmente

### ❌ NO usar cuando:
- Procesamiento simple de un solo paso
- No hay validaciones o transformaciones
- Orden no importa
- Handlers demasiado acoplados

---

## 🚀 Próximos Handlers Potenciales

- [ ] **AuthHandler**: Verificar autenticación
- [ ] **LoggingHandler**: Registrar requests
- [ ] **CacheHandler**: Cachear resultados
- [ ] **MetricsHandler**: Recolectar métricas
- [ ] **TransactionHandler**: Manejar transacciones DB

---

**Chain of Responsibility hace el código flexible y mantenible** ✨
