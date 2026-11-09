/**
 * @fileoverview Páginas de pregunta del PDF de cuestionarios: anagrama, selección múltiple (y encuesta de
 * selección múltiple) y pregunta estándar con opciones. pdf.service.js elige cuál usar.
 */

const logger = require('../config/logger');
const { escapeHtml } = require('./pdf-html');
const { generateMultimediaHTML } = require('./pdf-multimedia');

function resolveScrambledLetters(question) {
    let scrambledLetters = question.scrambled_letters || [];
    if (scrambledLetters.length === 0 && question.correct_word) {
        const arr = question.correct_word.toUpperCase().split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        scrambledLetters = arr;
    }
    return scrambledLetters;
}

function buildWordScrambleEmptyBoxes(wordLength) {
    return Array.from(
        { length: wordLength },
        () => `
            <div style="background: rgba(255,255,255,0.15); border: 3px solid rgba(255,255,255,0.5); border-bottom: 5px solid rgba(255,255,255,0.8); width: 62px; height: 62px; border-radius: 10px;">
            </div>
        `
    ).join('');
}

function buildWordScrambleLettersHTML(scrambledLetters) {
    if (scrambledLetters.length === 0) {
        return '<div style="color: rgba(255,255,255,0.75); font-size: 20px; font-style: italic;">(Letras disponibles en el dispositivo del jugador)</div>';
    }

    return scrambledLetters
        .map(
            letter => `
                <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; width: 55px; height: 55px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; text-transform: uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    ${escapeHtml(letter)}
                </div>
            `
        )
        .join('');
}

/**
 * Página PDF de una pregunta de anagrama: casillas vacías y letras desordenadas.
 * @param {Object} question - Pregunta
 * @param {number} index - Número de pregunta (base 1)
 * @param {number} total - Total de preguntas
 * @returns {string} HTML de la página
 */
function generateWordScrambleQuestionHTML(question, index, total) {
    const wordLength = question.word_length || (question.correct_word ? String(question.correct_word).length : 7);
    const emptyBoxes = buildWordScrambleEmptyBoxes(wordLength);
    const scrambledLetters = resolveScrambledLetters(question);
    const lettersHTML = buildWordScrambleLettersHTML(scrambledLetters);

    return `
<div class="page" style="background: linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px; text-align: center;">
        <div style="margin-bottom: 22px;">
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 22px; font-weight: 700;">
                🔤 ANAGRAMA &mdash; Palabra de ${wordLength} letras
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); padding: 35px 45px; border-radius: 24px; margin-bottom: 26px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
            <div style="font-size: ${(question.question_text || '').length > 150 ? '28px' : '32px'}; font-weight: 700; color: #1e293b; line-height: 1.4;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                ${emptyBoxes}
            </div>
        </div>
        <div>
            <div style="color: rgba(255,255,255,0.8); font-size: 18px; font-weight: 600; margin-bottom: 14px; letter-spacing: 1px;">LETRAS DISPONIBLES</div>
            <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                ${lettersHTML}
            </div>
        </div>
    </div>
</div>
    `.trim();
}

function buildOptionsHTML(options, letterGradient) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    return options
        .map((opt, idx) => {
            const optionText = opt.text || opt.option_text || '';

            return `
            <div style="background: white; padding: 20px 30px; border-radius: 16px; margin-bottom: 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; align-items: center;">
                <div style="background: linear-gradient(135deg, ${letterGradient}); color: white; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 24px; margin-right: 20px; flex-shrink: 0;">
                    ${letters[idx]}
                </div>
                <div style="flex: 1;">${escapeHtml(optionText)}</div>
            </div>
        `;
        })
        .join('');
}

// Selección múltiple y encuesta de selección múltiple: misma página, otro rótulo y otro color
const MULTI_SELECT_PAGE = {
    multiple_choice: {
        letters: '#06b6d4 0%, #0891b2 100%',
        background: '#0e7490 0%, #06b6d4 50%, #22d3ee 100%',
        label: '✓ SELECCIÓN MÚLTIPLE &mdash; Pueden haber varias respuestas correctas'
    },
    survey_multiple: {
        letters: '#3b82f6 0%, #1d4ed8 100%',
        background: '#1e40af 0%, #2563eb 50%, #60a5fa 100%',
        label: 'ENCUESTA DE SELECCIÓN MÚLTIPLE &mdash; Se pueden marcar varias respuestas'
    }
};

/**
 * Página PDF de una pregunta de selección múltiple o encuesta de varias respuestas.
 * @param {Object} question - Pregunta
 * @param {number} index - Número de pregunta (base 1)
 * @param {number} total - Total de preguntas
 * @returns {string} HTML de la página
 */
function generateMultipleChoiceQuestionHTML(question, index, total) {
    const page = MULTI_SELECT_PAGE[question.question_type] || MULTI_SELECT_PAGE.multiple_choice;
    const optionsHTML = buildOptionsHTML(question.options || [], page.letters);

    return `
<div class="page" style="background: linear-gradient(135deg, ${page.background});">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 24px; font-weight: 700; margin-bottom: 25px;">
                ${page.label}
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 35px 45px; border-radius: 24px; margin-bottom: 25px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
            <div style="font-size: ${(question.question_text || '').length > 150 ? '28px' : '32px'}; font-weight: 700; color: #1e293b; line-height: 1.4; text-align: center;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        <div style="margin-top: 20px;">
            ${optionsHTML}
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Página PDF de una pregunta de opciones, con su multimedia si la tiene.
 * @param {Object} question - Pregunta
 * @param {number} index - Número de pregunta (base 1)
 * @param {number} total - Total de preguntas
 * @returns {string} HTML de la página
 */
function generateStandardQuestionHTML(question, index, total) {
    logger.debug(`Pregunta ${index}:`, {
        id: question.question_id,
        tipo_contenido: question.tipo_contenido,
        url_recurso: question.url_recurso
    });

    const multimediaHTML = generateMultimediaHTML(question);
    const optionsHTML = buildOptionsHTML(question.options || [], '#667eea 0%, #764ba2 100%');

    return `
<div class="page" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 24px; font-weight: 700; margin-bottom: 25px;">
                PREGUNTA
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 35px 45px; border-radius: 24px; margin-bottom: 25px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
            <div style="font-size: ${(question.question_text || '').length > 150 ? '28px' : '32px'}; font-weight: 700; color: #1e293b; line-height: 1.4; text-align: center;">
                ${escapeHtml(question.question_text)}
            </div>
        </div>
        ${multimediaHTML}
        <div style="margin-top: 20px;">
            ${optionsHTML}
        </div>
    </div>
</div>
    `.trim();
}

module.exports = { generateWordScrambleQuestionHTML, generateMultipleChoiceQuestionHTML, generateStandardQuestionHTML };
