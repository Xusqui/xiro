/**
 * @fileoverview Use Case - End Game
 * @module application/use-cases/EndGameUseCase
 * 
 * Encapsula el flujo completo de finalizar una partida:
 * - Validación de partida activa
 * - Cálculo de ranking final
 * - Envío de posiciones a jugadores
 * - Emisión de evento de dominio (GameEndedEvent)
 * - Cleanup de recursos
 * 
 * MIGRADO: Ya no usa EndGameCommand (eliminado)
 * Ahora usa lógica directa + EventBus
 */

const EventBus = require('../../domain/events/EventBus');
const { GameEndedEvent } = require('../../domain/events/GameEvents');
const { calculateFinalRanking } = require('../../sockets/utils/RankingCalculator');
const { sendFinalPositions, cleanupGame } = require('../../sockets/utils/GameCleanupManager');
const { clearGameTimer } = require('../../state/globalState');
const SessionStore = require('../../services/SessionStore');
const { saveGameSession } = require('../../services/db/game-session.service');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

/**
 * Use Case para finalizar una partida
 */
class EndGameUseCase {
    /**
     * @param {Object} dependencies - Dependencias inyectadas
     */
    constructor(dependencies = {}) {
        this.dependencies = dependencies;
    }

    _getRuntimeDependencies() {
        const { activeGames, players, socketToPlayer, lobbyPlayers, teamConfigs, io } = this.dependencies;
        return { activeGames, players, socketToPlayer, lobbyPlayers, teamConfigs, io };
    }

    async _refreshCanonicalScores(roomId, game) {
        try {
            const { roundScore } = require('../../services/game.logic');
            const rcScores = await getRedisClient();
            const rawScores = await rcScores.hGetAll(`game:scores:${roomId}`);
            if (!rawScores || Object.keys(rawScores).length === 0) {
                return;
            }

            const merged = { ...(game.scores || {}) };
            for (const [nick, val] of Object.entries(rawScores)) {
                const num = Number(val);
                if (!Number.isNaN(num)) {
                    merged[nick] = roundScore(num);
                }
            }
            game.scores = merged;
        } catch (scoreErr) {
            logger.warn('EndGameUseCase: no se pudo refrescar scores canónicos', {
                roomId,
                error: scoreErr.message
            });
        }
    }

    _buildQuestionsSnapshot(game) {
        return (game.questions || []).map(q => ({
            question_text: q.question_text || q.text || '',
            correct_answer: q.correct_answer || q.correct_word || '',
            question_type: q.question_type || q.type || 'quiz'
        }));
    }

    _mergePlayerAnswersFromRedisEntries(mergedPlayerAnswers, allEntries) {
        for (const [field, val] of Object.entries(allEntries)) {
            const colonIdx = field.indexOf(':');
            const qIdx = Number(field.substring(0, colonIdx));
            const nick = field.substring(colonIdx + 1);
            if (!mergedPlayerAnswers[qIdx]) {
                mergedPlayerAnswers[qIdx] = {};
            }
            if (!mergedPlayerAnswers[qIdx][nick]) {
                try {
                    mergedPlayerAnswers[qIdx][nick] = JSON.parse(val);
                } catch (_) {
                    // ignore malformed Redis payload
                }
            }
        }
    }

    async _loadRedisEndGameSnapshot(roomId, game) {
        const mergedPlayerAnswers = { ...(game.playerAnswers || {}) };
        let redisStartTime = null;
        let redisDbSessionId = null;

        try {
            const rc = await getRedisClient();
            const allEntries = await rc.hGetAll(`game:playeranswers:${roomId}`);

            if (allEntries && Object.keys(allEntries).length > 0) {
                this._mergePlayerAnswersFromRedisEntries(mergedPlayerAnswers, allEntries);
                rc.del(`game:playeranswers:${roomId}`).catch(() => { });
            }

            const startTs = await rc.get(`game:started:${roomId}`);
            if (startTs) {
                redisStartTime = Number(startTs);
                rc.del(`game:started:${roomId}`).catch(() => { });
            }

            const SessionStore = require('../../services/SessionStore');
            const redisSession = await SessionStore.load(roomId);
            if (redisSession && redisSession.dbSessionId) {
                redisDbSessionId = redisSession.dbSessionId;
            }
        } catch (_) {
            // ignore Redis merge failure and continue with in-memory snapshot
        }

        return { mergedPlayerAnswers, redisStartTime, redisDbSessionId };
    }

    _persistSessionNonBlocking({ roomId, game, ranking, reason, questionsSnapshot, mergedPlayerAnswers, redisStartTime, redisDbSessionId, io }) {
        const gameStartTime = redisStartTime || game.gameStartTime || null;
        const currentDbSessionId = redisDbSessionId || game.dbSessionId || null;

        saveGameSession({
            pin: game.roomId || game.pin,
            sessionId: roomId,
            dbId: currentDbSessionId,
            gameType: game.gameType || null,
            startedAt: gameStartTime,
            durationMs: gameStartTime ? Date.now() - gameStartTime : null,
            playerCount: ranking.length || (Array.isArray(game.players) ? game.players.length : Object.keys(game.scores || {}).length),
            questionCount: game.questions?.length || 0,
            reason,
            finalRanking: ranking,
            questionsSnapshot,
            playerAnswers: mergedPlayerAnswers
        }).then(id => {
            if (id) {
                if (!game.dbSessionId) game.dbSessionId = id;
                io.to(roomId + ':presenter').emit('results-ready', { sessionId: id });
            }
        }).catch(err => logger.error('EndGameUseCase: no se pudo persistir sesión', { error: err.message }));
    }

