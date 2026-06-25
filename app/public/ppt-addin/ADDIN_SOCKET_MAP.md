# ADDIN_SOCKET_MAP — Xiro! Add-in (arquitectura por diapositivas)

## Eventos Socket.IO — Presentador → Servidor

| Acción del presentador | Evento | Payload | Respuesta servidor |
|---|---|---|---|
| Unirse como presentador (crear lobby) | `join-lobby` | `{ pin, sessionId, nickname: 'HOST', playerId, isTeamMode, teamConfig? }` | `join-success` ó `join-error` |
| Iniciar juego | `start-game` | `roomId` (string — el sessionId) | `game-started` → sala `:presenter` |
| Avanzar a siguiente pregunta | `next-question` | `roomId` | `new-question` a todos |
| Revelar respuesta manual | `reveal-answer` | `roomId` | `reveal-answer` → sala `:presenter` |
| Finalizar juego | `end-game` | `{ pin, reason? }` | `game-ended` con ranking |
| Reconectar presentador | `reconnect-presenter` | `{ playerId }` | `reconnected-success` ó `reconnect-failed` |
| Obtener estado actual | `get-current-state` | `{ playerId, roomId }` | `current-state` |
| Pausar timer | `pause-timer` | `roomId` | `timer-paused` a sala |
| Reanudar timer | `resume-timer` | `roomId` | `timer-resumed` a sala |

## Eventos Socket.IO — Servidor → Presentador

| Evento | Payload | Cuándo |
|---|---|---|
| `join-success` | `{ roomId, playersInLobby, teamMode? }` | Lobby creado |
| `join-error` | `{ message, reason }` | Error al crear lobby |
| `player-joined` | `{ nickname, ... }` | Jugador entra al lobby |
| `game-started` | `{ questions, players, firstQuestion, totalQuestions, currentIndex, sessionId }` | Juego iniciado |
| `new-question` | `{ question, totalQuestions, currentIndex }` | Siguiente pregunta |
| `answer-result` | `{ nickname, isCorrect, points, totalScore, streakInfo }` | Respuesta individual |
| `reveal-answer` | `{ correctIndex, correctAnswer, justification, stats, percentages, ranking, timeExpired, correctOrder?, correctIndices? }` | Revelar respuesta |
| `ranking-update` | `{ ranking: [{nickname, score, team}] }` | Actualización parcial |
| `game-ended` | `ranking` (array `{name, pts, team}`) | Fin de partida |
| `timer-paused` | `{ remainingTime }` | Timer pausado |
| `timer-resumed` | `{ remainingTime }` | Timer reanudado |
| `reconnected-success` | snapshot completo del estado | Reconexión OK |
| `results-ready` | `{ sessionId: dbId }` | Resultados persistidos en BD |

## Notas clave

- **PIN vs sessionId**: El presentador genera `sessionId = PIN-XXXX` (PIN + sufijo aleatorio). Se usa como `roomId` en todos los eventos.
- **Salas Socket.IO**: El presentador se une a `roomId` y `roomId:presenter`. Los jugadores se unen a `roomId` y `roomId:players`.
- **Timer**: No hay evento `timer-tick`. El cliente gestiona countdown local usando `time_limit` de la pregunta. El servidor auto-revela cuando caduca.
- **Ranking parcial**: Incluido en el payload de `reveal-answer` como `ranking`. No hay endpoint REST separado.
- **Reconexión**: `reconnect-presenter` requiere `playerId` (no sessionId). El servidor busca al jugador por playerId.
- **Estado para reconexión de diálogo**: `get-current-state` devuelve `{ gameState: { currentIndex, totalQuestions, canAnswer, scores }, currentQuestion }`.

## API REST relevante

| Endpoint | Auth | Uso |
|---|---|---|
| `GET /api/presenter-pins` | No | Listar juegos disponibles |
| `GET /api/quizzes/validate/:pin` | No | Validar PIN y obtener gameId |
| `GET /api/results/session/:id/export.csv` | No | Descargar CSV resultados |
.md
## Mapa de Eventos Socket.IO — Xiro! PowerPoint Add-in

> Generado a partir de análisis de:
> - `/app/sockets/handlers/`
> - `/app/public/js/presenter/presenter-socket-*.js`
> - `/app/sockets/services/ReconnectionService.js`

---

## Configuración de Conexión

```javascript
io({
  auth: { playerId },          // UUID estable del presentador (persistent en localStorage)
  transports: ['websocket'],
  upgrade: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
  path: '/socket.io/',
  withCredentials: false,
  // Sin URL: conecta al mismo origen que el HTML
})
```

---

## Eventos que el Add-in EMITE al Servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `join-lobby` | `{ pin, sessionId, nickname: 'HOST', playerId, isTeamMode, teamConfig? }` | Crear sala como presentador/host |
| `start-game` | `sessionId` (string) | Iniciar la partida |
| `next-question` | `sessionId` (string) | Avanzar a la siguiente pregunta |
| `reveal-answer` | `sessionId` (string) | Revelar respuesta manualmente |
| `pause-timer` | `sessionId` (string) | Pausar el timer |
| `resume-timer` | `sessionId` (string) | Reanudar el timer |
| `end-game` | `{ roomIdOrPin, reason }` | Terminar juego manualmente |
| `reconnect-presenter` | `{ playerId }` | Reconectar presentador tras desconexión |

> **Nota sobre `sessionId`**: el formato generado en cliente es `PIN-XXXX`
> donde XXXX son 4 dígitos aleatorios. El servidor devuelve `roomId` en
> `join-success` y se debe usar ese valor desde ese momento.

