/**
 * @fileoverview Página de respuesta del PDF de cuestionarios (la que sigue a cada pregunta).
 */

const { extractCorrectAnswer, generateCorrectAnswerHTML } = require('../application/helpers/CorrectAnswerExtractor');
const { generateWordSearchSolutionHTML } = require('./pdf-word-search');
const { generateFillBlanksSolutionHTML } = require('./pdf-fill-blanks');
const { escapeHtml } = require('./pdf-html');

/** Respuesta según el tipo: sopa y Completa la frase tienen su propia página */
function answerContentHTML(question) {
    if (question.question_type === 'word_search') return generateWordSearchSolutionHTML(question, escapeHtml);
    if (question.question_type === 'fill_blanks') return generateFillBlanksSolutionHTML(question, escapeHtml);
    return generateCorrectAnswerHTML(extractCorrectAnswer(question));
}

/** Enunciado del pie de la respuesta: en Completa la frase, con las palabras entre corchetes */
function answerQuestionText(question) {
    if (question.question_type !== 'fill_blanks') return question.question_text;
    const FB = require('../public/js/core/fill-blanks-text.js');
    return FB.toEditorText(question.question_text || '', question.fb_words || FB.wordsFromOptions(question.options));
}

/**
 * Genera HTML de la respuesta
 */
function generateAnswerHTML(question, index) {
    const answerHTML = answerContentHTML(question);

    return `
<div class="page" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} - RESPUESTA
    </div>
    <div style="width: 100%; max-width: 1100px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); display: inline-block; padding: 12px 30px; border-radius: 12px; color: white; font-size: 24px; font-weight: 700; margin-bottom: 25px;">
                ✓ RESPUESTA CORRECTA
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 25px 35px; border-radius: 20px; margin-bottom: 35px;">
            <div style="font-size: 22px; color: rgba(255,255,255,0.95); font-style: italic; text-align: center; line-height: 1.5;">
                ${escapeHtml(answerQuestionText(question))}
            </div>
        </div>
        ${answerHTML}
    </div>
</div>
    `.trim();
}

module.exports = { generateAnswerHTML };
