/**
 * @fileoverview Páginas PDF de una pregunta word_search (Sopa de letras).
 * pdf.service.js prepara la pregunta una vez (ws_grid + ws_placements) para que
 * la página de la pregunta y la de su solución muestren la misma sopa. Los
 * colores de las palabras son los del núcleo del navegador (word-search-grid.js).
 */

'use strict';

const { prepareWordSearchQuestion } = require('../domain/services/WordSearchService');
const WordSearchGrid = require('../public/js/core/word-search-grid');

const CELL_PX = 46;

/** Estilo de cada celda que forma parte de una palabra (solo en la solución) */
function solutionCellStyles(question) {
    const words = question.ws_words || [];
    const styles = {};
    (question.ws_placements || []).forEach(placement => {
        const index = words.indexOf(placement.word);
        if (index === -1) return;
        const color = WordSearchGrid.colorFor(index);
        WordSearchGrid.placementCells(placement).forEach(([r, c]) => {
            styles[`${r},${c}`] = `background: ${color}; color: ${WordSearchGrid.inkFor(color)}; border-radius: 8px;`;
        });
    });
    return styles;
}

function buildGridHTML(grid, escapeHtml, cellStyles = {}) {
    if (!Array.isArray(grid)) {
        return '<div style="color: rgba(255,255,255,0.75); font-size: 20px; font-style: italic;">(Rejilla no disponible)</div>';
    }
    const cells = grid.flatMap((row, r) => [...row].map((letter, c) => `
                <div style="width: ${CELL_PX}px; height: ${CELL_PX}px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; color: #1e293b; ${cellStyles[`${r},${c}`] || ''}">${escapeHtml(letter)}</div>`)).join('');
    return `
            <div style="display: inline-grid; grid-template-columns: repeat(${grid.length}, ${CELL_PX}px); background: rgba(255,255,255,0.95); padding: 12px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">${cells}
            </div>`;
}

function buildWordsHTML(words, escapeHtml, withColors = false) {
    return words.map((word, i) => {
        const colors = withColors ? WordSearchGrid.chipStyle(i) : 'background: rgba(255,255,255,0.2); color: white';
        return `
                <span style="${colors}; padding: 8px 16px; border-radius: 10px; font-size: 20px; font-weight: 700; letter-spacing: 2px;">${escapeHtml(word)}</span>`;
    }).join('');
}

function withGrid(question) {
    return Array.isArray(question.ws_grid) ? question : prepareWordSearchQuestion(question);
}

/**
 * Página de la pregunta: rejilla sin marcar, enunciado y palabras a buscar.
 * @param {Object} question - Pregunta (preparada o del banco: options = palabras)
 * @param {number} index
 * @param {number} total
 * @param {Function} escapeHtml
 * @returns {string}
 */
function generateWordSearchQuestionHTML(question, index, total, escapeHtml) {
    const prepared = withGrid(question);
    const textSize = (question.question_text || '').length > 150 ? '24px' : '28px';

    return `
<div class="page" style="background: linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%);">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Pregunta ${index} de ${total}
    </div>
    <div style="width: 100%; max-width: 1100px; display: flex; gap: 36px; align-items: center; justify-content: center;">
        ${buildGridHTML(prepared.ws_grid, escapeHtml)}
        <div style="flex: 1; max-width: 460px; text-align: left;">
            <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 10px 24px; border-radius: 12px; color: white; font-size: 20px; font-weight: 700; margin-bottom: 18px;">
                🔎 SOPA DE LETRAS &mdash; ${prepared.ws_words.length} palabras
            </div>
            <div style="background: rgba(255,255,255,0.95); padding: 26px 30px; border-radius: 20px; margin-bottom: 20px; font-size: ${textSize}; font-weight: 700; color: #1e293b; line-height: 1.4;">
                ${escapeHtml(question.question_text)}
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">${buildWordsHTML(prepared.ws_words, escapeHtml)}
            </div>
        </div>
    </div>
</div>
    `.trim();
}

/**
 * Contenido de la página de respuesta: la misma rejilla con cada palabra
 * pintada en su color y la lista de palabras con esos colores.
 * @param {Object} question - Pregunta ya preparada (ws_grid, ws_words, ws_placements)
 * @param {Function} escapeHtml
 * @returns {string}
 */
function generateWordSearchSolutionHTML(question, escapeHtml) {
    const prepared = withGrid(question);
    return `
        <div style="display: flex; gap: 36px; align-items: center; justify-content: center;">
            ${buildGridHTML(prepared.ws_grid, escapeHtml, solutionCellStyles(prepared))}
            <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-start;">${buildWordsHTML(prepared.ws_words, escapeHtml, true)}
            </div>
        </div>`;
}

module.exports = {
    generateWordSearchQuestionHTML,
    generateWordSearchSolutionHTML
};
