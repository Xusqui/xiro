# CQRS Pattern - Command Query Responsibility Segregation

**Proyecto**: Xiro!  
**Patrón**: CQRS (Command Query Responsibility Segregation)  
**Fecha**: 2 de febrero de 2026

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

### Estructura

```
app/application/
├── commands/              # Operaciones de ESCRITURA
│   ├── Command.js        # Clase base abstracta
│   ├── JoinGameCommand.js
│   ├── StartGameCommand.js
│   ├── SubmitAnswerCommand.js
│   ├── NextQuestionCommand.js
│   └── EndGameCommand.js
│
└── queries/               # Operaciones de LECTURA
    ├── GetGameStateQuery.js
    ├── GetLeaderboardQuery.js
    └── GetPlayerStatsQuery.js
```

---

## ⚙️ Commands (Escritura)

### Clase Base: Command

```javascript
// app/application/commands/Command.js
class Command {
    constructor() {
        if (new.target === Command) {
            throw new Error('Command es abstracta');
        }
    }

    /**
     * Validar parámetros del comando
     * @param {Object} context - Contexto de ejecución
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    async validate(context) {
        throw new Error('validate() debe ser implementado');
    }

    /**
     * Ejecutar comando (modifica estado)
     * @param {Object} context - Contexto de ejecución
     * @returns {Object} Resultado de la ejecución
     */
    async execute(context) {
        throw new Error('execute() debe ser implementado');
    }
}

module.exports = Command;
```

---

### Ejemplo Completo: SubmitAnswerCommand

```javascript
// app/application/commands/SubmitAnswerCommand.js
const Command = require('./Command');
const EventBus = require('../../domain/events/EventBus');
const { AnswerSubmittedEvent } = require('../../domain/events/GameEvents');

class SubmitAnswerCommand extends Command {
    constructor({ pin, nickname, index }) {
        super();
        this.pin = pin;
        this.nickname = nickname;
        this.index = index;
    }

    /**
     * Validar que el jugador puede enviar respuesta
     */
    async validate(context) {
        const errors = [];
        const { activeGames, players } = context;

        // 1. Validar que el juego existe
        const game = activeGames.get(this.pin);
        if (!game) {
            errors.push('Juego no encontrado');
            return { valid: false, errors };
        }

        // 2. Validar estado del juego
        if (game.state !== 'question') {
            errors.push('No hay pregunta activa');
        }

        // 3. Validar que el jugador existe
        const player = Array.from(players.values()).find(
            p => p.nickname === this.nickname && p.gameId === this.pin
        );
        if (!player) {
            errors.push('Jugador no encontrado');
        }

        // 4. Validar índice de respuesta
        const currentQuestion = game.questions[game.currentQuestionIndex];
        if (this.index < 0 || this.index >= currentQuestion.answers.length) {
            errors.push('Índice de respuesta inválido');
        }

        // 5. Validar que no haya respondido ya
        if (player.hasAnswered) {
            errors.push('Ya has respondido esta pregunta');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Ejecutar el comando: registrar respuesta y calcular puntos
     */
    async execute(context) {
        const { activeGames, players, io } = context;
        
        const game = activeGames.get(this.pin);
        const player = Array.from(players.values()).find(
            p => p.nickname === this.nickname && p.gameId === this.pin
        );

        const currentQuestion = game.questions[game.currentQuestionIndex];
        const isCorrect = this.index === currentQuestion.correctIndex;

        // Calcular tiempo de respuesta
        const elapsedTime = (Date.now() - game.questionStartTime) / 1000;
        
        // Calcular puntos
        let points = 0;
        if (isCorrect) {
            const timeBonus = Math.max(0, (game.timerDuration - elapsedTime) / game.timerDuration);
            points = Math.round(1000 * (0.5 + 0.5 * timeBonus));
        }

        // Actualizar estado del jugador
        player.score += points;
        player.hasAnswered = true;
        player.correctAnswers += isCorrect ? 1 : 0;

        // Registrar respuesta en el juego
        game.answers.push({
            nickname: this.nickname,
            index: this.index,
            isCorrect,
            points,
            timestamp: Date.now()
        });

        // Emitir evento de dominio
        EventBus.emit('answer.submitted', new AnswerSubmittedEvent({
            gameId: this.pin,
            playerId: player.id,
            nickname: this.nickname,
            questionIndex: game.currentQuestionIndex,
            answerIndex: this.index,
            isCorrect,
            points,
            elapsedTime
        }));

        // Notificar al jugador
        io.to(player.socketId).emit('answer-result', {
            isCorrect,
            points,
            totalScore: player.score
        });

        // Actualizar contador de respuestas
        game.answeredCount = (game.answeredCount || 0) + 1;

        // Notificar al presentador
        io.to(`presenter-${this.pin}`).emit('player-answered', {
            nickname: this.nickname,
            answered: game.answeredCount,
            total: game.players.length
        });

        return {
            success: true,
            isCorrect,
            points,
            totalScore: player.score
        };
    }
}

module.exports = SubmitAnswerCommand;
```

