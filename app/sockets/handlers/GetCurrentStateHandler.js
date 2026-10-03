/**
 * @fileoverview Get Current State Handler - Query-based state retrieval
 */

const { validateSocket, schemas } = require('../../validation');
const GetGameStateQuery = require('../../application/queries/GetGameStateQuery');
const { getAdapter } = require('../../domain/state/GameStateAdapter');
const { sanitizeQuestionForPlayers } = require('../../services/payload.sanitizer');
const { buildReconnectRandomPointsState } = require('../utils/RandomPointsRevealManager');

function createGetCurrentStateHandler(dependencies) {
    const { players, activeGames, lobbyPlayers } = dependencies;
    const logger = require('../../config/logger');

    return function handleGetCurrentState(socket, data) {
        // Joi da por válido un payload undefined; sin datos tiene que fallar la validación.
        // Este handler es síncrono: un throw aquí llega a uncaughtException y apaga el worker.
        const validation = validateSocket(schemas.getCurrentState, data ?? {});
        if (!validation.valid) {
            socket.emit('state-error', { message: validation.error });
            return;
        }

        const { playerId, roomId } = validation.value;
        const player = players.get(playerId);

        // Si el jugador no existe, probablemente el servidor se reinició
        if (!player) {
            logger.warn('Reconnection failed - player not found', {
                playerId,
                roomId,
                totalPlayers: players.size,
                totalGames: activeGames.size,
                reason: 'likely_server_restart'
            });

            socket.emit('state-error', {
                message: 'Session not found',
                reason: 'server_restart',
                detail: 'Your session was lost. The server may have restarted.',
                code: 'SESSION_STATE_NOT_FOUND'
            });
            return;
        }

        // Preparar estado base del jugador
        const currentState = {
            roomId,
            nickname: player.nickname,
            score: player.score || 0,
            status: player.status
        };

        // Si está en un juego activo, usar Query
        if (activeGames.has(roomId)) {
            const query = new GetGameStateQuery({
                gameId: roomId,
                includeQuestions: true,
                includeScores: true
            });

            const gameState = query.execute({ activeGames });

            if (gameState.success) {
                const adapter = getAdapter(roomId);
                const game = activeGames.get(roomId);
                let currentIndex = gameState.currentIndex;

                if (adapter && typeof adapter.syncWithLegacy === 'function') {
                    adapter.syncWithLegacy(game);
                    const adapterIndex = adapter.getCurrentQuestionIndex();
                    if (adapterIndex === game.currentIndex) {
                        currentIndex = adapterIndex;
                    }
                }

                currentState.gameState = {
                    currentIndex,
                    totalQuestions: gameState.questionCount,
                    canAnswer: adapter ? adapter.canAcceptAnswers() : gameState.canAnswer,
                    scores: gameState.scores,
                    ...buildReconnectRandomPointsState(game)
                };

                // Si hay pregunta actual, sanitizarla para jugadores
                if (game.questions && game.questions[currentIndex]) {
                    currentState.currentQuestion = sanitizeQuestionForPlayers(
                        game.questions[currentIndex]
                    );
                }
            }
        } else {
            // Está en lobby
            const lobby = lobbyPlayers.get(roomId);
            currentState.lobby = {
                players: lobby || [],
                count: lobby ? lobby.length : 0
            };
        }

        socket.emit('current-state', currentState);
        logger.info('Current state sent', { playerId, roomId, hasGame: activeGames.has(roomId) });
    };
}

module.exports = createGetCurrentStateHandler;
