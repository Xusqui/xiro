# CQRS Pattern - Command Query Responsibility Segregation

**Proyecto**: Xiro!
**Patrón**: CQRS (Command Query Responsibility Segregation)
**Código**: `app/application/commands/`, `app/application/queries/`

---

## 📖 Concepto

CQRS separa las operaciones de **lectura** (Queries) de las operaciones de **escritura** (Commands).

### Ventajas
- ✅ **Separación clara** entre lectura y escritura
- ✅ **Optimización independiente** de cada flujo
- ✅ **Escalabilidad** diferenciada
- ✅ **Mantenibilidad** mejorada
- ✅ **Testing** más sencillo

---

## 🏗️ Implementación en Xiro!

### Estructura real

```
app/application/
├── commands/                          # Operaciones de ESCRITURA
│   ├── Command.js                      # Clase base abstracta
│   ├── JoinGameCommand.js              # Unirse a un lobby (presenter/player)
│   ├── ImprovedStartGameCommand.js     # Iniciar partida
│   ├── ImprovedSubmitAnswerCommand.js  # Enviar respuesta (facade fino)
│   ├── submit-answer/                  # Módulos en los que se apoya el comando anterior
│   └── index.js
│
└── queries/                            # Operaciones de LECTURA
    ├── Query.js                        # Clase base abstracta
    ├── GetGameStateQuery.js
    ├── GetRankingQuery.js
    ├── GetPlayerStatsQuery.js
    ├── GetActiveSessionsQuery.js
    ├── QueryHelpers.js                 # executeQueryWithValidation, validateGameExists...
    └── index.js
```

> No existen `SubmitAnswerCommand`, `StartGameCommand`, `NextQuestionCommand`,
> `EndGameCommand` ni `GetLeaderboardQuery` como tales. Los nombres reales llevan el
> prefijo `Improved*` en los dos commands que fueron refactorizados, y la query de
> ranking se llama `GetRankingQuery`. El avance de pregunta (`AdvanceQuestionUseCase`) y
> el fin de partida (`EndGameUseCase`) viven como **use cases** en
> `application/use-cases/`, no como Commands — ver `ARCHITECTURE.md`.

---

## ⚙️ Commands (Escritura)

### Clase Base: Command

```javascript
// app/application/commands/Command.js (resumen real)
class Command {
    constructor(payload) {
        if (this.constructor === Command) {
            throw new Error('Command is an abstract class and cannot be instantiated directly');
        }
        this.payload = payload;
        this.timestamp = Date.now();
        this.commandId = `${this.constructor.name}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    }

    validate() {
        throw new Error('validate() must be implemented by subclass');
    }

    execute() {
        return Promise.reject(new Error('execute() must be implemented by subclass'));
    }

    toJSON() {
        return { commandId: this.commandId, commandType: this.constructor.name, timestamp: this.timestamp, payload: this.payload };
    }
}

module.exports = Command;
```

> A diferencia de una clase base "de libro", esta implementación **impide instanciar
> `Command` directamente** (lanza si `this.constructor === Command`), y cada comando
> trae un `commandId` único y `toJSON()` para logging — útil para correlacionar logs de
> un mismo comando a través de la Chain of Responsibility (ver `CHAIN_OF_RESPONSIBILITY_PATTERN.md`).

---

### Ejemplo Real: JoinGameCommand

`JoinGameCommand` es el comando más representativo del proyecto: une a un jugador (o al
presentador, con `nickname === 'HOST'`) a un lobby, validando PIN, duplicados,
reclamación de sesión de presentador desconectado, y sincronizando vía Redis.

```javascript
// app/application/commands/JoinGameCommand.js (resumen)
class JoinGameCommand extends Command {
    validate() {
        return validateJoinGameInput(this.payload);
    }