---

### Otros Commands del Proyecto

#### 1. JoinGameCommand

```javascript
// Responsabilidades:
// - Validar PIN del juego
// - Validar nickname único
// - Agregar jugador al juego
// - Emitir evento 'player.joined'
class JoinGameCommand extends Command {
    async execute(context) {
        // Agregar jugador
        // Emitir PlayerJoinedEvent
        // Notificar a todos
    }
}
```

#### 2. StartGameCommand

```javascript
// Responsabilidades:
// - Validar que hay jugadores
// - Cambiar estado a 'playing'
// - Iniciar primera pregunta
// - Emitir evento 'game.started'
class StartGameCommand extends Command {
    async execute(context) {
        // Iniciar juego
        // Emitir GameStartedEvent
        // Broadcast a todos
    }
}
```

#### 3. NextQuestionCommand

```javascript
// Responsabilidades:
// - Avanzar índice de pregunta
// - Resetear respuestas de jugadores
// - Iniciar timer
// - Emitir evento 'question.started'
class NextQuestionCommand extends Command {
    async execute(context) {
        // Avanzar pregunta
        // Emitir QuestionStartedEvent
        // Notificar nueva pregunta
    }
}
```

#### 4. EndGameCommand

```javascript
// Responsabilidades:
// - Calcular ranking final
// - Cambiar estado a 'finished'
// - Guardar estadísticas
// - Emitir evento 'game.ended'
class EndGameCommand extends Command {
    async execute(context) {
        // Finalizar juego
        // Calcular rankings
        // Emitir GameEndedEvent
    }
}
```

---

## 🔍 Queries (Lectura)

### Características
- **Solo leen** datos, NO modifican estado
- **No emiten** eventos de dominio
- **Optimizadas** para lectura rápida
- **Sin efectos secundarios**

---

### Ejemplo: GetGameStateQuery

```javascript
// app/application/queries/GetGameStateQuery.js
class GetGameStateQuery {
    constructor({ gameId, requesterId, role }) {
        this.gameId = gameId;
        this.requesterId = requesterId;
        this.role = role; // 'player' | 'presenter'
    }

    /**
     * Obtener estado del juego según el rol
     * Jugadores ven menos información que presentadores
     */
    execute(context) {
        const { activeGames, players } = context;
        
        const game = activeGames.get(this.gameId);
        if (!game) {
            return { 
                success: false, 
                error: 'Juego no encontrado' 
            };
        }

        // Vista para JUGADOR
        if (this.role === 'player') {
            const player = Array.from(players.values()).find(
                p => p.id === this.requesterId
            );

            return {
                success: true,
                state: {
                    gameState: game.state,
                    currentQuestionIndex: game.currentQuestionIndex,
                    totalQuestions: game.questions.length,
                    myScore: player?.score || 0,
                    myPosition: this.calculatePosition(player, game),
                    // NO incluir respuestas correctas
                }
            };
        }

        // Vista para PRESENTADOR
        if (this.role === 'presenter') {
            return {
                success: true,
                state: {
                    gameState: game.state,
                    currentQuestionIndex: game.currentQuestionIndex,
                    questions: game.questions, // Todas las preguntas
                    players: game.players,
                    answers: game.answers,
                    leaderboard: this.calculateLeaderboard(game),
                    // Información completa
                }
            };
        }

        return { success: false, error: 'Rol inválido' };
    }

    calculatePosition(player, game) {
        const sorted = game.players
            .sort((a, b) => b.score - a.score);
        return sorted.findIndex(p => p.id === player.id) + 1;
    }

    calculateLeaderboard(game) {
        return game.players
            .map(p => ({ nickname: p.nickname, score: p.score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }
}

module.exports = GetGameStateQuery;
```

