/**
 * @fileoverview Reconnection Service - Lógica compartida para reconexiones
 */

const { roundScore } = require('../../domain/services/ScoringService');
const { sanitizeQuestionForPlayers } = require('../../services/payload.sanitizer');
const runtimeConfig = require('../../config/runtime-config');
const logger = require('../../config/logger');
const { getRedisClient } = require('../../config/redis');
const { RedisSyncBus } = require('../sync/RedisSyncBus');

// Lazy-loaded to avoid circular dependencies (GameStateAdapter ↔ services)
let _getAdapter = null;
function getAdapterLazy(roomId) {
    if (!_getAdapter) {
        _getAdapter = require('../../domain/state/GameStateAdapter').getAdapter;
    }
    return _getAdapter(roomId);
}

/**
 * Verifica si un nickname está duplicado en lobby o juego
 */
function checkNicknameDuplicate(nickname, roomId, lobbyPlayers, game) {
    const normalizedNickname = nickname.toLowerCase();

    // Verificar en lobby
    const lobby = lobbyPlayers.get(roomId);
    if (lobby) {
        const isDuplicateInLobby = lobby.some(p =>
            p.toLowerCase() === normalizedNickname && p !== nickname
        );
        if (isDuplicateInLobby) {
            return { duplicate: true, location: 'lobby' };
        }
    }

    // Verificar en juego
    if (game && game.players) {
        const isDuplicateInGame = game.players.some(p =>
            p.toLowerCase() === normalizedNickname && p !== nickname
        );
        if (isDuplicateInGame) {
            return { duplicate: true, location: 'game' };
        }
    }

    return { duplicate: false };
}

/**
 * Desconecta socket anterior si existe (maneja colisiones)
 */
function disconnectOldSocket(player, socket, io, socketToPlayer) {
    if (player.socketId && player.socketId !== socket.id) {
        const oldSocketId = player.socketId;
        io.to(oldSocketId).emit('force-disconnect', { reason: 'replaced' });
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
            oldSocket.disconnect(true);
        }
        socketToPlayer.delete(oldSocketId);
    }
}

/**
 * Actualiza estado del jugador al reconectar
 */
function updatePlayerState(player, socket, playerId, game, socketToPlayer) {
    player.socketId = socket.id;
    player.status = game ? 'connected' : 'lobby_waiting';
    player.lastSeen = Date.now();
    player.disconnectedAt = null;
    player.expiresAt = null;

    // CRITICAL: Normalize answeredQuestions to Set (may be Array or plain object after Redis sync)
    if (!(player.answeredQuestions instanceof Set)) {
        if (Array.isArray(player.answeredQuestions)) {
            player.answeredQuestions = new Set(player.answeredQuestions);
        } else if (player.answeredQuestions && typeof player.answeredQuestions === 'object') {
            player.answeredQuestions = new Set(Object.values(player.answeredQuestions));
        } else {
            player.answeredQuestions = new Set();
        }
    }

    socketToPlayer.set(socket.id, playerId);
}

/**
 * Configura rooms y socket.data para un jugador
 */
async function setupPlayerSocket(socket, roomId, nickname, playerId, isPresenter) {
    await socket.join(roomId);

    if (isPresenter) {
        await socket.join(roomId + ':presenter');
        socket.data.role = 'presenter';
    } else {
        await socket.join(roomId + ':players');
        socket.data.role = 'player';
    }

    socket.data.pin = roomId;
    socket.data.nickname = nickname;
    socket.data.playerId = playerId;
    socket.data.answeredQuestions = [];
    socket.data.answers = {};
}

/**
 * Re-añade jugador a lobby/game si es necesario
 */
function reAddToLobbyOrGame(nickname, roomId, game, lobbyPlayers) {
    if (game && game.players && !game.players.includes(nickname)) {
        game.players.push(nickname);
    }

    const lobby = lobbyPlayers.get(roomId);
    if (!game && lobby && !lobby.includes(nickname)) {
        lobby.push(nickname);
    }
}

