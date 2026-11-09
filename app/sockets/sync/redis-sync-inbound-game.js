/**
 * @fileoverview Handlers de mensajes Redis entrantes sobre el estado de la partida: inicio, puntuaciones,
 * avance de pregunta, revisión de diapositivas y revelado. Son métodos de RedisSyncBus (usan this.state):
 * RedisSyncBus.js los añade a su prototipo.
 */

const logger = require('../../config/logger');
const { clearGameTimer } = require('../../state/globalState');
const { markShown, enterReview } = require('../utils/SlideReviewState');
const { parseRedisMessage, buildSyncedGameState } = require('./redis-sync-payloads');

module.exports = {
    /**
     * `game-started`: crea la partida local a partir del estado ligero. No pisa una partida existente salvo en Trivial,
     * que publica una por pregunta.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleGameStartedSync(message) {
        const data = parseRedisMessage(message, 'game-started');
        if (!data) {
            return;
        }

        const { roomId, gameState = {} } = data;
        const existing = this.state.activeGames.get(roomId);
        if (existing && !gameState.isTrivial) {
            return;
        }

        this.state.activeGames.set(roomId, buildSyncedGameState(roomId, gameState, existing));
    },

    /**
     * `game-state-updated`: aplica la puntuación de un jugador. Descarta los deltas de una época anterior y, en
     * revisión, no mueve `currentIndex`.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleGameStateUpdatedSync(message) {
        const data = parseRedisMessage(message, 'game-state-updated');
        if (!data) {
            return;
        }

        const { roomId, nickname, score, currentIndex, originWorkerId, _epoch: incomingEpoch } = data;
        const game = this.state.activeGames.get(roomId);
        if (!game) {
            logger.debug(`Redis sync para juego inexistente: worker=${process.pid}, room=${roomId}`);
            return;
        }

        const localEpoch = game._epoch || 0;
        if (incomingEpoch !== undefined && incomingEpoch < localEpoch) {
            logger.debug(
                `Redis sync ignorado (stale epoch): incoming=${incomingEpoch} < local=${localEpoch}, room=${roomId}`
            );
            return;
        }

        if (incomingEpoch !== undefined) {
            game._epoch = incomingEpoch;
        }

        const debugEnabled = typeof logger.isDebugEnabled !== 'function' || logger.isDebugEnabled();
        let scoresBefore = '';
        if (debugEnabled) {
            scoresBefore = JSON.stringify(game.scores);
        }
        const oldScore = game.scores[nickname] || 0;
        if (nickname && score !== undefined) {
            game.scores[nickname] = score;
        }
        // En revisión manda la diapositiva revisada: una puntuación tardía de la
        // pregunta más avanzada no debe devolver este worker a ella
        if (!game.reviewMode) {
            game.currentIndex = currentIndex;
        }

        if (debugEnabled) {
            logger.debug(
                `Redis sync recibido: worker=${process.pid}, origin=${originWorkerId}, room=${roomId}, player=${nickname}, oldScore=${oldScore}, newScore=${score}, epoch=${incomingEpoch}, allScoresBefore=${scoresBefore}, allScoresAfter=${JSON.stringify(game.scores)}`
            );
        }
    },

    /**
     * `next-question-sync`: pasa la partida local a la nueva pregunta con el inicio y los puntos aleatorios del worker
     * de origen.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleNextQuestionSync(message) {
        const data = parseRedisMessage(message, 'next-question-sync');
        if (!data) {
            return;
        }

        const { roomId, currentIndex, startTime, randomPoints, _epoch: incomingEpoch } = data;
        const game = this.state.activeGames.get(roomId);
        if (!game) {
            return;
        }

        const localEpoch = game._epoch || 0;
        if (incomingEpoch !== undefined && incomingEpoch >= localEpoch) {
            game._epoch = incomingEpoch;
        }

        game.currentIndex = currentIndex;
        markShown(game, currentIndex);
        game.questionStartTime = startTime || Date.now();
        game.answerStats = {};
        game.canAnswer = true;
        // Valor sorteado de la puntuación aleatoria: se genera una sola vez en el
        // worker que avanza la pregunta y viaja aquí para que cualquier worker
        // que procese una respuesta use el MISMO valor.
        game.currentRandomPoints = randomPoints ?? null;
    },

    /** El presentador revisa una diapositiva ya mostrada (juegos personalizados). */
    handleSlideReviewSync(message) {
        const data = parseRedisMessage(message, 'slide-review-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const game = this.state.activeGames.get(data.roomId);
        if (!game) {
            return;
        }

        enterReview(game, data);
        try {
            clearGameTimer(data.roomId);
        } catch (err) {
            logger.warn('Failed to clear timer after slide-review sync', { roomId: data.roomId, error: err.message });
        }
    },

    /**
     * `question-revealed`: marca la pregunta como revelada, cierra o no las respuestas tardías, guarda el payload del
     * presentador y cancela el temporizador. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleQuestionRevealedSync(message) {
        const data = parseRedisMessage(message, 'question-revealed');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { roomId, questionIndex, trigger, allowLateAnswers = false } = data;
        const game = this.state.activeGames.get(roomId);

        if (game) {
            if (!game.revealedQuestions || typeof game.revealedQuestions !== 'object') {
                game.revealedQuestions = {};
            }

            game.revealedQuestions[questionIndex] = {
                trigger: trigger || 'sync',
                revealedAt: Date.now()
            };
            game.canAnswer = Boolean(allowLateAnswers);

            if (data.presenterPayload) {
                game.revealPayloads = game.revealPayloads || {};
                game.revealPayloads[questionIndex] = data.presenterPayload;
            }
        }

        try {
            clearGameTimer(roomId);
        } catch (err) {
            logger.warn('Failed to clear timer after question-revealed sync', {
                roomId,
                questionIndex,
                error: err.message
            });
        }
    }
};
