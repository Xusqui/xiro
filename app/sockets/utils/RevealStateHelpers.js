/**
 * @fileoverview Estado del revelado de una pregunta: si ya se reveló, carga de prerequisitos (sesión,
 * estadísticas y puntuaciones canónicas), estadísticas normalizadas, recuento de jugadores y bloqueo de
 * respuestas. Lo usa GameEndManager.revealAnswer.
 */

const EventBus = require('../../domain/events/EventBus');
const { TimeExpiredEvent } = require('../../domain/events/GameEvents');
const sessionStore = require('../../services/SessionStore');
const answerStatsStore = require('../../services/AnswerStatsStore');
const { loadCanonicalScores } = require('./RevealRanking');
const logger = require('../../config/logger');

function hasQuestionBeenRevealed(game, questionIndex) {
    return Boolean(game?.revealedQuestions?.[questionIndex]);
}

/**
 * Marca la pregunta como revelada en la partida local (con el motivo y la hora).
 * @param {Object} game - Partida activa
 * @param {number} questionIndex - Pregunta
 * @param {string} trigger - Motivo ('timeout', 'all-answered'…)
 * @returns {void}
 */
function markQuestionAsRevealed(game, questionIndex, trigger) {
    if (!game.revealedQuestions || typeof game.revealedQuestions !== 'object') {
        game.revealedQuestions = {};
    }

    game.revealedQuestions[questionIndex] = {
        trigger,
        revealedAt: Date.now()
    };
}

/**
 * Carga en paralelo la sesión guardada, las estadísticas de la pregunta y las puntuaciones canónicas de Redis. Un fallo
 * de una no impide las otras.
 * @param {string} roomId - ID de sesión
 * @param {number} revealIndex - Pregunta que se revela
 * @returns {Promise<PromiseSettledResult[]>} [snapshot, stats, puntuaciones canónicas]
 */
function loadRevealPrerequisites(roomId, revealIndex) {
    return Promise.allSettled([
        sessionStore.load(roomId),
        answerStatsStore.getStats(roomId, revealIndex),
        loadCanonicalScores(roomId)
    ]);
}

/**
 * Decide qué pregunta se revela y por qué. Devuelve null si no hay partida o la pregunta ya estaba revelada.
 * @param {Object} game - Partida activa (puede faltar)
 * @param {string} roomId - ID de sesión
 * @param {boolean} timeExpired - true si se revela por tiempo, false si respondieron todos
 * @returns {{revealIndex: number, revealTrigger: 'timeout'|'all-answered'}|null}
 */
function resolveRevealBase(game, roomId, timeExpired) {
    if (!game) {
        logger.warn(`revealAnswer: No game found for ${roomId}`);
        return null;
    }

    const revealIndex = Number.isInteger(game.currentIndex) ? game.currentIndex : 0;
    const revealTrigger = timeExpired ? 'timeout' : 'all-answered';

    if (hasQuestionBeenRevealed(game, revealIndex)) {
        logger.debug(
            `revealAnswer: Pregunta ${revealIndex + 1} ya revelada en ${roomId} - ignorando (${revealTrigger})`
        );
        return null;
    }

    return { revealIndex, revealTrigger };
}

/**
 * Devuelve la pregunta a revelar tras refrescar el estado. null si la partida terminó, no hay pregunta o otro proceso
 * la reveló mientras tanto.
 * @param {Object} game - Partida activa
 * @param {string} roomId - ID de sesión
 * @param {number} revealIndex - Pregunta que se revela
 * @param {string} revealTrigger - Motivo (para el log)
 * @returns {Object|null} Pregunta
 */
function resolveQuestionToReveal(game, roomId, revealIndex, revealTrigger) {
    if (game.ended) {
        logger.debug(`revealAnswer: Juego ${roomId} ya terminó - cancelando reveal`);
        return null;
    }

    const currentQuestion = game.questions[revealIndex];
    if (!currentQuestion) {
        logger.warn(`revealAnswer: No current question for ${roomId}`);
        return null;
    }

    if (hasQuestionBeenRevealed(game, revealIndex)) {
        logger.debug(
            `revealAnswer: Pregunta ${revealIndex + 1} ya revelada tras refresco en ${roomId} - ignorando (${revealTrigger})`
        );
        return null;
    }

    return currentQuestion;
}

/**
 * Si se revela por tiempo, emite el evento de dominio 'timer.expired'.
 * @param {boolean} timeExpired - true si se revela por tiempo, false si respondieron todos
 * @param {string} roomId - ID de sesión
 * @param {number} revealIndex - Pregunta que se revela
 * @param {number} answeredCount - Respuestas recibidas
 * @param {number} totalPlayers - Jugadores activos
 * @returns {void}
 */
function emitTimerExpiredIfNeeded(timeExpired, roomId, revealIndex, answeredCount, totalPlayers) {
    if (!timeExpired) {
        return;
    }

    EventBus.emit(
        'timer.expired',
        new TimeExpiredEvent({
            gameId: roomId,
            questionIndex: revealIndex,
            answeredCount,
            totalPlayers
        })
    );
}

/**
 * Avisa a toda la sala ('blocked-answer') de que la pregunta se cierra.
 * @param {Object} io - Instancia de Socket.IO
 * @param {string} roomId - ID de sesión
 * @param {number} revealIndex - Pregunta que se revela
 * @param {boolean} timeExpired - true si se revela por tiempo, false si respondieron todos
 * @returns {void}
 */