    _emitGameEndedEvent({ roomId, game, ranking, reason, startedAt }) {
        EventBus.emit('game.ended', new GameEndedEvent({
            roomId,
            gameId: roomId,
            pin: game.pin,
            finalRanking: ranking,
            stats: {
                totalQuestions: game.questions?.length || 0,
                totalPlayers: ranking.length
            },
            duration: Date.now() - (game.startedAt || startedAt),
            playerCount: ranking.length,
            questionCount: game.questions?.length || 0,
            reason,
            timestamp: Date.now()
        }));
    }

    _schedulePlayerAutoRedirect(io, roomId) {
        if (!io || typeof io.in !== 'function') {
            setTimeout(() => {
                if (io && typeof io.to === 'function') {
                    io.to(roomId + ':players').emit('game-abandoned', {
                        roomId,
                        reason: 'concluded',
                        message: 'Juego concluido.',
                        code: 'GAME_ENDED'
                    });
                }
            }, 15000);
            return;
        }

        io.in(roomId + ':players').fetchSockets().then(playerSockets => {
            setTimeout(() => {
                playerSockets.forEach(s => {
                    if (s.connected) {
                        s.emit('game-abandoned', {
                            roomId,
                            reason: 'concluded',
                            message: 'Juego concluido.',
                            code: 'GAME_ENDED'
                        });
                    }
                });
            }, 15000);
        }).catch(err => {
            logger.warn('Failed to schedule player auto redirect', { error: err.message });
        });
    }

    async _invalidateSessionState(roomId) {
        try {
            const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
            await SessionSaveDebouncer.flush(roomId);
            SessionSaveDebouncer.markClosed(roomId);
        } catch (_) {
            // best-effort flush and mark closed
        }
        try {
            await SessionStore.save(roomId, { ended: true, savedAt: Date.now() }, 60);
        } catch (_) {
            // best-effort tombstone
        }
        await SessionStore.invalidate(roomId);
    }

    async _publishSessionAbandoned(roomId) {
        const syncBus = this.dependencies.syncBus;
        if (!syncBus || typeof syncBus.publishSessionAbandoned !== 'function') {
            return;
        }

        try {
            await syncBus.publishSessionAbandoned(roomId, 'game-ended');
        } catch (err) {
            logger.warn('EndGameUseCase: no se pudo publicar session-abandoned', { error: err.message });
        }
    }

    async _getRedisClientForCleanup() {
        try {
            return await getRedisClient();
        } catch (_) {
            return null;
        }
    }

    /**
     * Ejecutar: finalizar partida
     * @param {Object} params
     * @param {string} params.roomId - ID de la sala
     * @param {string} [params.reason='completed'] - Razón de finalización
     * @returns {Promise<Object>} { success, ranking?, error? }
     */
    async execute({ roomId, reason = 'completed' }) {
        const startedAt = Date.now();

        try {
            const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
            await SessionSaveDebouncer.flush(roomId);

            const { activeGames, players, socketToPlayer, lobbyPlayers, teamConfigs, io } = this._getRuntimeDependencies();

            const game = activeGames?.get(roomId);
            if (!game) {
                return {
                    success: false,
                    error: 'Game not found',
                    code: 'GAME_NOT_FOUND',
                    roomId
                };
            }

            if (game.ended) {
                return {
                    success: false,
                    error: 'Game already ended',
                    code: 'GAME_ALREADY_ENDED',
                    roomId
                };
            }

            game.ended = true;

            await this._refreshCanonicalScores(roomId, game);

            const teamConfig = teamConfigs?.get(roomId);
            const ranking = calculateFinalRanking(game, teamConfig);

            logger.info(`EndGameUseCase: Ranking calculado (${ranking.length} entradas):`,
                JSON.stringify(ranking.slice(0, 5), null, 2));

            const questionsSnapshot = this._buildQuestionsSnapshot(game);
            const { mergedPlayerAnswers, redisStartTime, redisDbSessionId } = await this._loadRedisEndGameSnapshot(roomId, game);
            this._persistSessionNonBlocking({
                roomId,
                game,
                ranking,
                reason,
                questionsSnapshot,
                mergedPlayerAnswers,
                redisStartTime,
                redisDbSessionId,
                io
            });

            logger.info(`EndGameUseCase: Limpiando timer de partida: ${roomId}`);
            clearGameTimer(roomId);

            this._emitGameEndedEvent({ roomId, game, ranking, reason, startedAt });
            await sendFinalPositions({ io, roomId, ranking, teamConfig });

            this._schedulePlayerAutoRedirect(io, roomId);
            await this._invalidateSessionState(roomId);
            await this._publishSessionAbandoned(roomId);

            const redisForCleanup = await this._getRedisClientForCleanup();
            cleanupGame({
                roomId,
                activeGames,
                players,
                socketToPlayer,
                lobbyPlayers,
                clearGameTimer,
                redis: redisForCleanup
            });

            // Make all sockets leave the rooms
            try {
                if (io && typeof io.in === 'function') {
                    io.in(roomId).socketsLeave([roomId, roomId + ':players', roomId + ':presenter']);
                }
            } catch (err) {
                logger.warn('Failed to make sockets leave rooms at game end', { roomId, error: err.message });
            }

            logger.info(`EndGameUseCase: Partida ${roomId} finalizada (${reason})`);
            logger.info(`Ranking final top 3:`, ranking.slice(0, 3).map(p => `${p.name}: ${p.pts}`));

            return {
                success: true,
                ranking,
                roomId,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error('EndGameUseCase: Error crítico', {
                roomId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message,
                roomId,
                timestamp: Date.now()
            };
        }
    }
}

module.exports = EndGameUseCase;