    async execute(deps) {
        const validation = this.validate();
        if (!validation.valid) {
            return { success: false, error: validation.errors.join(', ') };
        }

        const context = this._createExecutionContext(deps);

        try {
            // 1. Validar sessionId del presentador (si aplica)
            // 2. Guardar config de equipos (si el HOST la trae)
            // 3. Validar PIN (presentador vs jugador, vía caché de PIN)
            // 4. Asegurar que la sesión de jugador existe (Redis SessionStore)
            // 5. Si es HOST, intentar reclamar presentador desconectado (sessionSecret)
            // 6. Validar/resolver jugador (duplicados, capacidad)
            // 7. Registrar en globalState.players / socketToPlayer
            // 8. Publicar sync de jugador vía RedisSyncBus
            // 9. Unir el socket a las rooms (`{roomId}:presenter` o `{roomId}:players`)
            // 10. Sincronizar lobby (RedisSyncBus + SessionStore)
            // 11. Emitir PlayerJoinedEvent vía EventBus

            return this._buildSuccessResponse(context, playerId, playerData, playersInLobby);
        } catch (error) {
            return this._handleExecutionError(error, context);
        }
    }
}
```

> Nótese: este comando **no calcula puntuación** ni gestiona preguntas — eso es
> responsabilidad de `ImprovedSubmitAnswerCommand` (delegado en
> `application/commands/submit-answer/executeSubmitAnswer.js`, ver
> `CHAIN_OF_RESPONSIBILITY_PATTERN.md` para el pipeline completo que lo invoca).

### Otros Commands del Proyecto

| Command | Responsabilidad real |
|---------|------------------------|
| `ImprovedStartGameCommand` | Inicia la partida: prepara preguntas, cambia el estado del juego, emite `game.started` |
| `ImprovedSubmitAnswerCommand` | Facade fino que delega en `submit-answer/executeSubmitAnswer.js`; valida y procesa la respuesta vía las estrategias de modo de juego |

El avance de pregunta y el fin de partida **no son Commands**: son use cases
(`AdvanceQuestionUseCase`, `EndGameUseCase` en `application/use-cases/`) que orquestan
directamente sin pasar por esta jerarquía `Command`.

---

## 🔍 Queries (Lectura)

### Características
- **Solo leen** datos, NO modifican estado
- **No emiten** eventos de dominio
- **Optimizadas** para lectura rápida
- **Sin efectos secundarios**

### Clase Base: Query

```javascript
// app/application/queries/Query.js (resumen real)
class Query {
    constructor(params) {
        if (this.constructor === Query) {
            throw new Error('Query is an abstract class and cannot be instantiated directly');
        }
        this.params = params;
        this.timestamp = Date.now();
        this.queryId = `${this.constructor.name}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    }

    validate() { throw new Error('validate() must be implemented by subclass'); }
    execute() { return Promise.reject(new Error('execute() must be implemented by subclass')); }
    toJSON() { /* queryId, queryType, timestamp, params */ }
}
```

> Misma simetría que `Command`: no se puede instanciar `Query` directamente, y cada
> query tiene un `queryId` para trazabilidad.

### Ejemplo Real: GetGameStateQuery

```javascript
// app/application/queries/GetGameStateQuery.js (resumen)
class GetGameStateQuery extends Query {
    constructor({ gameId, includeQuestions = false, includeScores = true }) {
        super({ gameId, includeQuestions, includeScores });
    }

    validate() {
        const errors = [];
        if (!this.params.gameId) errors.push('gameId is required');
        return { valid: errors.length === 0, errors };
    }

    execute({ activeGames }) {
        return executeQueryWithValidation(this, () => {
            const game = validateGameExists(activeGames, this.params.gameId);
            if (game.success === false) return game;

            const response = {
                success: true,
                gameId: this.params.gameId,
                pin: game.pin,
                state: game.state,
                currentIndex: game.currentIndex,
                canAnswer: game.canAnswer,
                timerValue: game.timerValue,
                playerCount: game.players?.length || 0,
                questionCount: game.questions?.length || 0
            };

            if (this.params.includeScores && game.scores) response.scores = { ...game.scores };
            if (this.params.includeQuestions && game.questions) response.questions = [...game.questions];
            if (game.answerStats) response.answerStats = { ...game.answerStats };

            return response;
        });
    }
}
```

> No hay distinción de "vista por rol" (player vs presenter) dentro de la query —
> a diferencia de lo que podría sugerir un diseño CQRS más elaborado, aquí
> `GetGameStateQuery` devuelve el mismo shape de datos siempre; el filtrado de qué ve
> cada rol ocurre en la capa de sockets/payload sanitizer (`services/payload.sanitizer.js`),
> no en la query.

Otras queries reales: `GetRankingQuery`, `GetPlayerStatsQuery`, `GetActiveSessionsQuery`,
todas apoyadas en los helpers compartidos de `QueryHelpers.js`
(`executeQueryWithValidation`, `validateGameExists`).

---

## 🎯 Cuándo Usar Cada Uno

### Usar COMMAND cuando:
- ✅ Vas a **modificar estado** (agregar, actualizar, eliminar)
- ✅ La operación tiene **efectos secundarios**
- ✅ Necesitas **validaciones complejas**
- ✅ Debes **emitir eventos** de dominio
- ✅ Ejemplo: Unirse al lobby, enviar respuesta, iniciar juego

### Usar QUERY cuando:
- ✅ Solo necesitas **leer datos**
- ✅ **No modificas** ningún estado
- ✅ La operación es **idempotente**
- ✅ Optimizado para **lectura rápida**
- ✅ Ejemplo: Obtener ranking, ver estado del juego, estadísticas de jugador

---

## 🔄 Flujo Típico

### Command Flow (real, ver `CHAIN_OF_RESPONSIBILITY_PATTERN.md`)

```
1. Socket handler recibe el evento → Use Case construye el contexto
   ↓
2. Chain of Responsibility: Idempotency → RateLimit → Validation
   ↓
3. CommandExecutionHandler crea el Command y llama a command.execute(dependencies)
   ↓
4. El comando valida internamente, muta estado (globalState Maps),
   emite evento(s) de dominio vía EventBus
   ↓
5. ResponseHandler formatea la respuesta e invoca el callback de ACK
```

### Query Flow

```
1. Caller construye la Query con sus params
   ↓
2. query.validate() (independiente de la Chain of Responsibility —
   las queries no pasan por ese pipeline)
   ↓
3. query.execute(dependencies) — solo lectura
   ↓
4. Retorna resultado (sin eventos, sin mutaciones)
```

---

## ✅ Mejores Prácticas

### Commands
1. **Una responsabilidad**: Un comando = una acción
2. **Validación explícita**: Siempre validar en `validate()`
3. **Emitir eventos**: Comunicar cambios vía EventBus
4. **Atomicidad**: La operación debe ser atómica (todo o nada)
5. **Sin dependencias externas**: Commands no dependen entre sí

### Queries
1. **Solo lectura**: NUNCA modificar estado
2. **Rápidas**: Optimizadas para velocidad
3. **Sin efectos secundarios**: Idempotentes
4. **Helpers compartidos**: usar `QueryHelpers.js` para validación de juego existente y envoltura de errores, en vez de reimplementarlo en cada query
5. **Cacheable**: Considerar caché para queries frecuentes (ver `services/RankingCache.js`, ya usado por `GetRankingQuery`/`RankingCacheHandler`)

---

## 🧪 Testing

Los tests reales están co-localizados en `application/commands/__tests__/` y
`application/queries/__tests__/`, uno por Command/Query.

```javascript
describe('JoinGameCommand', () => {
    it('rechaza un PIN inexistente', async () => {
        const command = new JoinGameCommand({
            pin: 'XXXXXX',
            nickname: 'Player1',
            socket: mockSocket
        });

        const result = await command.execute(mockDeps);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('session-not-exist');
    });
});

describe('GetGameStateQuery', () => {
    it('retorna error si el gameId no existe', async () => {
        const query = new GetGameStateQuery({ gameId: 'no-existe' });

        const result = await query.execute({ activeGames: new Map() });

        expect(result.success).toBe(false);
    });
});
```

---

## Referencias

- Código: `app/application/commands/`, `app/application/queries/`
- Pipeline que invoca los Commands: `docs/CHAIN_OF_RESPONSIBILITY_PATTERN.md`
- Eventos de dominio emitidos desde los Commands: `docs/EVENT_DRIVEN_PATTERN.md`
- Capas generales del proyecto: `docs/ARCHITECTURE.md`
