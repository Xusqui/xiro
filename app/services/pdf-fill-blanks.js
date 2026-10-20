/**
 * @fileoverview Páginas PDF de una pregunta fill_blanks («Completa la frase»).
 * La página de la pregunta muestra la frase con una casilla vacía por letra en cada
 * hueco; la de la respuesta, la misma frase con las palabras escritas en verde.
 * Estilos en línea (el PDF no carga las hojas CSS del navegador).
 */

'use strict';

const FB = require('../public/js/core/fill-blanks-text.js');

const CELL_PX = 38;

/** Palabras de la pregunta (preparada o del banco: options = palabras) */
function wordsOf(question) {
    return Array.isArray(question.fb_words) ? question.fb_words : FB.wordsFromOptions(question.options);
}

function cellHtml(letter, escapeHtml, filled) {
    const colors = filled
        ? 'background: #16a34a; color: white; border-bottom: 4px solid #14532d;'
        : 'background: rgba(255,255,255,0.18); color: white; border-bottom: 4px solid rgba(255,255,255,0.6);';
    return `<span style="display: inline-block; width: ${CELL_PX}px; height: ${CELL_PX + 8}px; line-height: ${CELL_PX + 6}px; margin: 0 2px; border-radius: 8px; text-align: center; font-size: 26px; font-weight: 900; ${colors}">${escapeHtml(letter)}</span>`;
}

/**
 * Frase con casillas (vacías o con las letras de cada palabra).
 * @param {Object} question
 * @param {Function} escapeHtml
 * @param {boolean} filled - true en la solución
 * @returns {string}
 */
function buildSentenceHTML(question, escapeHtml, filled) {
    const words = wordsOf(question);
    return FB.splitSegments(question.question_text || '')
        .map(segment => {
            if (segment.type === 'text')
                return `<span style="white-space: pre-wrap;">${escapeHtml(segment.value)}</span>`;
            const word = words[segment.index] || '';
            const cells = [...word].map(letter => cellHtml(filled ? letter : '', escapeHtml, filled)).join('');
            return `<span style="display: inline-block; white-space: nowrap; margin: 6px 4px; vertical-align: middle;">${cells}</span>`;
        })
        .join('');
}

/**
 * Página de la pregunta: frase con los huecos vacíos y número de palabras.
 */
function generateFillBlanksQuestionHTML(question, index, total, escapeHtml) {
    const words = wordsOf(question);
    return `
<div class="page" style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px; text-align: center;">
        <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 10px 24px; border-radius: 12px; color: white; font-size: 20px; font-weight: 700; margin-bottom: 30px;">
            ✏️ COMPLETA LA FRASE &mdash; ${words.length} ${words.length === 1 ? 'palabra' : 'palabras'}
        </div>
        <div style="background: rgba(0,0,0,0.25); padding: 36px 40px; border-radius: 24px; color: white; font-size: 30px; font-weight: 700; line-height: 2.1;">
            ${buildSentenceHTML(question, escapeHtml, false)}
        </div>
        <div style="margin-top: 24px; color: rgba(255,255,255,0.8); font-size: 18px;">
            Cada hueco tiene tantas casillas como letras. Puntúa cada palabra acertada + bonus de tiempo.
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Contenido de la página de respuesta: la frase con las palabras en sus huecos.
 */
function generateFillBlanksSolutionHTML(question, escapeHtml) {
    const words = wordsOf(question);
    const chips = words
        .map(
            word => `
                <span style="background: rgba(16, 185, 129, 0.25); border: 3px solid #10b981; color: white; padding: 8px 18px; border-radius: 12px; font-size: 24px; font-weight: 800; letter-spacing: 2px;">${escapeHtml(word)}</span>`
        )
        .join('');
    return `
        <div style="text-align: center; color: white; font-size: 30px; font-weight: 700; line-height: 2.1; margin-bottom: 30px;">
            ${buildSentenceHTML(question, escapeHtml, true)}
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">${chips}
        </div>`;
}

module.exports = {
    buildSentenceHTML,
    generateFillBlanksQuestionHTML,
    generateFillBlanksSolutionHTML
};
