/**
 * @fileoverview Payload del presentador al revelar una pregunta: tipo de pregunta, respuesta correcta,
 * porcentajes de encuesta, justificación, orden y parejas correctas. Lo usa GameEndManager.revealAnswer.
 */

const logger = require('../../config/logger');

/**
 * Calcula los indicadores de tipo de pregunta que usan el revelado y sus payloads.
 * @param {Object} question - Pregunta
 * @returns {Object<string, boolean>} isOrderQuestion, isMatchingQuestion, isSurveyQuestion, …
 */
function getQuestionFlags(question) {
    return {
        isOrderQuestion: question.question_type === 'order',
        isMatchingQuestion: question.question_type === 'matching',
        isSurveyQuestion: question.question_type === 'survey',
        isWordScrambleQuestion: question.question_type === 'word_scramble',
        isMultipleChoiceQuestion: question.question_type === 'multiple_choice',
        isNumericQuestion: question.question_type === 'numeric_approximation',
        isWordSearchQuestion: question.question_type === 'word_search',
        isFillBlanksQuestion: question.question_type === 'fill_blanks',
        isSurveyMultipleQuestion: question.question_type === 'survey_multiple'
    };
}

// Tipos sin una única opción correcta que marcar (no tienen correctIndex)
const NO_SINGLE_CORRECT_TYPES = new Set([
    'order',
    'matching',
    'survey',
    'word_scramble',
    'word_search',
    'multiple_choice',
    'fill_blanks',
    'survey_multiple'
]);

/**
 * Obtiene la respuesta correcta según el tipo: índice de opción (tipos de una sola correcta), valor (numérico) o
 * índices (selección múltiple).
 * @param {Object} question - Pregunta
 * @param {Object} flags - Resultado de getQuestionFlags
 * @returns {{correctIndex: number|null, correctAnswer: *, correctIndicesMultiple: number[]|null}} correctIndex es -1 si
 *   no hay opción marcada y null en tipos sin una única correcta
 */
function resolveCorrectAnswerData(question, flags) {
    const hasSingleCorrectIndex = !NO_SINGLE_CORRECT_TYPES.has(question.question_type);

    const correctIndex = hasSingleCorrectIndex ? (question.options?.findIndex(option => option.isCorrect) ?? -1) : null;

    let correctAnswer = null;
    if (flags.isNumericQuestion) {
        correctAnswer = question.correct_answer ?? null;
    } else if (hasSingleCorrectIndex) {
        correctAnswer = question.options?.[correctIndex]?.id || null;
    }

    const correctIndicesMultiple = flags.isMultipleChoiceQuestion
        ? question.options
              ?.map((option, idx) => (option.isCorrect || option.is_correct ? idx : null))
              .filter(idx => idx !== null)
        : null;

    if (!flags.isOrderQuestion && !flags.isMatchingQuestion) {
        logger.debug('Respuesta correcta:', {
            correctIndex: flags.isNumericQuestion ? null : correctIndex,
            correctAnswer,
            questionId: question.id
        });
    }

    return { correctIndex, correctAnswer, correctIndicesMultiple };
}

/**
 * Calcula votos y porcentaje (un decimal) de cada opción de una encuesta.
 * @param {Object} question - Pregunta
 * @param {Object<string, number>} stats - Votos por opción
 * @param {boolean} isSurveyQuestion - Si es encuesta
 * @returns {{count: number, percentage: number}[]|null} null si no es encuesta
 */
function buildSurveyPercentages(question, stats, isSurveyQuestion) {
    if (!isSurveyQuestion) {
        return null;
    }

    const optionCount = question.options?.length || 0;
    const totalVotes = Object.values(stats).reduce((sum, count) => sum + (Number(count) || 0), 0);

    return Array.from({ length: optionCount }).map((_, index) => {
        const count = Number(stats[index]) || 0;
        const rawPercentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const percentage = Math.round(rawPercentage * 10) / 10;
        return { count, percentage };
    });
}

function buildCorrectOrderPayload(currentQuestion) {
    const OrderAnswerService = require('../../domain/services/OrderAnswerService');
    const indices = OrderAnswerService.buildCorrectOrderIndices(currentQuestion.options || []);
    return indices.map(index => {
        const option = currentQuestion.options?.[index];
        return {
            id: option?.id || null,
            text: option?.text || option?.optionText || option?.option_text || '',
            justification: option?.justification || null
        };
    });
}

function buildCorrectMatchesPayload(currentQuestion) {
    return (currentQuestion.options || []).map(option => ({
        leftText: option.optionText || option.option_text || option.text || '',
        rightText: option.match_value || ''
    }));
}

/**
 * Reúne la opción correcta, la justificación y, según el tipo, el orden correcto o las parejas correctas.
 * @param {Object} currentQuestion - Pregunta
 * @param {Object} flags - Resultado de getQuestionFlags
 * @param {number|null} correctIndex - Índice de la opción correcta
 * @returns {{correctOption: Object|undefined, justificationText: string|null, correctOrder: Object[]|null,
 *   correctMatches: Object[]|null}}
 */
function buildJustificationData(currentQuestion, flags, correctIndex) {
    const correctOption =
        flags.isOrderQuestion || flags.isMatchingQuestion ? null : currentQuestion.options?.[correctIndex];

    const orderJustification = flags.isOrderQuestion
        ? currentQuestion.justification ||
          currentQuestion.options?.find(option => option?.justification)?.justification ||
          null
        : null;

    const justificationText = flags.isOrderQuestion ? orderJustification : correctOption?.justification || null;

    const correctOrder = flags.isOrderQuestion ? buildCorrectOrderPayload(currentQuestion) : null;
    const correctMatches = flags.isMatchingQuestion ? buildCorrectMatchesPayload(currentQuestion) : null;

    return {
        correctOption,
        justificationText,
        correctOrder,
        correctMatches
    };
}

/**
 * Monta el payload 'reveal-answer' del presentador.
 * @param {Object} input - correctIndex, correctOption, justificationText, stats, percentages, rankingFormatted,
 *   timeExpired, correctOrder, correctMatches, isSurveyQuestion
 * @returns {Object} Payload; correctAnswer es el texto de la opción correcta o null
 */
function buildPresenterPayload(input) {
    const {
        correctIndex,
        correctOption,
        justificationText,
        stats,
        percentages,
        rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurveyQuestion
    } = input;

    return {
        correctIndex,
        correctAnswer: correctOption?.text || correctOption?.optionText || correctOption?.option_text || null,
        justification: justificationText,
        stats,
        percentages,
        ranking: rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurvey: isSurveyQuestion
    };
}

module.exports = {
    getQuestionFlags,
    resolveCorrectAnswerData,
    buildSurveyPercentages,
    buildJustificationData,
    buildPresenterPayload
};