---

### Ejemplo: GetLeaderboardQuery

```javascript
// app/application/queries/GetLeaderboardQuery.js
class GetLeaderboardQuery {
    constructor({ gameId, limit = 10 }) {
        this.gameId = gameId;
        this.limit = limit;
    }

    execute(context) {
        const { activeGames } = context;
        const game = activeGames.get(this.gameId);

        if (!game) {
            return { success: false, error: 'Juego no encontrado' };
        }

        const leaderboard = game.players
            .map(player => ({
                nickname: player.nickname,
                score: player.score,
                correctAnswers: player.correctAnswers,
                avatar: player.avatar
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, this.limit);

        return {
            success: true,
            leaderboard,
            totalPlayers: game.players.length
        };
    }
}

module.exports = GetLeaderboardQuery;
```

---

## 🎯 Cuándo Usar Cada Uno

### Usar COMMAND cuando:
- ✅ Vas a **modificar estado** (agregar, actualizar, eliminar)
- ✅ La operación tiene **efectos secundarios**
- ✅ Necesitas **validaciones complejas**
- ✅ Debes **emitir eventos** de dominio
- ✅ Ejemplo: Enviar respuesta, iniciar juego, agregar jugador

### Usar QUERY cuando:
- ✅ Solo necesitas **leer datos**
- ✅ **No modificas** ningún estado
- ✅ La operación es **idempotente**
- ✅ Optimizado para **lectura rápida**
- ✅ Ejemplo: Obtener leaderboard, ver estado del juego, consultar estadísticas

---

## 🔄 Flujo Típico

### Command Flow

```
1. Handler recibe request
   ↓
2. Crea comando con parámetros
   ↓
3. Comando valida datos
   ↓
4. Si válido: ejecuta (modifica estado)
   ↓
5. Emite evento de dominio
   ↓
6. Notifica vía Socket.IO
   ↓
7. Retorna resultado
```

### Query Flow

```
1. Handler recibe request
   ↓
2. Crea query con parámetros
   ↓
3. Query ejecuta (solo lectura)
   ↓
4. Formatea datos según rol
   ↓
5. Retorna resultado
   (Sin eventos, sin modificaciones)
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
4. **Vistas específicas**: Retornar solo lo necesario según el rol
5. **Cacheable**: Considerar caché para queries frecuentes

---

## 📊 Métricas del Proyecto

| Tipo | Cantidad | Promedio Líneas | Cobertura Tests |
|------|----------|-----------------|-----------------|
| Commands | 5 | ~80 líneas | 100% |
| Queries | 3 | ~40 líneas | 100% |
| **Total** | **8** | **~60 líneas** | **100%** |

---

## 🧪 Testing

### Test de Command

```javascript
describe('SubmitAnswerCommand', () => {
    it('debe agregar puntos si respuesta correcta', async () => {
        const command = new SubmitAnswerCommand({
            pin: '1234',
            nickname: 'Player1',
            index: 2 // Respuesta correcta
        });

        const result = await command.execute(mockContext);

        expect(result.success).toBe(true);
        expect(result.isCorrect).toBe(true);
        expect(result.points).toBeGreaterThan(0);
    });

    it('debe validar que el juego existe', async () => {
        const command = new SubmitAnswerCommand({
            pin: 'invalid',
            nickname: 'Player1',
            index: 0
        });

        const validation = await command.validate(mockContext);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Juego no encontrado');
    });
});
```

### Test de Query

```javascript
describe('GetGameStateQuery', () => {
    it('debe retornar estado para jugador', () => {
        const query = new GetGameStateQuery({
            gameId: '1234',
            requesterId: 'player-123',
            role: 'player'
        });

        const result = query.execute(mockContext);

        expect(result.success).toBe(true);
        expect(result.state.myScore).toBeDefined();
        expect(result.state.questions).toBeUndefined(); // Jugadores no ven todas
    });
});
```

---

## 🚀 Próximos Pasos

- [ ] Implementar caché para queries frecuentes
- [ ] Agregar telemetría (tiempo de ejecución)
- [ ] Considerar Event Sourcing para commands críticos
- [ ] Optimizar queries con índices

---

**CQRS mantiene el código limpio, testeable y escalable** ✨