function emitBlockedAnswer(io, roomId, revealIndex, timeExpired) {
    io.to(roomId).emit('blocked-answer', {
        questionIndex: revealIndex,
        message: timeExpired ? 'Tiempo agotado' : 'Todos han respondido'
    });
}

/**
 * Mezcla en la partida las puntuaciones y estadísticas de la sesión guardada. Si la carga falló lo registra y no toca
 * nada.
 * @param {Object} game - Partida activa
 * @param {PromiseSettledResult<Object>} snapshotResult - Resultado de SessionStore.load
 * @returns {void}
 */
function applySnapshotResult(game, snapshotResult) {
    if (snapshotResult.status !== 'fulfilled') {
        logger.warn('revealAnswer: No se pudo refrescar session snapshot', snapshotResult.reason?.message);
        return;
    }

    const sessionSnapshot = snapshotResult.value;
    if (sessionSnapshot?.scores) {
        game.scores = { ...(game.scores || {}), ...sessionSnapshot.scores };
    }
    if (sessionSnapshot?.answerStats) {
        game.answerStats = sessionSnapshot.answerStats;
    }
}

/**
 * Mezcla en la partida las puntuaciones canónicas de Redis (prevalecen sobre las locales). Si la carga falló lo
 * registra.
 * @param {Object} game - Partida activa
 * @param {PromiseSettledResult<Object>} canonicalScoresResult - Resultado de loadCanonicalScores
 * @returns {void}
 */
function applyCanonicalScoresResult(game, canonicalScoresResult) {
    if (canonicalScoresResult.status === 'fulfilled' && canonicalScoresResult.value) {
        game.scores = { ...(game.scores || {}), ...canonicalScoresResult.value };
        return;
    }

    if (canonicalScoresResult.status === 'rejected') {
        logger.warn('revealAnswer: No se pudo leer scores canónicos', canonicalScoresResult.reason?.message);
    }
}

function normalizeStats(rawStats) {
    if (!rawStats || typeof rawStats !== 'object') {
        return {};
    }

    const values = Object.values(rawStats);
    const isCountShape = values.every(value => typeof value === 'number');
    if (isCountShape) {
        return rawStats;
    }

    const counts = {};
    values.forEach(value => {
        if (!value || typeof value !== 'object') {
            return;
        }
        const answerIndex = Number.isInteger(value.answerIndex)
            ? value.answerIndex
            : Number.isInteger(value.index)
              ? value.index
              : null;
        if (answerIndex === null) {
            return;
        }
        counts[answerIndex] = (counts[answerIndex] || 0) + 1;
    });

    return counts;
}

/**
 * Elige las estadísticas de la pregunta (las de Redis si hay; si no, las locales) y las normaliza a recuento por
 * opción.
 * @param {Object} game - Partida activa
 * @param {number} revealIndex - Pregunta que se revela
 * @param {PromiseSettledResult<Object>} statsResult - Resultado de AnswerStatsStore.getStats
 * @returns {Object<string, number>} Votos por índice de opción
 */
function resolveStatsForReveal(game, revealIndex, statsResult) {
    let statsForQuestion = game.answerStats?.[revealIndex] || {};
    if (statsResult.status === 'fulfilled') {
        const redisStats = statsResult.value;
        if (redisStats && Object.keys(redisStats).length > 0) {
            statsForQuestion = redisStats;
        }
    } else {
        logger.warn('revealAnswer: No se pudo leer stats desde Redis', statsResult.reason?.message);
    }

    return normalizeStats(statsForQuestion);
}

/**
 * Suma los votos de todas las opciones.
 * @param {Object<string, number>} stats - Votos por opción
 * @returns {number}
 */
function countAnsweredFromStats(stats) {
    return Object.values(stats).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

/**
 * Cuenta los jugadores de la partida sin el presentador (HOST).
 * @param {Object} game - Partida activa
 * @returns {number}
 */
function countActivePlayers(game) {
    return (game.players || []).filter(player => player !== 'HOST').length;
}

/**
 * Cierra las respuestas, salvo en la última pregunta revelada por tiempo (fuera de Trivial), que admite respuestas
 * tardías.
 * @param {Object} game - Partida activa
 * @param {number} revealIndex - Pregunta que se revela
 * @param {boolean} timeExpired - true si se revela por tiempo, false si respondieron todos
 * @returns {boolean} true si se admiten respuestas tardías
 */
function setAnswerBlockingState(game, revealIndex, timeExpired) {
    const isLast = revealIndex >= game.questions.length - 1;
    const allowLateAnswers = isLast && timeExpired && !game.isTrivial;

    if (!isLast || game.isTrivial) {
        game.canAnswer = false;
    } else if (timeExpired) {
        logger.debug('Última pregunta - manteniendo canAnswer=true para respuestas tardías');
    }

    return allowLateAnswers;
}

module.exports = {
    markQuestionAsRevealed,
    loadRevealPrerequisites,
    resolveRevealBase,
    resolveQuestionToReveal,
    emitTimerExpiredIfNeeded,
    emitBlockedAnswer,
    applySnapshotResult,
    applyCanonicalScoresResult,
    resolveStatsForReveal,
    countAnsweredFromStats,
    countActivePlayers,
    setAnswerBlockingState
};
