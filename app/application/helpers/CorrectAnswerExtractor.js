/**
 * @fileoverview Extractor para obtener la respuesta correcta de una pregunta
 * Compatible con diferentes tipos de preguntas: quiz, survey, order, numeric_approximation
 */

/**
 * Extrae la respuesta correcta de una pregunta basada en su tipo
 * @param {Object} question - Objeto pregunta con estructura: { question_type, options, correct_answer }
 * @returns {Object|null} { type, display, items, optionIndex } o null si no hay respuesta correcta
 *
 * @example
 * // Para preguntas tipo 'order'
 * const answer = extractCorrectAnswer(question);
 * // Devuelve: { type: 'order', items: [{ text: 'Item 1', justification: '...' }, ...] }
 *
 * @example
 * // Para preguntas tipo 'numeric_approximation'
 * const answer = extractCorrectAnswer(question);
 * // Devuelve: { type: 'numeric_approximation', display: 12756 }
 *
 * @example
 * // Para preguntas tipo 'quiz'
 * const answer = extractCorrectAnswer(question);
 * // Devuelve: { type: 'quiz', display: 'Opción A', optionIndex: 0 }
 */
function toOptionsArray(options) {
    return Array.isArray(options) ? options : [];
}

function hasOrderIndex(option) {
    return option && option.order_index !== null && option.order_index !== undefined;
}

function getQuestionType(question) {
    return question?.question_type || question?.type || null;
}

function getOptionText(option) {
    return option?.option_text || option?.optionText || option?.text || '';
}

function extractOrderAnswer(question) {
    const optionsArray = toOptionsArray(question.options).filter(Boolean);
    if (optionsArray.length === 0) {
        return null;
    }

    const hasOrderIndices = optionsArray.some(hasOrderIndex);
    const sortedOptions = hasOrderIndices
        ? optionsArray.filter(hasOrderIndex).sort((a, b) => Number(a.order_index) - Number(b.order_index))
        : optionsArray;

    if (sortedOptions.length === 0) {
        return null;
    }

    return {
        type: 'order',
        items: sortedOptions.map((opt, index) => ({
            position: index + 1,
            text: opt.option_text || opt.text || '',
            justification: opt.justification || ''
        }))
    };
}

function extractNumericAnswer(question) {
    const correctAnswer = question.correct_answer ?? question.correctAnswer;
    if (correctAnswer === undefined || correctAnswer === null) {
        return null;
    }

    return {
        type: 'numeric_approximation',
        display: correctAnswer
    };
}

function extractWordScrambleAnswer(question) {
    const correctWord = question.correct_word || question.correctWord;
    if (!correctWord) {
        return null;
    }

    return {
        type: 'word_scramble',
        word: correctWord
    };
}

function extractMultipleChoiceAnswer(question) {
    const correctOptions = toOptionsArray(question.options)
        .filter(option => option && (option.is_correct || option.isCorrect));

    if (correctOptions.length === 0) {
        return null;
    }

    return {
        type: 'multiple_choice',
        items: correctOptions.map(getOptionText)
    };
}

function extractQuizAnswer(question) {
    const optionsArray = toOptionsArray(question.options);
    const correctOption = optionsArray.find(option => option && (option.is_correct || option.isCorrect));

    if (!correctOption) {
        return null;
    }

    return {
        type: 'quiz',
        display: getOptionText(correctOption),
        optionIndex: optionsArray.indexOf(correctOption)
    };
}

const ANSWER_EXTRACTORS = {
    order: extractOrderAnswer,
    numeric_approximation: extractNumericAnswer,
    word_scramble: extractWordScrambleAnswer,
    multiple_choice: extractMultipleChoiceAnswer
};

function extractCorrectAnswer(question) {
    if (!question) {
        return null;
    }

    const questionType = getQuestionType(question);
    if (!questionType || questionType === 'survey') {
        return null;
    }

    const extractor = ANSWER_EXTRACTORS[questionType] || extractQuizAnswer;
    return extractor(question);
}

/**
 * Formatea la respuesta correcta para mostrar en texto simple
 * @param {Object|null} answer - Resultado de extractCorrectAnswer
 * @returns {string} Texto formateado de la respuesta correcta o 'Sin respuesta correcta'
 */