function hasPlayerAnsweredCurrentQuestion(player, currentQuestionIndex) {
    const indexAsNumber = Number(currentQuestionIndex);
    const indexAsString = String(currentQuestionIndex);

    if (player.answers) {
        if (player.answers[currentQuestionIndex] !== undefined) {
            return true;
        }
        if (player.answers[indexAsString] !== undefined) {
            return true;
        }
    }

    const isTeamPlayer = (player.teamIndex !== undefined && player.teamIndex !== null) || !!player.teamName;
    if (isTeamPlayer) {
        return false;
    }

    if (player.answeredQuestions instanceof Set) {
        if (player.answeredQuestions.has(indexAsNumber) || player.answeredQuestions.has(indexAsString)) {
            return true;
        }
    }

    if (Array.isArray(player.answeredQuestions)) {
        if (player.answeredQuestions.includes(indexAsNumber) || player.answeredQuestions.includes(indexAsString)) {
            return true;
        }
    }

    return false;
}

/**
 * Construye snapshot de gameState para reconexión de jugador
 */
function buildGameStateSnapshot(game, player, roomId) {
    const adapter = getAdapterLazy(roomId);
    let currentQuestionIndex = game.currentIndex;

    if (adapter && typeof adapter.syncWithLegacy === 'function') {
        adapter.syncWithLegacy(game);
        const adapterIndex = adapter.getCurrentQuestionIndex();
        if (adapterIndex === game.currentIndex) {
            currentQuestionIndex = adapterIndex;
        }
    }
    const currentQuestion = game.questions[currentQuestionIndex];

    // In Trivial every round reuses currentIndex=0. Use the epoch-based check to
    // avoid a false positive where player.answers[0] from a previous round makes
    // the system think the player already answered the current round's question.
    let hasAnswered;
    if (game.isTrivial && game.trivialQuestionEpoch !== undefined) {
        hasAnswered = (player.trivialAnswerEpoch === game.trivialQuestionEpoch);
    } else {
        hasAnswered = hasPlayerAnsweredCurrentQuestion(player, currentQuestionIndex);
    }

    // Determine if player can answer
    let canAnswer;
    let canAcceptAnswers;

    if (adapter) {
        // Adapter exists - use its state BUT override if player hasn't answered
        canAcceptAnswers = adapter.canAcceptAnswers();

        // CRITICAL: If player hasn't answered this question, they should be able to
        // answer regardless of adapter state (adapter may say false because other
        // players finished while this player was disconnected)
        if (!hasAnswered) {
            canAnswer = true;  // Always allow if player hasn't answered yet
        } else {
            canAnswer = false;  // Player already answered
        }
    } else {
        // No adapter yet (game just started, before first next-question)
        // Fallback to game state
        canAcceptAnswers = game.canAnswer !== undefined ? game.canAnswer : true;
        canAnswer = canAcceptAnswers && !hasAnswered;
    }

    logger.debug('[RECONNECT DEBUG BACKEND] buildGameStateSnapshot:', {
        roomId,
        nickname: player.nickname,
        currentIndex: currentQuestionIndex,
        hasAdapter: !!adapter,
        canAcceptAnswers: canAcceptAnswers,
        hasAnswered: hasAnswered,
        answeredQuestions: player.answeredQuestions instanceof Set
            ? Array.from(player.answeredQuestions)
            : player.answeredQuestions,
        canAnswer: canAnswer,
        gameCanAnswer: game.canAnswer,
        reasoning: hasAnswered ? 'player already answered' : 'player can answer (not answered yet)'
    });

    return {
        currentQuestionIndex: currentQuestionIndex,
        currentQuestion: sanitizeQuestionForPlayers(currentQuestion),
        totalQuestions: game.questions.length,
        canAnswer: canAnswer,
        timeRemaining: adapter && canAcceptAnswers
            ? Math.max(0, runtimeConfig.get('QUESTION_TIME_LIMIT') - (Date.now() - game.questionStartTime) / 1000)
            : null
    };
}

