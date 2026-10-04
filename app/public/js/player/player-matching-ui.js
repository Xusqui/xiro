/**
 * @fileoverview Renderizado y manejo de preguntas tipo matching (Emparejar)
 * Columna izquierda fija; columna derecha drag-to-reorder por el jugador.
 */

import {
    getNickname,
    setHaRespondido,
    setCanAnswer,
    setCurrentMatches,
    setCurrentMatchOptions,
    getCurrentMatches,
    clearMatchState,
    startMatchAutoSendTimer,
    setCurrentSlideType
} from './player-state.js?v=20260922172926';
import { OPTION_COLORS, getResponsiveFontClass, fitTextToContainer, optionCaseClass } from './player-question-utils.js?v=20260922172926';
import { setBodyHTML } from './player-streak-ui.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

let currentMatchQuestion = null;
let pointerDragState = null;

/**
 * Renderizar pregunta tipo "matching"
 */
export function renderizarPreguntaMatching(pregunta) {
    clearMatchState();
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('question');

    currentMatchQuestion = pregunta;

    // matches = indices de la columna derecha en el orden visual actual
    const initialOrder = pregunta.options.map((_, i) => i);
    for (let i = initialOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialOrder[i], initialOrder[j]] = [initialOrder[j], initialOrder[i]];
    }
    setCurrentMatches(initialOrder);
    setCurrentMatchOptions(pregunta.options);

    const preguntaFontClass = getResponsiveFontClass(pregunta.question_text);

    setBodyHTML(`
        <div class="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-amber-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${getNickname()}</p>
            </div>
            <div class="bg-white p-4 border-b-8 border-amber-600 text-slate-800 text-center min-h-[12vh] max-h-[20vh] flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${preguntaFontClass} font-black uppercase italic hyphens-auto" lang="es">${escapeHtml(pregunta.question_text)}</h2>
            </div>
            <div class="px-4 pt-2 pb-1 text-center text-slate-100 text-sm italic shrink-0">
                ${_t('player.matching.instruction', null, 'Arrastra la columna derecha para emparejar con la izquierda')}
            </div>
            <div id="matching-board" class="flex gap-2 px-3 py-2 flex-1 overflow-y-auto">
                <div id="matching-left" class="flex flex-col gap-2 flex-1 min-w-0"></div>
                <div id="matching-arrows" class="flex flex-col gap-2 shrink-0" aria-hidden="true"></div>
                <div id="matching-right" class="flex flex-col gap-2 flex-1 min-w-0"></div>
            </div>
            <div class="p-3 bg-slate-900/60 border-t border-white/10 shrink-0">
                <button id="match-submit" data-player-action="send-match" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xl shadow-lg transition">
                    ${_t('player.matching.submit', null, 'Enviar')}
                </button>
            </div>
        </div>
    `);

    renderMatchColumns();
    startMatchAutoSendTimer(pregunta.time_limit || 20);
}

function renderMatchColumns() {
    const leftContainer = document.getElementById('matching-left');
    const rightContainer = document.getElementById('matching-right');
    if (!leftContainer || !rightContainer || !currentMatchQuestion) return;

    const options = currentMatchQuestion.options;
    const matches = getCurrentMatches() || options.map((_, i) => i);

    // Columna izquierda: fija, en orden original
    leftContainer.innerHTML = _tHtml(options.map((opt, i) => {
        const colorClass = OPTION_COLORS[i % OPTION_COLORS.length];
        const fontClass = getResponsiveFontClass(opt.optionText || opt.option_text || '', true);
        return `
            <div data-fit-box class="btn-glass-3d ${colorClass} rounded-xl flex items-center px-3 py-2 shrink-0 min-h-[3rem] overflow-hidden">
                <span data-fit-text class="text-white font-bold ${fontClass} ${optionCaseClass(opt.optionText?.length || opt.option_text?.length)} break-words w-full text-center" lang="es">
                    ${escapeHtml(opt.optionText || opt.option_text || '')}
                </span>
            </div>
        `;
    }).join(''));

    // Columna derecha: reordenable — color dorado fijo para no revelar los pares
    rightContainer.innerHTML = _tHtml(matches.map((optIdx, pos) => {
        const opt = options[optIdx];
        const colorClass = 'bg-amber-500';
        const fontClass = getResponsiveFontClass(opt.match_value || '', true);
        return `
            <div
                data-fit-box
                class="btn-glass-3d ${colorClass} order-item rounded-xl flex items-center px-3 py-2 gap-2 cursor-grab active:cursor-grabbing shrink-0 min-h-[3rem] overflow-hidden"
                data-match-item
                data-position="${pos}"
                data-option-index="${optIdx}"
                draggable="true"
            >
                <span data-fit-text class="text-white font-bold ${fontClass} ${optionCaseClass(opt.match_value?.length)} break-words flex-1 text-center" lang="es">
                    ${escapeHtml(opt.match_value || '')}
                </span>
                <div class="drag-indicator text-white/70 shrink-0 text-sm">≡</div>
            </div>
        `;
    }).join(''));

    // Una flecha por pareja, en la misma fila que sus dos tarjetas
    const arrowsContainer = document.getElementById('matching-arrows');
    if (arrowsContainer) {
        arrowsContainer.innerHTML = _tHtml(options.map(() =>
            '<div data-match-arrow class="flex items-center justify-center text-white/60 text-xl font-black shrink-0">↔</div>'
        ).join(''));
    }

    // Un solo scroll para las tres columnas: el texto se reduce para caber,
    // pero no por debajo de lo legible (antes llegaba a 9 px); si aun así no
    // cabe, se desplaza el tablero entero y las parejas siguen alineadas
    fitTextToContainer(document.getElementById('matching-board'), { minFontPx: 14, minBoxHeightPx: 44 });
    syncMatchRows();

    bindMatchDragHandlers(rightContainer);
    bindMatchPointerHandlers(rightContainer);
}

