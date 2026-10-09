/**
 * @fileoverview Tablero del presentador para preguntas matching (Emparejar).
 * Columna fija a la izquierda, con los colores por posición del móvil, y a la
 * derecha la que ordena cada jugador, en ámbar y barajada sin ningún par en su
 * fila. Al revelar, cada ficha ámbar se desliza hasta la fila de su pareja.
 */

import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

// Mismo orden de colores que la rejilla del presentador y el móvil del jugador
const LEFT_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-plum-500', 'bg-pink-500'];
const MIN_FONT_PX = 12;
const MAX_FONT_PX = 72;

/** Hash FNV-1a: la misma pregunta da siempre la misma semilla. */
function hashSeed(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** Generador mulberry32: aleatorio pero reproducible a partir de la semilla. */
function seededRandom(seed) {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Orden proyectado de la columna derecha: posición → índice de la opción.
 * Algoritmo de Sattolo (un solo ciclo), así ningún par queda en su fila y la
 * proyección no chiva la respuesta. Determinista por pregunta, para que un
 * presentador que reconecta vea el mismo orden.
 */
export function matchingDisplayOrder(count, seedText) {
    const order = Array.from({ length: count }, (_, i) => i);
    const random = seededRandom(hashSeed(String(seedText)));
    for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(random() * i);
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function leftText(opt) {
    return opt.optionText || opt.option_text || opt.text || '';
}

function leftTileHtml(opt, row) {
    return `
                    <div class="stage-matching-tile ${LEFT_COLORS[row % LEFT_COLORS.length]}" style="grid-row: ${row + 1}; grid-column: 1;">
                        <span class="stage-matching-num">${row + 1}</span>
                        <span class="stage-matching-text">${escapeHtml(leftText(opt))}</span>
                    </div>`;
}

function arrowHtml(row) {
    return `
                    <div class="stage-matching-arrow" style="grid-row: ${row + 1};" aria-hidden="true"><i class="fas fa-arrows-left-right"></i></div>`;
}

/** Ficha ámbar: --shift = filas que baja (o sube) al revelar hasta su pareja. */
function movingTileHtml(opt, optionIndex, row) {
    return `
                    <div class="stage-matching-tile stage-matching-moving bg-amber-500" style="grid-row: ${row + 1}; grid-column: 3; --shift: ${optionIndex - row}; --order: ${row};">
                        <span class="stage-matching-text">${escapeHtml(opt.match_value || '')}</span>
                        <i class="fas fa-grip-lines stage-matching-grip" aria-hidden="true"></i>
                    </div>`;
}

/** HTML del tablero para la zona de respuesta de la pregunta. */
export function renderMatchingPresenter(q) {
    const options = Array.isArray(q.options) ? q.options : [];
    const order = matchingDisplayOrder(options.length, `${q.id ?? ''}|${q.question_text || ''}`);
    const rows = options.map((opt, row) =>
        leftTileHtml(opt, row) + arrowHtml(row) + movingTileHtml(options[order[row]], order[row], row)
    ).join('');

    return `
            <div id="matching-board" class="stage-matching">
                <div class="stage-matching-caps">
                    <span>${_t('presenter.matching.fixed_column', null, 'Columna fija')}</span>
                    <span class="stage-matching-caps-moving">
                        <span class="stage-matching-when-playing"><i class="fas fa-grip-lines mr-2"></i>${_t('presenter.matching.moving_column', null, 'La ordena cada jugador')}</span>
                        <span class="stage-matching-when-revealed">${_t('presenter.reveal.correct_pairs', null, 'Pares correctos')}</span>
                    </span>
                </div>
                <div class="stage-matching-grid" style="--pairs: ${options.length};">
                    ${rows}
                </div>
            </div>`;
}

/**
 * Revela los pares en el propio tablero: las fichas ámbar se deslizan a su
 * fila (transición en presenter-matching.css).
 * @returns {boolean} false si no hay tablero (pregunta con imagen principal)
 */
export function revealMatchingBoard() {
    const board = document.getElementById('matching-board');
    if (!board) return false;
    board.classList.add('is-revealed');
    return true;
}

/**
 * Un solo tamaño de letra para todas las fichas, el mayor con el que todas
 * caben en su fila: búsqueda binaria entre un mínimo legible y un máximo
 * proporcional a la altura de la fila. Primero sin partir palabras; si así
 * queda por debajo de 18 px, se permite el guion.
 */
export function fitMatchingText() {
    const board = document.getElementById('matching-board');
    if (!board) return;
    const tiles = Array.from(board.querySelectorAll('.stage-matching-tile'));
    if (!tiles.length) return;

    const style = getComputedStyle(tiles[0]);
    const availableHeight = tiles[0].clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (availableHeight <= 0) return;

    const fits = () => tiles.every((tile) => {
        const text = tile.querySelector('.stage-matching-text');
        return text.scrollHeight <= availableHeight && text.scrollWidth <= text.clientWidth + 1;
    });
    const largestFit = () => {
        let low = MIN_FONT_PX;
        let high = Math.max(low, Math.min(availableHeight * 0.6, MAX_FONT_PX));
        while (high - low > 0.5) {
            const mid = (low + high) / 2;
            board.style.setProperty('--match-font', `${mid}px`);
            if (fits()) low = mid;
            else high = mid;
        }
        return Math.floor(low);
    };

    board.classList.remove('allow-breaks');
    let size = largestFit();
    if (size < 18) {
        board.classList.add('allow-breaks');
        size = largestFit();
    }
    board.style.setProperty('--match-font', `${size}px`);
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitMatchingText, 150);
});
