/**
 * @fileoverview Publicadores de dominio del bus Redis (partida, equipos, sesión, revelado, lobby, rachas,
 * temporizador y jugadores). Son métodos de RedisSyncBus (usan this.publish y this.state):
 * RedisSyncBus.js los añade a su prototipo.
 */

const logger = require('../../config/logger');
const { buildLightGameState } = require('./redis-sync-payloads');

module.exports = {
    /**
     * Publica el arranque de partida (`game-started`) con su estado ligero y fija la época 1 en el worker de origen.
     * @param {string} roomId - ID de sesión
     * @param {Object} gameState - Partida completa
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishGameStarted(roomId, gameState) {
        // Set initial epoch on the origin worker's game object
        const localGame = this.state?.activeGames?.get(roomId);
        if (localGame) {
            localGame._epoch = 1;
        }

        const lightGameState = buildLightGameState(roomId, gameState);
        await this.publish('game-started', { roomId, gameState: lightGameState, originWorkerId: process.pid });
        logger.debug(`game-started publicado: ${roomId} (worker ${process.pid})`);
    },

    /**
     * Publica la nueva puntuación de un jugador (`game-state-updated`) con la época actual, para descartar deltas de
     * otra pregunta.
     * @param {string} roomId - ID de sesión
     * @param {string} nickname - Apodo
     * @param {number} score - Puntuación total
     * @param {number} currentIndex - Pregunta actual
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishGameStateUpdate(roomId, nickname, score, currentIndex) {
        const localGame = this.state?.activeGames?.get(roomId);
        const epoch = localGame?._epoch;
        logger.debug(
            `Publicando delta: worker=${process.pid}, room=${roomId}, player=${nickname}, score=${score}, index=${currentIndex}, epoch=${epoch}`
        );
        await this.publish('game-state-updated', {
            roomId,
            nickname,
            score,
            currentIndex,
            originWorkerId: process.pid,
            _epoch: epoch
        });
        logger.debug(`Delta publicado exitosamente: ${roomId} - ${nickname}: ${score} pts (worker ${process.pid})`);
    },

    /**
     * Publica el paso a otra pregunta (`next-question-sync`) e incrementa la época en el worker de origen.
     * @param {string} roomId - ID de sesión
     * @param {number} currentIndex - Índice de la nueva pregunta
     * @param {number} startTime - Epoch (ms) canónico de inicio de la pregunta
     * @param {number|null} [randomPoints=null] - Puntos aleatorios de la pregunta, si los hay
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishNextQuestion(roomId, currentIndex, startTime, randomPoints = null) {
        // Increment epoch on origin worker for each question transition
        const localGame = this.state?.activeGames?.get(roomId);
        if (localGame) {
            localGame._epoch = (localGame._epoch || 0) + 1;
        }
        const epoch = localGame?._epoch;
        await this.publish('next-question-sync', {
            roomId,
            currentIndex,
            startTime,
            randomPoints,
            originWorkerId: process.pid,
            _epoch: epoch
        });
        logger.debug(
            `next-question-sync publicado: ${roomId} pregunta ${currentIndex + 1} epoch=${epoch} (worker ${process.pid})`
        );
    },

    /**
     * Revisión de una diapositiva ya mostrada. No incrementa la época: las
     * puntuaciones tardías de la pregunta anterior deben seguir aplicándose.
     */
    async publishSlideReview(roomId, { currentIndex, maxShownIndex }) {
        await this.publish('slide-review-sync', { roomId, currentIndex, maxShownIndex, originWorkerId: process.pid });
    },

    /**
     * Publica la configuración de equipos completa (`team-config-sync`).
     * @param {string} roomId - ID de sesión
     * @param {Object} teamConfig - Configuración de equipos
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishTeamConfig(roomId, teamConfig) {
        await this.publish('team-config-sync', { roomId, teamConfig, originWorkerId: process.pid });
        logger.debug(`team-config-sync publicado: ${roomId} (worker ${process.pid})`);
    },

    /**
     * Publica un cambio de equipo de un jugador (teamIndex null = sale de su equipo).
     * Los demás workers lo aplican sobre su copia en lugar de reemplazarla entera.
     */
    async publishTeamMembership(roomId, nickname, teamIndex) {
        await this.publish('team-membership-sync', { roomId, nickname, teamIndex, originWorkerId: process.pid });
        logger.debug(`team-membership-sync publicado: ${roomId} ${nickname} -> ${teamIndex} (worker ${process.pid})`);
    },

    /**
     * Publica el cierre de la sesión (`session-abandoned`) para que los demás workers la limpien.
     * @param {string} roomId - ID de sesión
     * @param {string} [reason='abandoned'] - Motivo (p. ej. 'game-ended')
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishSessionAbandoned(roomId, reason = 'abandoned') {
        await this.publish('session-abandoned', { roomId, reason, originWorkerId: process.pid });
        logger.debug(`session-abandoned publicado: ${roomId} (worker ${process.pid})`);
    },

    /**
     * Publica que un jugador respondió (`player-answered-sync`).
     * @param {string} roomId - ID de sesión
     * @param {string} nickname - Apodo
     * @param {boolean} correct - Si acertó
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishPlayerAnswered(roomId, nickname, correct) {
        await this.publish('player-answered-sync', { roomId, nickname, correct, originWorkerId: process.pid });
    },

    /**
     * Publica los payloads del revelado (`reveal-answer-sync`) para los clientes conectados a otros workers.
     * @param {string} roomId - ID de sesión
     * @param {Object} presenterPayload - Payload del presentador
     * @param {Object} playerPayload - Payload de los jugadores
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishRevealAnswer(roomId, presenterPayload, playerPayload) {
        await this.publish('reveal-answer-sync', {
            roomId,
            presenterPayload,
            playerPayload,
            originWorkerId: process.pid
        });
    },

    /**
     * Publica que una pregunta quedó revelada (`question-revealed`), con datos extra como `trigger`, `allowLateAnswers`
     * o `presenterPayload`.
     * @param {string} roomId - ID de sesión
     * @param {number} questionIndex - Pregunta revelada
     * @param {Object} [metadata={}] - Campos que se añaden al mensaje
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishQuestionRevealed(roomId, questionIndex, metadata = {}) {
        await this.publish('question-revealed', {
            roomId,
            questionIndex,
            ...metadata,
            originWorkerId: process.pid
        });
    },

    /**
     * Publica la entrada de un jugador al lobby (`lobby-player-joined`).
     * @param {string} roomId - ID de sesión
     * @param {string} nickname - Apodo
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishLobbyPlayerJoined(roomId, nickname) {
        await this.publish('lobby-player-joined', { roomId, nickname, originWorkerId: process.pid });
        logger.debug(`lobby-player-joined publicado: ${roomId} - ${nickname} (worker ${process.pid})`);
    },

    /**
     * Publica la salida de un jugador del lobby (`lobby-player-left`).
     * @param {string} roomId - ID de sesión
     * @param {string} nickname - Apodo
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishLobbyPlayerLeft(roomId, nickname) {
        await this.publish('lobby-player-left', { roomId, nickname, originWorkerId: process.pid });
        logger.debug(`lobby-player-left publicado: ${roomId} - ${nickname} (worker ${process.pid})`);
    },

    /**
     * Publica el reinicio de racha de varios jugadores (`streak-reset-sync`).
     * @param {string} roomId - ID de sesión
     * @param {string[]} nicknames - Apodos
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishStreakReset(roomId, nicknames) {
        await this.publish('streak-reset-sync', { roomId, nicknames, originWorkerId: process.pid });
    },

    /**
     * Publica la racha restaurada de un jugador (`streak-restored-sync`).
     * @param {string} roomId - ID de sesión
     * @param {string} nickname - Apodo
     * @param {number} streak - Racha
     * @param {Object} streakInfo - Detalle de la racha
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishStreakRestored(roomId, nickname, streak, streakInfo) {
        await this.publish('streak-restored-sync', {
            roomId,
            nickname,
            streak,
            streakInfo,
            originWorkerId: process.pid
        });
        logger.debug(
            `streak-restored-sync publicado: ${roomId} - ${nickname} streak=${streak} (worker ${process.pid})`
        );
    },

    /**
     * Publica la pausa del temporizador (`timer-paused-sync`).
     * @param {string} roomId - ID de sesión
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishTimerPaused(roomId) {
        await this.publish('timer-paused-sync', { roomId, originWorkerId: process.pid });
        logger.debug(`timer-paused-sync publicado: ${roomId} (worker ${process.pid})`);
    },

    /**
     * Publica la reanudación del temporizador (`timer-resumed-sync`).
     * @param {string} roomId - ID de sesión
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishTimerResumed(roomId) {
        await this.publish('timer-resumed-sync', { roomId, originWorkerId: process.pid });
        logger.debug(`timer-resumed-sync publicado: ${roomId} (worker ${process.pid})`);
    },

    /**
     * Publica la desconexión de un jugador (`player-disconnected-sync`) para la reconexión desde otro worker.
     * @param {string} playerId - ID del jugador
     * @param {Object} playerData - Datos del jugador (al menos `nickname`)
     * @returns {Promise<void>}
     * @throws {Error} Si Redis rechaza la publicación (sin conexión no publica y no falla)
     */
    async publishPlayerDisconnected(playerId, playerData) {
        await this.publish('player-disconnected-sync', { playerId, playerData, originWorkerId: process.pid });
        logger.debug(
            `player-disconnected-sync publicado: ${playerData.nickname} (playerId: ${playerId}, worker ${process.pid})`
        );
    },

    /**
     * Publish full player data to all workers so cross-worker reconnection works.
     * Called on join-lobby and after a successful reconnect.
     */
    async publishPlayerData(playerId, playerData) {
        await this.publish('player-data-sync', { playerId, playerData, originWorkerId: process.pid });
        logger.debug(
            `player-data-sync publicado: ${playerData.nickname} (playerId: ${playerId}, worker ${process.pid})`
        );
    }
};
