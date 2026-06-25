/**
 * @fileoverview Helper para extraer respuestas correctas (versión frontend)
 * Compatible con tipos: quiz, survey, order, numeric_approximation
 */

/**
 * Extrae la respuesta correcta de una pregunta
 * @param {Object} question - Objeto pregunta
 * @returns {Object|null} { type, display, items } o null
 */
function extractCorrectAnswerFrontend(question) {
    if (!question) return null;

    const questionType = question.question_type || question.type;

    if (questionType === 'survey') {
        return null;
    }

    // Tipo 'order'
    if (questionType === 'order') {
        const options = question.options || [];

        if (options.length === 0) return null;

        const optionsArray = Array.isArray(options) ? options : [];
        if (optionsArray.length === 0) return null;

        // Estrategia: Si hayorder_index definido, úsalo. Si no, usa orden del array
        const hasOrderIndices = optionsArray.some(o => o && o.order_index !== null && o.order_index !== undefined);

        let sortedOptions;
        if (hasOrderIndices) {
            sortedOptions = optionsArray
                .filter(o => o && (o.order_index !== null && o.order_index !== undefined))
                .sort((a, b) => Number(a.order_index) - Number(b.order_index));
        } else {
            sortedOptions = optionsArray.filter(o => o);
        }

        if (sortedOptions.length === 0) return null;

        return {
            type: 'order',
            items: sortedOptions.map((opt, index) => ({
                position: index + 1,
                text: opt.option_text || opt.text || ''
            }))
        };
    }

    // Tipo 'numeric_approximation'
    if (questionType === 'numeric_approximation') {
        const correctAnswer = question.correct_answer || question.correctAnswer;
        if (correctAnswer !== undefined && correctAnswer !== null) {
            return {
                type: 'numeric_approximation',
                display: correctAnswer
            };
        }
        return null;
    }

    // Tipo 'word_scramble'
    if (questionType === 'word_scramble') {
        const correctWord = question.correct_word || question.correctWord;
        if (correctWord) {
            return {
                type: 'word_scramble',
                word: correctWord
            };
        }
        return null;
    }

    // Tipo 'multiple_choice'
    if (questionType === 'multiple_choice') {
        const options = question.options || [];
        const correctOptions = options.filter(o => o.is_correct || o.isCorrect);

        if (correctOptions.length > 0) {
            return {
                type: 'multiple_choice',
                items: correctOptions.map(opt =>
                    opt.option_text || opt.optionText || opt.text || ''
                )
            };
        }
        return null;
    }

    // Tipo 'quiz'
    const options = question.options || [];
    // Soporta ambos formatos: {is_correct} y {isCorrect}
    const correctOption = options.find(o => o.is_correct || o.isCorrect);

    if (correctOption) {
        // Soporta ambos formatos: option_text y text
        const text = correctOption.option_text || correctOption.optionText || correctOption.text || '';
        return {
            type: 'quiz',
            display: text
        };
    }

    return null;
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
