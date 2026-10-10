/**
 * @fileoverview Pantalla intermedia "JUGÁIS POR XXX PUNTOS + BONUS DE TIEMPO".
 *
 * Se muestra antes de revelar una pregunta con puntuación aleatoria. El servidor
 * gatea la espera: mientras la pantalla está visible el temporizador NO corre y
 * `questionStartTime` se vuelve a sellar al terminar, de forma que la pantalla no
 * se come el bonus de tiempo de los jugadores.
 *
 * El valor XXX lo generó una sola vez `QuestionTransitionManager`; aquí solo se
 * emite y se espera.
 *
 * @module sockets/utils/RandomPointsRevealManager
 */

'use strict';

const logger = require('../../config/logger');
const runtimeConfig = require('../../config/runtime-config');
const { SCORING } = require('../../config/game-constants');
const { getRedisClient } = require('../../config/redis');
const { usesRandomPoints } = require('../../domain/services/QuestionScoringPolicy');
const { extractStreakConfig } = require('../../domain/services/GameStreakApplicator');

const REVEAL_EVENT = 'random-points-reveal';

function revealDurationMs() {
    const configured = runtimeConfig.get('RANDOM_POINTS_REVEAL_MS');
    return Number.isFinite(Number(configured))
        ? Number(configured)
        : SCORING.RANDOM_POINTS.DEFAULT_REVEAL_MS;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Payload de la pantalla. Es idéntico para presentador, TV y jugadores: cada móvil
 * calcula su propio multiplicador con la racha que ya tiene en cliente, así que el
 * servidor solo manda la configuración de rachas, no un valor por jugador.
 *
 * @param {Object} game
 * @returns {Object}
 */
function buildRevealPayload(game) {
    const streak = extractStreakConfig(game);

    return {
        points: game.currentRandomPoints,
        questionIndex: game.currentIndex,
        durationMs: revealDurationMs(),
        startedAt: Date.now(),
        streak: {
            enabled: streak.use_streaks,
            threshold: streak.streak_threshold,
            bonusPercentage: streak.streak_bonus_percentage,
            doubleEnabled: streak.use_double_streaks,
            doubleThreshold: streak.double_streak_threshold,
            doubleBonusPercentage: streak.double_streak_bonus_percentage,
        },
    };
}

/**
 * ¿Sigue siendo válido revelar esta pregunta tras la espera?
 * Cubre que el presentador avance, se pause o termine la partida durante la pantalla.
 */
function revealStillValid(game, snapshot) {
    return !game.ended
        && game.currentIndex === snapshot.currentIndex
        && (game._epoch || 0) === snapshot.epoch;
}

/**
 * Re-sella la epoch canónica de la pregunta para que el bonus de tiempo se mida
 * desde que la pregunta se muestra, no desde la pantalla de puntos.
 */
async function restampQuestionEpoch({ game, roomId, syncBus }) {
    game.questionStartTime = Date.now();

    Promise.resolve(getRedisClient())
        .then(rc => rc.set(`game:questionstart:${roomId}`, String(game.questionStartTime), { EX: 7200 }))
        .catch(err => logger.warn('Failed to re-persist questionStartTime after random points screen', {
            roomId,
            error: err.message
        }));

    if (syncBus?.publishNextQuestion) {
        await syncBus.publishNextQuestion(
            roomId,
            game.currentIndex,
            game.questionStartTime,
            game.currentRandomPoints
        );
    }
}

/**
 * Muestra la pantalla intermedia si la pregunta la necesita y espera su duración.
 *
 * @param {Object} params
 * @param {Object} params.game
 * @param {Object} params.question - Pregunta que se va a revelar
 * @param {string} params.roomId
 * @param {Object} params.io
 * @param {Object} [params.syncBus]
 * @returns {Promise<boolean>} true si se mostró la pantalla y se puede continuar;
 *   false si se mostró pero el estado cambió y NO debe revelarse la pregunta.
 */
async function runRandomPointsReveal({ game, question, roomId, io, syncBus }) {
    if (!usesRandomPoints(question, game) || !game.currentRandomPoints) {
        return true;
    }

    const payload = buildRevealPayload(game);
    const snapshot = { currentIndex: game.currentIndex, epoch: game._epoch || 0 };

    io.to(`${roomId}:players`).emit(REVEAL_EVENT, payload);
    io.to(`${roomId}:presenter`).emit(REVEAL_EVENT, payload);

    game.randomPointsReveal = { ...payload };

    logger.info('Random points screen shown', {
        roomId,
        questionIndex: game.currentIndex,
        points: payload.points,
        durationMs: payload.durationMs
    });

    await delay(payload.durationMs);

    if (!revealStillValid(game, snapshot)) {
        logger.info('Random points screen aborted: game state changed during the screen', {
            roomId,
            questionIndex: snapshot.currentIndex
        });
        return false;
    }

    game.randomPointsReveal = null;
    await restampQuestionEpoch({ game, roomId, syncBus });

    return true;
}

/**
 * Estado de puntuación aleatoria para los snapshots de reconexión.
 * Si la pantalla sigue visible, devuelve además el tiempo que le queda, para que
 * quien se reincorpora la vea el resto de su duración y no la pregunta antes de tiempo.
 *
 * @param {Object} game
 * @returns {Object} Campos a mezclar en el snapshot (vacío si no aplica)
 */
function buildReconnectRandomPointsState(game) {
    const points = game?.currentRandomPoints;
    if (!points) return {};

    const state = { randomPoints: points };
    const reveal = game.randomPointsReveal;

    if (reveal) {
        const remainingMs = Math.max(0, reveal.startedAt + reveal.durationMs - Date.now());
        if (remainingMs > 0) {
            state.randomPointsReveal = { ...reveal, remainingMs };
        }
    }

    return state;
}

module.exports = {
    REVEAL_EVENT,
    revealDurationMs,
    buildRevealPayload,
    buildReconnectRandomPointsState,
    restampQuestionEpoch,
    runRandomPointsReveal,
};
