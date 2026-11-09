/**
 * @fileoverview Get Current State Handler - Query-based state retrieval
 */

const { validateSocket, schemas } = require('../../validation');
const GetGameStateQuery = require('../../application/queries/GetGameStateQuery');
const { getAdapter } = require('../../domain/state/GameStateAdapter');
const { sanitizeQuestionForPlayers } = require('../../services/payload.sanitizer');
const { buildReconnectRandomPointsState } = require('../utils/RandomPointsRevealManager');
const { buildReconnectIntroState } = require('../utils/GameIntroManager');
const { closedWhileReviewing } = require('../../domain/services/SlideNavigationPolicy');

function emitSessionNotFound(socket, { playerId, roomId, players, activeGames }) {
    const logger = require('../../config/logger');
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
}

function resolveCurrentIndex(adapter, game, queriedIndex) {
    if (adapter && typeof adapter.syncWithLegacy === 'function') {
        adapter.syncWithLegacy(game);
        const adapterIndex = adapter.getCurrentQuestionIndex();
        if (adapterIndex === game.currentIndex) return adapterIndex;
    }
    return queriedIndex;
}

function appendActiveGameState(currentState, roomId, activeGames) {
    const query = new GetGameStateQuery({
        gameId: roomId,
        includeQuestions: true,
        includeScores: true
    });

    const gameState = query.execute({ activeGames });
    if (!gameState.success) return;

    const adapter = getAdapter(roomId);
    const game = activeGames.get(roomId);
    const currentIndex = resolveCurrentIndex(adapter, game, gameState.currentIndex);

    currentState.gameState = {
        currentIndex,
        totalQuestions: gameState.questionCount,
        // En revisión (juegos personalizados) la diapositiva ya se jugó
        canAnswer: closedWhileReviewing(game, adapter ? adapter.canAcceptAnswers() : gameState.canAnswer),
        reviewMode: Boolean(game.reviewMode),
        scores: gameState.scores,
        ...buildReconnectIntroState(game),
        ...buildReconnectRandomPointsState(game)
    };

    // Si hay pregunta actual, sanitizarla para jugadores
    if (game.questions && game.questions[currentIndex]) {
        currentState.currentQuestion = sanitizeQuestionForPlayers(game.questions[currentIndex]);
    }
}

function buildLobbyState(lobby) {
    return {
        players: lobby || [],
        count: lobby ? lobby.length : 0
    };
}

/**
 * Crea el handler del evento 'get-current-state': devuelve al cliente el estado actual de su sala (lobby, pregunta o
 * revisión). Es síncrono.
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, data): void} Handler
 */
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
            emitSessionNotFound(socket, { playerId, roomId, players, activeGames });
            return;
        }

        // Preparar estado base del jugador
        const currentState = {
            roomId,
            nickname: player.nickname,
            score: player.score || 0,
            status: player.status
        };

        if (activeGames.has(roomId)) {
            appendActiveGameState(currentState, roomId, activeGames);
        } else {
            currentState.lobby = buildLobbyState(lobbyPlayers.get(roomId));
        }

        socket.emit('current-state', currentState);
        logger.info('Current state sent', { playerId, roomId, hasGame: activeGames.has(roomId) });
    };
}

module.exports = createGetCurrentStateHandler;
