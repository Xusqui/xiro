/**
 * @fileoverview Handler para start-game event - Refactorizado con Use Case pattern
 * Simplificado de 82 líneas a ~55 líneas usando StartGameUseCase
 */

const logger = require('../../config/logger');
const { sanitizeGameStartPayload } = require('../../services/payload.sanitizer');
const { startTimer } = require('../utils/TimerManager');
const { runRandomPointsReveal } = require('../utils/RandomPointsRevealManager');
const { runGameIntro } = require('../utils/GameIntroManager');
const StartGameUseCase = require('../../application/use-cases/StartGameUseCase');
const { pushSessionLog } = require('../../services/game-logs.service');

// Intro y pantalla de puntos aleatorios: si alguna se interrumpe, la partida no arranca
async function passStartGates({ activeGames, roomId, io, syncBus, firstQuestion }) {
    // Intro con el logo y cuenta atrás 3-2-1-0 (si está activada en Interfaz).
    // Gatea el arranque igual que la pantalla de puntos aleatorios.
    const introDone = await runGameIntro({ activeGames, roomId, io, syncBus });
    if (!introDone) return false;

    // Pantalla "JUGÁIS POR XXX PUNTOS" antes de mostrar la primera pregunta.
    // Gatea el arranque del temporizador para no comerse el bonus de tiempo.
    return runRandomPointsReveal({
        game: activeGames.get(roomId),
        question: firstQuestion,
        roomId,
        io,
        syncBus
    });
}

function emitGameStarted({ io, roomId, game, preparedQuestions, playersInLobby }) {
    // Emitir a presentador (broadcast via Redis Adapter)
    const fullPayload = {
        questions: preparedQuestions,
        players: playersInLobby,
        currentIndex: 0,
        sessionId: roomId,
        firstQuestion: preparedQuestions[0],
        totalQuestions: preparedQuestions.length,
        randomPoints: game?.currentRandomPoints ?? null,
        // Reloj de la primera pregunta para la música del presentador
        questionStartedAt: game?.questionStartTime || Date.now(),
        serverNow: Date.now()
    };

    io.to(roomId + ':presenter').emit('game-started', fullPayload);

    // Emitir a jugadores (sanitizado, broadcast via Redis Adapter)
    const sanitizedPayload = sanitizeGameStartPayload(fullPayload);
    io.to(roomId + ':players').emit('game-started', sanitizedPayload);
}

function recordGameStarted(roomId, playersInLobby, preparedQuestions) {
    logger.info('Game started successfully', {
        roomId,
        players: playersInLobby.length,
        questions: preparedQuestions.length
    });

    pushSessionLog(roomId, {
        level: 'info',
        event: 'game-started',
        actor: 'presenter',
        message: 'Game started from presenter',
        data: {
            players: playersInLobby.length,
            questions: preparedQuestions.length
        }
    });
}

/**
 * Crea el handler del evento 'start-game'. Arranca la partida (el presentador ya está comprobado).
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, roomIdOrPin): Promise<void>} Handler
 */
module.exports = function createStartGameHandler(dependencies) {
    const { activeGames, lobbyPlayers, teamConfigs, metrics, io, syncBus, socketRateLimits } = dependencies;

    // Instanciar Use Case
    const startGameUseCase = new StartGameUseCase({
        activeGames,
        lobbyPlayers,
        teamConfigs,
        metrics,
        io,
        syncBus,
        socketRateLimits
    });

    return async function handleStartGame(socket, roomIdOrPin) {
        const roomId = roomIdOrPin;

        try {
            // Ejecutar Use Case
            const result = await startGameUseCase.execute({
                roomId,
                socket
            });

            if (!result.success) {
                socket.emit('game-start-error', {
                    message: result.error,
                    ...(result.code && { code: result.code }),
                    ...(result.params && { params: result.params })
                });
                return;
            }

            const { preparedQuestions, playersInLobby } = result;

            if (!(await passStartGates({ activeGames, roomId, io, syncBus, firstQuestion: preparedQuestions[0] }))) {
                return;
            }

            emitGameStarted({ io, roomId, game: activeGames.get(roomId), preparedQuestions, playersInLobby });
            recordGameStarted(roomId, playersInLobby, preparedQuestions);

            // Iniciar timer para primera pregunta
            if (preparedQuestions[0].time_limit) {
                startTimer(roomId, preparedQuestions[0].time_limit, io);
            }
        } catch (error) {
            logger.error('Error starting game', { roomId, error: error.message, stack: error.stack });
            socket.emit('game-start-error', { message: 'Error al iniciar el juego', code: 'GAME_START_FAILED' });
        }
    };
};
