/**
 * @fileoverview Question context and per-type validation helpers.
 * @module application/commands/submit-answer/questionContext
 *
 * Purpose:
 * - Resolve game/session context from payload.
 * - Derive current question flags used throughout execution.
 * - Validate the answer payload with the handler of the question type
 *   (application/question-types/AnswerHandlerRegistry).
 */

const { isLastQuestion } = require('../../../sockets/utils/GameEndManager');
const { getRedisClient } = require('../../../config/redis');
const { getAnswerHandler } = require('../../question-types/AnswerHandlerRegistry');

const LATE_ANSWER_GRACE_MS = 800;

/**
 * El plazo extra de los tipos con lateAnswer (buildQuestionContext) se mide desde el
 * inicio de la pregunta y no descuenta las pausas: tras pausar, el envío automático al
 * agotarse el tiempo se rechazaba como game-closed. El estado compartido del
 * temporizador (timer:state en Redis, que pausa y reanudación actualizan desde
 * cualquier worker) marca el fin real: startTime + remainingTime.
 *
 * @param {Object} flags - Resultado de buildQuestionContext.
 * @param {string} sPin - Sala.
 * @param {number} [now] - Instante actual en ms.
 * @returns {Promise<Object>} flags con allowLateAnswer si la pregunta sigue en tiempo.
 */
async function applyTimerStateToLateWindow(flags, sPin, now = Date.now()) {
    const { lateAnswer } = getAnswerHandler(flags.currentQuestion?.question_type);
    if (!lateAnswer || flags.canAnswerOrEnded || flags.allowLateAnswer) return flags;

    let state;
    try {
        const redis = await getRedisClient();
        state = await redis.hGetAll(`timer:state:${sPin}`);
    } catch {
        return flags;
    }
    if (!state || !state.startTime) return flags;

    const deadline = Number(state.startTime) + Number(state.remainingTime) * 1000;
    const withinTime = state.isPaused === '1' || now <= deadline + LATE_ANSWER_GRACE_MS;
    return withinTime ? { ...flags, allowLateAnswer: true } : flags;
}

/**
 * Resolve room and game references from submit payload.
 *
 * @param {Object} payload - Command payload.
 * @param {Map} activeGames - In-memory active games map.
 * @returns {{roomId: string, sPin: string, game: Object|null}}
 */
function resolveGameContext(payload, activeGames) {
    const roomId = payload.sessionId || payload.pin;
    const sPin = String(roomId);
    const game = activeGames.get(sPin) || null;

    return { roomId, sPin, game };
}

/**
 * Build question metadata that the execution flow reuses.
 *
 * @param {Object} game - Active game state.
 * @returns {Object} Question context flags.
 */
function buildQuestionContext(game) {
    const currentQuestion = game.questions?.[game.currentIndex];
    const questionType = currentQuestion?.question_type;
    const lastQuestion = !!(game && isLastQuestion(game));
    const questionTimeLimit = currentQuestion?.time_limit || 30;
    const elapsedMs = Date.now() - (game.questionStartTime || Date.now());

    return {
        currentQuestion,
        lastQuestion,
        // Cada paso del flujo pregunta al manejador del tipo (AnswerHandlerRegistry)
        questionType,
        questionTimeLimit,
        canAnswerOrEnded: game?.canAnswer || game?.ended || lastQuestion,
        // Envío automático al agotarse el tiempo: llega justo después del cierre
        allowLateAnswer:
            getAnswerHandler(questionType).lateAnswer && elapsedMs <= questionTimeLimit * 1000 + LATE_ANSWER_GRACE_MS
    };
}

/**
 * Valida la respuesta con el manejador de su tipo de pregunta, teniendo en cuenta si se
 * admiten respuestas con la pregunta cerrada (última pregunta o plazo extra).
 * @param {Object} input
 * @param {Object} input.payload - Payload de la respuesta
 * @param {Object} input.question - Pregunta actual
 * @param {Object} input.flags - Estado de la partida (canAnswerOrEnded, lastQuestion, allowLateAnswer)
 * @returns {Object} Resultado del validador: { valid, reason? } y datos normalizados de la respuesta
 */
function validateAnswerByType({ payload, question, flags }) {
    return getAnswerHandler(question?.question_type).validate({ payload, question, flags });
}

module.exports = {
    resolveGameContext,
    buildQuestionContext,
    validateAnswerByType,
    applyTimerStateToLateWindow
};
