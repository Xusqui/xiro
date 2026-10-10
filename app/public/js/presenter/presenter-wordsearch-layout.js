/**
 * @fileoverview Layout del presentador para preguntas word_search (Sopa de letras).
 * Durante la pregunta proyecta la misma rejilla que ven los móviles y la lista
 * de palabras; al revelar, pinta cada palabra (en el orden de la lista) celda a
 * celda con el color de su ficha y muestra qué porcentaje de jugadores la encontró.
 * Geometría en core/word-search-grid.js.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

const WORD_STEP_MS = 450;
const CELL_STEP_MS = 60;

function ws() {
    return window.XiroWordSearch;
}

/**
 * HTML del área de la pregunta: rejilla + lista de palabras.
 * @param {object} q - Pregunta con ws_grid y ws_words
 * @returns {string}
 */
export function renderWordSearchPresenter(q) {
    const grid = Array.isArray(q.ws_grid) ? q.ws_grid : [];
    const words = Array.isArray(q.ws_words) ? q.ws_words : [];
    if (grid.length === 0 || !ws()) return '';

    const chips = words.map((word, i) =>
        `<span class="ws-word" role="listitem" data-word-index="${i}">${escapeHtml(word)}</span>`
    ).join('');

    return `
        <div id="ws-stage" class="flex items-center justify-center pb-14" style="gap: 4vh;">
            ${ws().gridHtml(grid, 'wsg--stage', _t('common.wordsearch.grid_label', null, 'Sopa de letras'))}
            <div class="ws-words ws-words--stage" role="list" style="flex-direction: column; align-items: flex-start;">${chips}</div>
        </div>`;
}

/** Porcentaje de jugadores que encontraron la palabra `index` (null si nadie respondió) */
export function foundPercent(foundStats, index) {
    const answers = foundStats?.answers || 0;
    if (answers === 0) return null;
    return Math.round(((foundStats.counts?.[index] || 0) / answers) * 100);
}

function paintWord(stage, placement, index, animate, percent) {
    const cells = ws().placementCells(placement);
    if (animate) {
        cells.forEach(([r, c], i) => {
            const cell = stage.querySelector(`.wsg-cell[data-r="${r}"][data-c="${c}"]`);
            if (!cell) return;
            cell.style.animationDelay = `${i * CELL_STEP_MS}ms`;
            cell.classList.add('wsg-reveal');
        });
    }
    ws().paintCells(stage, cells, ws().colorFor(index));
    ws().paintChip(stage, index);

    const chip = stage.querySelector(`.ws-word[data-word-index="${index}"]`);
    if (chip && percent !== null) {
        chip.insertAdjacentHTML('beforeend', `<span class="ws-word-stat">${percent}%</span>`);
    }
}

/**
 * Revela dónde estaba cada palabra y cuántos la encontraron.
 * @param {{ words: string[], placements: Array<{word,row,col,dr,dc}>, foundStats?: {answers:number, counts:number[]} }} wordSearch
 */
export function revealWordSearchOnStage(wordSearch) {
    const stage = document.getElementById('ws-stage');
    if (!stage || !wordSearch || !ws()) return;

    const words = wordSearch.words || [];
    const animate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ordered = (wordSearch.placements || [])
        .map(p => ({ p, index: words.indexOf(p.word) }))
        .filter(item => item.index !== -1)
        .sort((a, b) => a.index - b.index);

    ordered.forEach(({ p, index }, order) => {
        const percent = foundPercent(wordSearch.foundStats, index);
        if (!animate) {
            paintWord(stage, p, index, false, percent);
            return;
        }
        setTimeout(() => paintWord(stage, p, index, true, percent), order * WORD_STEP_MS);
    });
}