/**
 * Construye ranking para snapshot
 */
function buildRankingSnapshot(game) {
    return Object.entries(game.scores || {})
        .map(([name, score]) => ({ nickname: name, score: roundScore(score) }))
        .sort((a, b) => b.score - a.score)
        .map((p, idx) => ({ position: idx + 1, ...p }));
}

/**
 * Restaura las rachas de un jugador desde Redis en el objeto game en memoria.
 * Esto asegura que el servidor tenga la racha actualizada para aplicar bonus
 * y mostrar el badge en el presentador.
 * También sincroniza con otros workers vía Redis pub/sub.
 * @param {Object} game - Objeto del juego en memoria
 * @param {string} nickname - Nickname del jugador
 * @param {string} roomId - Room ID del juego
 */
async function restorePlayerStreaksFromRedis(game, nickname, roomId) {
    if (!game) return;

    try {
        const redis = await getRedisClient();
        const streakKey = game.isTrivial ? `trivial:streaks:${roomId}` : `game:streaks:${roomId}`;
        const streakInfoKey = game.isTrivial ? `trivial:streakinfos:${roomId}` : `game:streakinfos:${roomId}`;

        // Cargar streak numérica
        const streakValue = await redis.hGet(streakKey, nickname);
        if (streakValue !== null) {
            const streak = Number(streakValue);
            if (!game.playerStreaks) game.playerStreaks = {};
            game.playerStreaks[nickname] = streak;
            logger.debug('[RECONNECT] Restored player streak from Redis', {
                roomId,
                nickname,
                streak
            });

            // Cargar streakInfo completa
            const streakInfoStr = await redis.hGet(streakInfoKey, nickname);
            let streakInfo = null;
            if (streakInfoStr) {
                streakInfo = JSON.parse(streakInfoStr);
                if (!game.playerStreakInfos) game.playerStreakInfos = {};
                game.playerStreakInfos[nickname] = streakInfo;
                logger.debug('[RECONNECT] Restored player streakInfo from Redis', {
                    roomId,
                    nickname,
                    streakInfo
                });
            }

            // Sincronizar con otros workers vía Redis pub/sub
            try {
                const syncBus = RedisSyncBus.getInstance();
                await syncBus.publishStreakRestored(roomId, nickname, streak, streakInfo);
            } catch (syncErr) {
                logger.warn('[RECONNECT] Failed to publish streak restored sync', {
                    roomId,
                    nickname,
                    error: syncErr.message
                });
            }
        }
    } catch (err) {
        logger.warn('[RECONNECT] Failed to restore player streaks from Redis', {
            roomId,
            nickname,
            error: err.message
        });
    }
}

/**
 * Construye snapshot completo para reconexión de jugador
 */