---

## Eventos que el Add-in RECIBE del Servidor

### Fase: Lobby

| Evento | Payload | Origen Handler |
|--------|---------|----------------|
| `join-success` | `{ roomId, teamMode, playerId, players[] }` | `JoinLobbyHandler.js` |
| `join-error` | `{ message, reason }` | `JoinLobbyHandler.js` |
| `player-joined` | `{ nickname, players[] }` | `JoinLobbyHandler.js` (broadcast a la sala) |
| `player-left` | `{ nickname, players[] }` | `DisconnectHandler.js` |

### Fase: Juego

| Evento | Payload | Origen Handler |
|--------|---------|----------------|
| `game-started` | `{ questions[], players[], currentIndex, sessionId, firstQuestion, totalQuestions }` | `StartGameHandler.js` → room `:presenter` |
| `game-start-error` | `{ message }` | `StartGameHandler.js` |
| `new-question` | `{ question, currentIndex, totalQuestions }` | `QuestionHandlers.js` |
| `answer-result` | `{ nickname, isCorrect, points, totalScore, streakInfo }` | `SubmitAnswerHandler.js` |
| `answer-result-batch` | `{ answers[] }` | `SubmitAnswerHandler.js` |
| `ranking-update` | `{ ranking[] }` | varios |
| `reveal-answer` | `{ correctAnswer, stats, justification?, ... }` | `QuestionHandlers.js` |
| `timer-paused` | `{ remainingTime }` | `SimpleHandlers.js` |
| `timer-resumed` | `{ remainingTime }` | `SimpleHandlers.js` |
| `game-ended` | `ranking[]` (con ack opcional) | `EndGameHandler.js` / `AbandonGameHandler.js` |
| `results-ready` | `{ sessionId }` | post-game persistence |

### Reconexión

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `reconnected-success` | `{ sessionId, pin, gameState, lobbyPlayers, teamMode, ... }` | Snapshot del estado para restaurar UI |
| `reconnect-failed` | `{ reason, message, waitTime? }` | Fallo de reconexión |

#### Razones de `reconnect-failed`:
- `not-found` — playerId no existe en servidor (reinicio?)
- `invalid-data` — payload inválido
- `invalid-role` — playerId no es un presentador
- `invalid-state` — estado inválido para reconexión
- `rate-limited` — demasiados intentos

#### Snapshot de `reconnected-success`:
```javascript
{
  sessionId: string,
  pin: string,
  teamMode: { isTeamMode, teams?, ... } | null,
  gameState: {
    isGameActive: boolean,
    currentIndex: number,
    totalQuestions: number,
    scores: { [nickname]: number },
    players: string[],
    currentQuestion?: { ... }   // pregunta actual si juego activo
  } | null,
  lobbyPlayers: string[]        // jugadores si en lobby
}
```

---

## Endpoints REST (sin autenticación)

| Método | Ruta | Respuesta | Uso |
|--------|------|-----------|-----|
| `GET` | `/api/presenter-pins` | `[{pin, name, type, question_count}]` | Cargar lista de juegos disponibles |
| `GET` | `/api/quizzes/validate/:pin` | `{exists, gameType, gameId}` | Validar PIN antes de crear sesión |

> **Nota**: `GET /api/games` y `GET /api/games/:id` requieren `authenticateAdmin`
> y NO son accesibles desde el add-in. Usar `/api/presenter-pins`.

---

## Flujo de Sesión

```
1. GET /api/presenter-pins            → lista de juegos
2. GET /api/quizzes/validate/:pin     → verificar PIN
3. emit join-lobby                    → crear sala (sessionId local generado)
4. recv join-success                  → usar roomId del servidor como sessionId real
5. emit start-game(sessionId)         → iniciar partida
6. recv game-started                  → comenzar presentación de preguntas
7. [loop] emit next-question          → avanzar pregunta
7. [loop] recv new-question           → mostrar nueva pregunta
8. [opt]  emit reveal-answer          → revelar respuesta manualmente
8. [opt]  recv reveal-answer          → mostrar corrección
9. recv game-ended                    → mostrar podio
10. recv results-ready                → link de descarga de CSV
```

---

## Reconexión (protocolo)

```
1. Socket.IO auto-reconnect (motores internos)
2. Al reconectar (evento `reconnect` del manager), emitir:
   emit reconnect-presenter({ playerId })
3. recv reconnected-success  → restaurar UI desde snapshot
   recv reconnect-failed     → mostrar error, ofrecer retry o nueva sesión
4. Si playerId no existe (servidor reiniciado): ofrecer "Volver a juegos"
```

---

## Rooms en el Servidor

- El presentador se une a `roomId` y a `roomId + ':presenter'`
- Los jugadores se unen a `roomId` y a `roomId + ':players'`
- `game-started` se emite a `roomId + ':presenter'` (payload completo con preguntas)
- Los jugadores reciben payload sanitizado (sin respuestas correctas)

---

## Marcadores XIRO en Notas del Orador (Diapositivas)

Formato de metadatos en notas del orador para control automático:

```
XIRO:{"role":"lobby","gameId":null}   → diapositiva de QR + espera
XIRO:{"role":"question","index":0}    → pregunta #1
XIRO:{"role":"question","index":1}    → pregunta #2
XIRO:{"role":"podio"}                 → podio final
```

Diapositivas sin marcador `XIRO:` en notas son **ignoradas** por el add-in.