/**
 * Iguala la altura de cada pareja (izquierda, flecha y derecha) a la de la
 * tarjeta más alta, para que con textos largos sigan en la misma fila.
 */
function syncMatchRows() {
    const lefts = Array.from(document.querySelectorAll('#matching-left > [data-fit-box]'));
    const rights = Array.from(document.querySelectorAll('#matching-right > [data-match-item]'));
    const arrows = Array.from(document.querySelectorAll('#matching-arrows > [data-match-arrow]'));
    [...lefts, ...rights, ...arrows].forEach(el => { el.style.height = ''; });
    lefts.forEach((left, i) => {
        const right = rights[i];
        if (!right) return;
        const height = `${Math.max(left.offsetHeight, right.offsetHeight)}px`;
        left.style.height = height;
        right.style.height = height;
        if (arrows[i]) arrows[i].style.height = height;
    });
}

// Girar el móvil cambia el ancho y con él la altura de los textos
window.addEventListener('resize', () => {
    if (document.getElementById('matching-board')) syncMatchRows();
});

function bindMatchDragHandlers(container) {
    let dragSourcePos = null;

    container.querySelectorAll('[data-match-item]').forEach((item) => {
        item.addEventListener('dragstart', (e) => {
            dragSourcePos = Number(item.dataset.position);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(dragSourcePos));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('ring-4', 'ring-white/70', 'scale-105');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('ring-4', 'ring-white/70', 'scale-105');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('ring-4', 'ring-white/70', 'scale-105');
            const targetPos = Number(item.dataset.position);
            const sourcePos = dragSourcePos ?? Number(e.dataTransfer.getData('text/plain'));
            if (!Number.isNaN(sourcePos) && !Number.isNaN(targetPos) && sourcePos !== targetPos) {
                swapMatchItems(sourcePos, targetPos);
            }
        });
    });
}

function bindMatchPointerHandlers(container) {
    if (container.dataset.pointerBound === 'true') return;

    container.addEventListener('pointerdown', (e) => {
        const item = e.target.closest('[data-match-item]');
        if (!item) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        pointerDragState = { pointerId: e.pointerId, draggedItem: item, startY: e.clientY, container };
        item.setPointerCapture?.(e.pointerId);
        item.classList.add('order-dragging');
    });

    container.addEventListener('pointermove', (e) => {
        if (!pointerDragState || e.pointerId !== pointerDragState.pointerId) return;
        e.preventDefault();
        const offsetY = e.clientY - pointerDragState.startY;
        pointerDragState.draggedItem.style.transform = `translateY(${Math.max(-40, Math.min(40, offsetY)) * 0.5}px) scale(0.98)`;

        if (Math.abs(offsetY) < 15) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const over = el?.closest?.('[data-match-item]');
        if (!over || over === pointerDragState.draggedItem) return;

        const items = Array.from(container.querySelectorAll('[data-match-item]'));
        const from = items.indexOf(pointerDragState.draggedItem);
        const to = items.indexOf(over);
        if (from === -1 || to === -1 || from === to) return;
        container.insertBefore(pointerDragState.draggedItem, from < to ? over.nextSibling : over);
    });

    const finish = (e) => {
        if (!pointerDragState || e.pointerId !== pointerDragState.pointerId) return;
        pointerDragState.draggedItem.style.transform = '';
        pointerDragState.draggedItem.classList.remove('order-dragging');
        const items = Array.from(container.querySelectorAll('[data-match-item]'));
        const newMatches = items.map(item => Number(item.dataset.optionIndex));
        if (newMatches.every(Number.isInteger)) setCurrentMatches(newMatches);
        pointerDragState = null;
        renderMatchColumns();
    };

    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', finish);
    container.dataset.pointerBound = 'true';
}

function swapMatchItems(fromPos, toPos) {
    const matches = getCurrentMatches();
    if (!Array.isArray(matches)) return;
    const next = [...matches];
    [next[fromPos], next[toPos]] = [next[toPos], next[fromPos]];
    setCurrentMatches(next);
    renderMatchColumns();
}