async function buildPlayerSnapshot(player, roomId, game, teamConfigs, trivialBoardInfo = null) {
    const snapshot = {
        playerId: player.id,
        nickname: player.nickname,
        roomId: roomId,
        score: roundScore(player.score)
    };

    // Trivial board phase (dice / cell / category): skip normal snapshot so the
    // "ya has contestado" path is never triggered. The UseCase re-emits the exact
    // board event immediately after reconnected-success.
    if (trivialBoardInfo?.isBoardPhase) {
        snapshot.gameState = { isTrivial: true, isTrivialBoardPhase: true };
        return snapshot;
    }

    const gameHasStarted = game && game.questions && game.questions.length > 0 &&
        game.questionStartTime;

    if (gameHasStarted) {
        snapshot.gameState = buildGameStateSnapshot(game, player, roomId);
        snapshot.ranking = buildRankingSnapshot(game);

        // Intentar incluir información de racha del jugador
        // Primero desde memoria, luego desde Redis como fallback
        let streakInfo = game.playerStreakInfos?.[player.nickname];

        if (!streakInfo) {
            try {
                const redis = await getRedisClient();
                const streakInfoKey = game.isTrivial ? `trivial:streakinfos:${roomId}` : `game:streakinfos:${roomId}`;
                const streakInfoStr = await redis.hGet(streakInfoKey, player.nickname);
                if (streakInfoStr) {
                    streakInfo = JSON.parse(streakInfoStr);
                    logger.debug('[RECONNECT] Streak info loaded from Redis', {
                        roomId,
                        nickname: player.nickname,
                        streakInfo
                    });
                }
            } catch (err) {
                logger.warn('[RECONNECT] Failed to load streak info from Redis', {
                    roomId,
                    nickname: player.nickname,
                    error: err.message
                });
            }
        }

        if (streakInfo) {
            snapshot.streakInfo = streakInfo;
            logger.debug('[RECONNECT] Including streak info in snapshot', {
                roomId,
                nickname: player.nickname,
                streakInfo: snapshot.streakInfo
            });
        }
    } else {
        snapshot.gameState = null;

        // En modo equipos, enviar configuración
        const teamConfig = teamConfigs.get(roomId);
        if (teamConfig && teamConfig.isTeamMode) {
            snapshot.teamMode = teamConfig;

            if (player.teamIndex !== undefined && player.teamIndex !== null) {
                snapshot.playerTeam = {
                    teamIndex: player.teamIndex,
                    teamName: player.teamName
                };
            }
        }
    }

    return snapshot;
}

/**
 * Construye snapshot para reconexión de presentador
 */
function normalizePresenterSnapshotInput(input, legacyArgs) {
    if (input && typeof input === 'object' && input.player) {
        return input;
    }

    return {
        player: input,
        roomId: legacyArgs[0],
        game: legacyArgs[1],
        teamConfigs: legacyArgs[2],
        lobbyPlayers: legacyArgs[3],
        players: legacyArgs[4]
    };
}

function buildPresenterBaseSnapshot(player, roomId) {
    return {
        playerId: player.id,
        nickname: player.nickname,
        roomId,
        pin: roomId.includes('-') ? roomId.split('-')[0] : roomId,
        sessionId: roomId
    };
}

function collectAllPlayersInRoom(players, roomId) {
    if (!players) {
        return null;
    }

    const allPlayersInRoom = [];
    for (const [id, player] of players.entries()) {
        if (player.roomId !== roomId || player.nickname === 'HOST') {
            continue;
        }

        allPlayersInRoom.push({
            playerId: id,
            nickname: player.nickname,
            score: player.score || 0,
            status: player.status || 'connected',
            lastSeen: player.lastSeen,
            expiresAt: player.expiresAt
        });
    }

    return allPlayersInRoom;
}

function resolvePresenterCurrentQuestion(game, roomId) {
    const adapter = getAdapterLazy(roomId);
    let currentQuestionIndex = game.currentIndex;

    if (adapter && typeof adapter.syncWithLegacy === 'function') {
        adapter.syncWithLegacy(game);
        const adapterIndex = adapter.getCurrentQuestionIndex();
        if (adapterIndex === game.currentIndex) {
            currentQuestionIndex = adapterIndex;
        }
    }

    return { adapter, currentQuestionIndex };
}

function buildPresenterGameState(game, roomId) {
    const { adapter, currentQuestionIndex } = resolvePresenterCurrentQuestion(game, roomId);
    const gameState = {
        currentQuestionIndex,
        totalQuestions: game.questions.length,
        isGameActive: game.questions && game.questions.length > 0,
        canAnswer: adapter ? adapter.canAcceptAnswers() : false,
        players: game.players || [],
        scores: game.scores || {}
    };

    if (game.questions && game.questions[currentQuestionIndex]) {
        gameState.currentQuestion = game.questions[currentQuestionIndex];
    }

    return gameState;
}

function appendPresenterTeamAndLobby(snapshot, roomId, teamConfigs, lobbyPlayers) {
    const teamConfig = teamConfigs.get(roomId);
    if (teamConfig && teamConfig.isTeamMode) {
        snapshot.teamMode = teamConfig;
    }

    const lobbyList = lobbyPlayers.get(roomId);
    if (lobbyList) {
        snapshot.lobbyPlayers = lobbyList;
    }
}

