/**
 * @fileoverview Question context and per-type validation helpers.
 * @module application/commands/submit-answer/questionContext
 *
 * Purpose:
 * - Resolve game/session context from payload.
 * - Derive current question flags used throughout execution.
 * - Validate answer payload with the same services and rules as before.
 */

const { isLastQuestion } = require('../../../sockets/utils/GameEndManager');
const AnswerStateService = require('../../../domain/services/AnswerStateService');
const OrderAnswerStateService = require('../../../domain/services/OrderAnswerStateService');
const MatchingAnswerStateService = require('../../../domain/services/MatchingAnswerStateService');
const MultipleChoiceAnswerStateService = require('../../../domain/services/MultipleChoiceAnswerStateService');
const { getRedisClient } = require('../../../config/redis');
const { isValidFoundPayload } = require('../../validators/WordSearchQuestionValidator');

const LATE_ANSWER_GRACE_MS = 800;

/**
 * El plazo extra de ordenar/emparejar (buildQuestionContext) se mide desde el inicio
 * de la pregunta y no descuenta las pausas: tras pausar, el envío automático al
 * agotarse el tiempo se rechazaba como game-closed. El estado compartido del
 * temporizador (timer:state en Redis, que pausa y reanudación actualizan desde
 * cualquier worker) marca el fin real: startTime + remainingTime.
 *
 * @param {Object} flags - Resultado de buildQuestionContext.
 * @param {string} sPin - Sala.
 * @returns {Promise<Object>} flags con el plazo ampliado si la pregunta sigue en tiempo.
 */
async function applyTimerStateToLateWindow(flags, sPin, now = Date.now()) {
    const lateAnswerType = flags.isOrderQuestion || flags.isMatchingQuestion || flags.isWordSearchQuestion;
    if (!lateAnswerType || flags.canAnswerOrEnded || flags.allowOrderAfterClose
        || flags.allowMatchingAfterClose || flags.allowWordSearchAfterClose) {
        return flags;
    }

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
    if (!withinTime) return flags;

    return {
        ...flags,
        allowOrderAfterClose: flags.isOrderQuestion,
        allowMatchingAfterClose: flags.isMatchingQuestion,
        allowWordSearchAfterClose: flags.isWordSearchQuestion
    };
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
    const lastQuestion = !!(game && isLastQuestion(game));

    const isOrderQuestion = currentQuestion?.question_type === 'order';
    const isMatchingQuestion = currentQuestion?.question_type === 'matching';
    const isNumericQuestion = currentQuestion?.question_type === 'numeric_approximation';
    const isWordScrambleQuestion = currentQuestion?.question_type === 'word_scramble';
    const isMultipleChoiceQuestion = currentQuestion?.question_type === 'multiple_choice';
    const isWordSearchQuestion = currentQuestion?.question_type === 'word_search';

    const questionTimeLimit = currentQuestion?.time_limit || 30;
    const elapsedMs = Date.now() - (game.questionStartTime || Date.now());
    const graceMs = LATE_ANSWER_GRACE_MS;

    return {
        currentQuestion,
        lastQuestion,
        isOrderQuestion,
        isMatchingQuestion,
        isNumericQuestion,
        isWordScrambleQuestion,
        isMultipleChoiceQuestion,
        isWordSearchQuestion,
        questionTimeLimit,
        canAnswerOrEnded: game?.canAnswer || game?.ended || lastQuestion,
        allowOrderAfterClose: isOrderQuestion && elapsedMs <= (questionTimeLimit * 1000 + graceMs),
        allowMatchingAfterClose: isMatchingQuestion && elapsedMs <= (questionTimeLimit * 1000 + graceMs),
        allowWordSearchAfterClose: isWordSearchQuestion && elapsedMs <= (questionTimeLimit * 1000 + graceMs)
    };
}

/**
 * Validate the current answer according to question type.
 *
 * @param {Object} ctx - Validation context.
 * @param {Object} ctx.payload - Command payload.
 * @param {Object} ctx.question - Current question.
 * @param {Object} ctx.flags - Question metadata flags.
 * @returns {{valid: boolean, reason: string|null}}
 */
// Tipos de respuesta libre (sin servicio de estado propio): cuándo es válido el payload
// y, si lo hay, el flag del plazo extra tras el cierre (envío automático).
const FREE_INPUT_CHECKS = [
    { flag: 'isNumericQuestion', isValid: (p) => Number.isFinite(Number(p.playerAnswer)) },
    { flag: 'isWordScrambleQuestion', isValid: (p) => typeof p.playerAnswer === 'string' && p.playerAnswer.trim().length > 0 },
    { flag: 'isWordSearchQuestion', lateFlag: 'allowWordSearchAfterClose', isValid: (p) => isValidFoundPayload(p.found) }
];

/**
 * Numérica, anagrama y sopa de letras. Devuelve null si la pregunta es de otro tipo.
 * @returns {{valid: boolean, reason: string|null}|null}
 */
function validateFreeInputAnswer(payload, flags) {
    const check = FREE_INPUT_CHECKS.find((c) => flags[c.flag]);
    if (!check) return null;
    const isOpen = flags.canAnswerOrEnded || flags.lastQuestion || Boolean(check.lateFlag && flags[check.lateFlag]);
    if (!isOpen) return { valid: false, reason: 'game-closed' };
    if (!check.isValid(payload)) return { valid: false, reason: 'invalid-payload' };
    return { valid: true, reason: null };
}

function validateAnswerByType({ payload, question, flags }) {
    const {
        index,
        order,
        matches,
        selectedIndices
    } = payload;

    const {
        canAnswerOrEnded,
        lastQuestion,
        isOrderQuestion,
        isMatchingQuestion,
        isMultipleChoiceQuestion,
        allowOrderAfterClose,
        allowMatchingAfterClose
    } = flags;

    if (isOrderQuestion) {
        return OrderAnswerStateService.validateOrderAnswer({
            question,
            order,
            gameCanAnswer: canAnswerOrEnded,
            allowWhenClosed: lastQuestion || allowOrderAfterClose
        });
    }

    if (isMatchingQuestion) {
        return MatchingAnswerStateService.validateMatchingAnswer({
            question,
            matches,
            gameCanAnswer: canAnswerOrEnded,
            allowWhenClosed: lastQuestion || allowMatchingAfterClose
        });
    }

    const freeInputResult = validateFreeInputAnswer(payload, flags);
    if (freeInputResult) return freeInputResult;

    if (isMultipleChoiceQuestion) {
        return MultipleChoiceAnswerStateService.validateMultipleChoiceAnswer({
            question,
            selectedIndices,
            gameCanAnswer: canAnswerOrEnded,
            allowWhenClosed: lastQuestion
        });
    }

    return AnswerStateService.validateAnswer({
        question,
        answerIndex: index,
        gameCanAnswer: canAnswerOrEnded,
        allowWhenClosed: lastQuestion
    });
}

module.exports = {
    resolveGameContext,
    buildQuestionContext,
    validateAnswerByType,
    applyTimerStateToLateWindow
};
