/**
 * @fileoverview Helper para extraer respuestas correctas (versión frontend)
 * Compatible con tipos: quiz, survey, order, numeric_approximation
 */

function _optionText(option) {
    return option.option_text || option.optionText || option.text || '';
}

function _isCorrectOption(option) {
    return option.is_correct || option.isCorrect;
}

function _hasOrderIndex(option) {
    return option && option.order_index !== null && option.order_index !== undefined;
}

/** Ordenar: por order_index si alguna opción lo tiene; si no, en el orden del array. */
function _extractOrderAnswer(question) {
    const options = question.options || [];
    const optionsArray = Array.isArray(options) ? options : [];
    if (optionsArray.length === 0) return null;

    const sortedOptions = optionsArray.some(_hasOrderIndex)
        ? optionsArray.filter(_hasOrderIndex).sort((a, b) => Number(a.order_index) - Number(b.order_index))
        : optionsArray.filter(o => o);
    if (sortedOptions.length === 0) return null;

    return {
        type: 'order',
        items: sortedOptions.map((opt, index) => ({
            position: index + 1,
            text: opt.option_text || opt.text || ''
        }))
    };
}

function _extractNumericAnswer(question) {
    const correctAnswer = question.correct_answer || question.correctAnswer;
    if (correctAnswer === undefined || correctAnswer === null) return null;
    return { type: 'numeric_approximation', display: correctAnswer };
}

function _extractWordScrambleAnswer(question) {
    const correctWord = question.correct_word || question.correctWord;
    return correctWord ? { type: 'word_scramble', word: correctWord } : null;
}

function _extractMultipleChoiceAnswer(question) {
    const correctOptions = (question.options || []).filter(_isCorrectOption);
    if (correctOptions.length === 0) return null;
    return { type: 'multiple_choice', items: correctOptions.map(_optionText) };
}

/** Quiz: primera opción correcta (formatos {is_correct} / {isCorrect}). */
function _extractQuizAnswer(question) {
    const correctOption = (question.options || []).find(_isCorrectOption);
    return correctOption ? { type: 'quiz', display: _optionText(correctOption) } : null;
}

const _CORRECT_ANSWER_EXTRACTORS = {
    survey: () => null,
    order: _extractOrderAnswer,
    numeric_approximation: _extractNumericAnswer,
    word_scramble: _extractWordScrambleAnswer,
    multiple_choice: _extractMultipleChoiceAnswer
};

/**
 * Extrae la respuesta correcta de una pregunta
 * @param {Object} question - Objeto pregunta
 * @returns {Object|null} { type, display, items } o null
 */
function extractCorrectAnswerFrontend(question) {
    if (!question) return null;
    const questionType = question.question_type || question.type;
    const extractor = Object.hasOwn(_CORRECT_ANSWER_EXTRACTORS, questionType)
        ? _CORRECT_ANSWER_EXTRACTORS[questionType]
        : _extractQuizAnswer;
    return extractor(question);
}

/**
 * Formatea la respuesta correcta como texto simple
 * @param {Object|null} answer - Resultado de extractCorrectAnswerFrontend
 * @returns {string}
 */
function formatCorrectAnswerDisplayFrontend(answer) {
    if (!answer) {
        return 'Sin respuesta correcta';
    }

    if (answer.type === 'order') {
        return answer.items.map((item, idx) => `${idx + 1}. ${item.text}`).join(' → ');
    }

    if (answer.type === 'numeric_approximation') {
        return answer.display.toString();
    }

    if (answer.type === 'quiz') {
        return answer.display;
    }

    if (answer.type === 'word_scramble') {
        return answer.word;
    }

    if (answer.type === 'multiple_choice') {
        return answer.items.join(', ');
    }

    return 'Sin respuesta correcta';
}