function buildPresenterSnapshot(input, ...legacyArgs) {
    const {
        player,
        roomId,
        game,
        teamConfigs,
        lobbyPlayers,
        players
    } = normalizePresenterSnapshotInput(input, legacyArgs);

    const snapshot = {
        ...buildPresenterBaseSnapshot(player, roomId)
    };

    // Incluir información de TODOS los jugadores (conectados y desconectados)
    const allPlayersInRoom = collectAllPlayersInRoom(players, roomId);
    if (allPlayersInRoom) {
        snapshot.allPlayers = allPlayersInRoom;
    }

    if (game) {
        snapshot.gameState = buildPresenterGameState(game, roomId);
    }

    appendPresenterTeamAndLobby(snapshot, roomId, teamConfigs, lobbyPlayers);

    return snapshot;
}

/**
 * Orquesta la reconexión completa de un jugador.
 * Busca al jugador, desconecta el socket anterior, actualiza estado,
 * configura el nuevo socket y lo re-añade a la sala/lobby.
 * @param {Object} params
 * @returns {Promise<{success: boolean, player?: Object, reason?: string, message?: string}>}
 */
async function reconnectPlayer({ socket, nickname, roomId, game, players, socketToPlayer, lobbyPlayers, io }) {
    // Buscar jugador por nickname en el mapa de players
    let playerId = null;
    let player = null;

    for (const [id, p] of players.entries()) {
        if (p.nickname === nickname && p.roomId === roomId) {
            playerId = id;
            player = p;
            break;
        }
    }

    if (!player) {
        return {
            success: false,
            reason: 'player-not-found',
            message: 'Jugador no encontrado en la partida'
        };
    }

    try {
        // 1. Desconectar socket anterior si existe
        if (io) {
            disconnectOldSocket(player, socket, io, socketToPlayer);
        }

        // 2. Actualizar estado del jugador
        updatePlayerState(player, socket, playerId, game, socketToPlayer);

        // Sync updated player data to all workers so the new socketId is visible
        // cross-worker (prevents stale socketId collisions on future reconnects).
        try {
            const { RedisSyncBus } = require('../sync/RedisSyncBus');
            const syncBus = RedisSyncBus.getInstance();
            const serializablePlayer = {
                ...player,
                answeredQuestions: player.answeredQuestions instanceof Set
                    ? Array.from(player.answeredQuestions)
                    : (Array.isArray(player.answeredQuestions) ? player.answeredQuestions : [])
            };
            syncBus.publishPlayerData(playerId, serializablePlayer).catch(err => {
                logger.warn('[RECONNECT] Failed to publish player-data-sync', { playerId, error: err.message });
            });
        } catch (syncErr) {
            logger.warn('[RECONNECT] Failed to sync player data after reconnect', { playerId, error: syncErr.message });
        }

        // 3. Configurar rooms y socket.data
        await setupPlayerSocket(socket, roomId, nickname, playerId, false);

        // 4. Re-añadir a lobby/game si es necesario
        if (lobbyPlayers) {
            reAddToLobbyOrGame(nickname, roomId, game, lobbyPlayers);
        }

        logger.info('Player reconnected successfully via ReconnectionService', {
            nickname, playerId, roomId, hasGame: !!game
        });

        return { success: true, player };
    } catch (error) {
        logger.error('Error in ReconnectionService.reconnectPlayer', {
            error: error.message,
            nickname,
            roomId
        });
        return {
            success: false,
            reason: 'reconnect-error',
            message: 'Error al reconectar jugador'
        };
    }
}

module.exports = {
    checkNicknameDuplicate,
    disconnectOldSocket,
    updatePlayerState,
    setupPlayerSocket,
    reAddToLobbyOrGame,
    reconnectPlayer,
    restorePlayerStreaksFromRedis,
    buildPlayerSnapshot,
    buildPresenterSnapshot
};
