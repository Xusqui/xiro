/**
 * @fileoverview Handler para start-game event - Refactorizado con Use Case pattern
 * Simplificado de 82 líneas a ~55 líneas usando StartGameUseCase
 */

const logger = require('../../config/logger');
const { sanitizeGameStartPayload } = require('../../services/payload.sanitizer');
const { startTimer } = require('../utils/TimerManager');
const { runRandomPointsReveal } = require('../utils/RandomPointsRevealManager');
const StartGameUseCase = require('../../application/use-cases/StartGameUseCase');
const { pushSessionLog } = require('../../services/game-logs.service');

module.exports = function createStartGameHandler(dependencies) {
    const {
        activeGames,
        lobbyPlayers,
        teamConfigs,
        metrics,
        io,
        syncBus,
        socketRateLimits
    } = dependencies;

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

            // Pantalla "JUGÁIS POR XXX PUNTOS" antes de mostrar la primera pregunta.
            // Gatea el arranque del temporizador para no comerse el bonus de tiempo.
            const shouldReveal = await runRandomPointsReveal({
                game: activeGames.get(roomId),
                question: preparedQuestions[0],
                roomId,
                io,
                syncBus
            });

            if (!shouldReveal) {
                return;
            }

            // Emitir a presentador (broadcast via Redis Adapter)
            const fullPayload = {
                questions: preparedQuestions,
                players: playersInLobby,
                currentIndex: 0,
                sessionId: roomId,
                firstQuestion: preparedQuestions[0],
                totalQuestions: preparedQuestions.length,
                randomPoints: activeGames.get(roomId)?.currentRandomPoints ?? null
            };

            io.to(roomId + ':presenter').emit('game-started', fullPayload);

            // Emitir a jugadores (sanitizado, broadcast via Redis Adapter)
            const sanitizedPayload = sanitizeGameStartPayload(fullPayload);
            io.to(roomId + ':players').emit('game-started', sanitizedPayload);

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
