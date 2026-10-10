/**
 * @fileoverview Helper para revelación de resultados por equipos
 * Resuelve respuesta correcta y corrección para diferentes tipos de preguntas
 */

function resolveTeamRevealCorrectness(question, playerAnswerState) {
    // CRITICAL FIX: SIEMPRE usar isCorrect ya calculado
    // No recalcular para numeric/word_scramble porque usa lógica diferente (solo exacta)
    // y causa inconsistencia: inicialmente correcto → luego incorrecto
    return playerAnswerState?.isCorrect;
}

function resolveTeamRevealCorrectAnswer(question, correctOption, isOrderQuestion, isSurvey) {
    if (isOrderQuestion || isSurvey) {
        return null;
    }

    if (question?.question_type === 'numeric_approximation') {
        return question.correct_answer ?? null;
    }

    if (question?.question_type === 'word_scramble') {
        return question.correct_word ?? null;
    }

    if (question?.question_type === 'word_search') {
        return (question.ws_words || []).join(', ');
    }

    return correctOption?.text || correctOption?.optionText || correctOption?.option_text || '';
}

module.exports = {
    resolveTeamRevealCorrectness,
    resolveTeamRevealCorrectAnswer
};