function formatCorrectAnswerForDisplay(answer) {
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

/**
 * Genera HTML para mostrar la respuesta correcta en un formato visual
 * @param {Object|null} answer - Resultado de extractCorrectAnswer
 * @returns {string} HTML formateado
 */
function generateCorrectAnswerHTML(answer) {
    if (!answer) {
        return `
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 40px; border-radius: 20px; text-align: center;">
                <div style="font-size: 28px; color: white; font-style: italic;">
                    Esta pregunta no tiene una respuesta correcta marcada<br/>(puede ser una encuesta)
                </div>
            </div>
        `;
    }

    if (answer.type === 'order') {
        return `
            <div style="background: transparent; padding: 0;">
                <ol style="list-style-position: inside; color: white; font-size: 24px; line-height: 1.8; margin: 0; padding: 0;">
                    ${answer.items.map((item) => `
                        <li style="margin-bottom: 8px;">
                            <strong>${escapeHtml(item.text)}</strong>
                            ${item.justification ? `<div style="margin-left: 20px; font-size: 18px; font-weight: normal; color: rgba(255,255,255,0.9); margin-top: 4px;">→ ${escapeHtml(item.justification)}</div>` : ''}
                        </li>
                    `).join('')}
                </ol>
            </div>
        `;
    }

    if (answer.type === 'numeric_approximation') {
        return `
            <div style="background: rgba(16, 185, 129, 0.15); backdrop-filter: blur(10px); padding: 40px; border-radius: 20px; border: 3px solid #10b981; text-align: center;">
                <div style="font-size: 48px; font-weight: 900; color: #10b981; margin-bottom: 15px;">
                    ${answer.display}
                </div>
                <div style="color: rgba(255,255,255,0.9); font-size: 20px;">
                    Respuesta numérica correcta
                </div>
            </div>
        `;
    }

    if (answer.type === 'quiz') {
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        const letter = letters[answer.optionIndex] || '?';
        return `
            <div style="background: rgba(16, 185, 129, 0.15); backdrop-filter: blur(10px); padding: 30px 40px; border-radius: 20px; margin-bottom: 20px; border: 3px solid #10b981;">
                <div style="font-size: 36px; font-weight: 700; color: #059669; margin-bottom: 15px; display: flex; align-items: center;">
                    <span style="margin-right: 15px;">✓</span>
                    <span style="background: #10b981; color: white; width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-right: 20px;">${letter}</span>
                    <span style="color: white; flex: 1;">${escapeHtml(answer.display)}</span>
                </div>
            </div>
        `;
    }

    if (answer.type === 'word_scramble') {
        const letters = answer.word.toUpperCase().split('');
        return `
            <div style="text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 24px; letter-spacing: 2px; text-transform: uppercase;">
                    PALABRA CORRECTA
                </div>
                <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                    ${letters.map(letter => `
                        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; width: 70px; height: 70px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 900; text-transform: uppercase; box-shadow: 0 6px 16px rgba(0,0,0,0.3);">
                            ${escapeHtml(letter)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (answer.type === 'multiple_choice') {
        return `
            <div style="text-align: left;">
                <div style="font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.9); margin-bottom: 24px; letter-spacing: 1px; text-align: center;">
                    ✓ RESPUESTAS CORRECTAS (Pueden ser múltiples)
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${answer.items.map(item => `
                        <div style="background: rgba(16, 185, 129, 0.15); backdrop-filter: blur(10px); padding: 20px 30px; border-radius: 16px; border: 3px solid #10b981;">
                            <div style="font-size: 28px; font-weight: 700; color: white; display: flex; align-items: center;">
                                <span style="color: #10b981; margin-right: 15px; font-size: 32px;">✓</span>
                                <span>${escapeHtml(item)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    return ''; // Fallback
}

/**
 * Escapa HTML para evitar inyección de código
 * @param {string} text - Texto para escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = {
    extractCorrectAnswer,
    formatCorrectAnswerForDisplay,
    generateCorrectAnswerHTML
};
