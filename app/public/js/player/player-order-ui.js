/**
 * @fileoverview Renderizado y manejo de preguntas tipo ordena
 */

import {
    getNickname,
    setHaRespondido,
    setCanAnswer,
    getHaRespondido,
    setCurrentOrder,
    setCurrentOrderOptions,
    getCurrentOrder,
    clearOrderState,
    clearOrderAutoSendTimer,
    setOrderAutoSendTimerId,
    setCurrentSlideType,
    startOrderAutoSendTimer
} from './player-state.js?v=20260710133645';
import { enviarOrdenRespuesta } from './player-answer.js?v=20260710133645';
import { OPTION_COLORS, getResponsiveFontClass } from './player-question-utils.js?v=20260710133645';
import { setBodyHTML } from './player-streak-ui.js?v=20260710133645';

let currentOrderQuestion = null;
let dragSourceIndex = null;
let lastMoveOptionIndex = null;
let lastMoveDirection = null;
let pointerDragState = null;

/**
 * Renderizar pregunta tipo "order"
 */
export function renderizarPreguntaOrdena(pregunta) {
    clearOrderState();
    setHaRespondido(false);
    setCanAnswer(true);
    setCurrentSlideType('question');

    currentOrderQuestion = pregunta;

    const preguntaFontClass = getResponsiveFontClass(pregunta.question_text);
    // Shuffle options so they never appear in the correct order by default
    const order = pregunta.options.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    setCurrentOrder(order);
    setCurrentOrderOptions(pregunta.options);

    setBodyHTML(`
        <div class="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div class="bg-purple-600 px-3 py-2 text-center shrink-0">
                <p class="text-white font-black text-base uppercase">${getNickname()}</p>
            </div>
            <div class="bg-white p-4 border-b-8 border-purple-600 text-slate-800 text-center min-h-[12vh] max-h-[20vh] flex items-center justify-center shrink-0 overflow-y-auto">
                <h2 class="${preguntaFontClass} font-black uppercase italic hyphens-auto" lang="es">${pregunta.question_text}</h2>
            </div>
            <div class="px-4 pt-3 pb-2 text-center text-slate-100 text-sm italic">
                ${_t('player.order.instruction', null, 'Arrastra para ordenar de arriba a abajo y luego pulsa Enviar')}
            </div>
            <div id="order-list" class="order-list flex-1 px-3 pb-4 overflow-y-auto flex flex-col gap-2"></div>
            <div class="p-3 bg-slate-900/60 border-t border-white/10">
                <button id="order-submit" data-player-action="send-order" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xl shadow-lg transition">
                    ${_t('player.order.submit', null, 'Enviar')}
                </button>
            </div>
        </div>
    `);

    renderOrderList();
    startOrderAutoSendTimer(pregunta.time_limit || 20);
}

function renderOrderList() {
    const container = document.getElementById('order-list');
    if (!container || !currentOrderQuestion) return;

    const order = getCurrentOrder() || [];
    const sizeClass = order.length >= 6
        ? 'order-list-compact-6'
        : (order.length === 5 ? 'order-list-compact-5' : '');

    container.classList.remove('order-list-compact-5', 'order-list-compact-6');
    if (sizeClass) {
        container.classList.add(sizeClass);
    }

    container.innerHTML = _tHtml(order.map((optionIndex, position) => {
        const option = currentOrderQuestion.options[optionIndex];
        const colorClass = OPTION_COLORS[optionIndex % OPTION_COLORS.length];
        const fontClass = getResponsiveFontClass(option.optionText || option.text || '');
        const isMoved = optionIndex === lastMoveOptionIndex;
        const moveClass = isMoved
            ? (lastMoveDirection === 'up' ? 'order-move-up' : 'order-move-down')
            : '';

        return `
            <div
                class="btn-glass-3d ${colorClass} order-item ${moveClass} rounded-xl flex items-center px-4 py-2 gap-3 cursor-grab active:cursor-grabbing flex-1"
                data-order-item
                data-drag-handle
                draggable="true"
                data-position="${position}"
                data-option-index="${optionIndex}"
                aria-label="Arrastra para reordenar"
                title="Arrastra para reordenar"
            >
                <span class="btn-number w-7 h-7 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 bg-white/30">${position + 1}</span>
                <span class="btn-text text-white font-bold ${fontClass} uppercase break-words flex-1" lang="es">
                    ${option.optionText || option.text}
                </span>
                <div class="drag-indicator text-white/70 shrink-0 text-sm">≡</div>
            </div>
        `;
    }).join(''));

    bindOrderDragHandlers(container);
    bindOrderMoveHandlers(container);
    bindOrderPointerHandlers(container);
    lastMoveOptionIndex = null;
    lastMoveDirection = null;
}

function bindOrderMoveHandlers(container) {
    // Handlers para botones de movimiento removidos - ahora solo drag desde cualquier parte
}

function bindOrderDragHandlers(container) {
    container.querySelectorAll('[data-order-item]').forEach((item) => {
        item.addEventListener('dragstart', (event) => {
            const position = Number(item.dataset.position);
            dragSourceIndex = position;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(position));
        });
    });

    container.querySelectorAll('[data-order-item]').forEach((item) => {

        item.addEventListener('dragover', (event) => {
            event.preventDefault();
            item.classList.add('ring-4', 'ring-white/70', 'scale-105');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('ring-4', 'ring-white/70', 'scale-105');
        });

        item.addEventListener('drop', (event) => {
            event.preventDefault();
            item.classList.remove('ring-4', 'ring-white/70', 'scale-105');

            const targetIndex = Number(item.dataset.position);
            const sourceIndex = dragSourceIndex ?? Number(event.dataTransfer.getData('text/plain'));

            if (!Number.isNaN(sourceIndex) && !Number.isNaN(targetIndex) && sourceIndex !== targetIndex) {
                moveOrderItem(sourceIndex, targetIndex);
            }
        });
    });
}

function bindOrderPointerHandlers(container) {
    if (container.dataset.pointerBound === 'true') return;

    container.addEventListener('pointerdown', (event) => {
        const item = event.target.closest('[data-order-item]');
        if (!item) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        event.preventDefault();

        pointerDragState = {
            pointerId: event.pointerId,
            container,
            draggedItem: item,
            startY: event.clientY,
            currentY: event.clientY,
            offsetY: 0
        };

        item.setPointerCapture?.(event.pointerId);
        item.classList.add('order-dragging');
    });

    container.addEventListener('pointermove', (event) => {
        if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
        event.preventDefault();

        // Calcular offset y limitarlo a un rango razonable
        pointerDragState.currentY = event.clientY;
        let offsetY = event.clientY - pointerDragState.startY;

        // Limitar el offset a ±40px para evitar que se salga de pantalla
        offsetY = Math.max(-40, Math.min(40, offsetY));

        // Aplicar transformación suave - pequeño movimiento visual
        pointerDragState.draggedItem.style.transform = `translateY(${offsetY * 0.5}px) scale(0.98)`;

        // Detectar qué item está bajo el pointer para intercambio
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const overItem = element?.closest?.('[data-order-item]');
        if (!overItem || overItem === pointerDragState.draggedItem) {
            return;
        }

        // Solo intercambiar si el movimiento vertical es significativo (al menos 15px en esa dirección)
        if (Math.abs(offsetY) < 15) {
            return;
        }

        // Intercambiar posiciones
        const items = Array.from(container.querySelectorAll('[data-order-item]'));
        const fromIndex = items.indexOf(pointerDragState.draggedItem);
        const toIndex = items.indexOf(overItem);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

        if (fromIndex < toIndex) {
            container.insertBefore(pointerDragState.draggedItem, overItem.nextSibling);
        } else {
            container.insertBefore(pointerDragState.draggedItem, overItem);
        }
    });

    const finishPointerDrag = (event) => {
        if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;

        // Remover transformación y volver a posición normal
        pointerDragState.draggedItem.style.transform = '';
        pointerDragState.draggedItem.classList.remove('order-dragging');

        // Actualizar el orden en el estado
        const items = Array.from(container.querySelectorAll('[data-order-item]'));
        const nextOrder = items.map(item => Number(item.dataset.optionIndex));
        if (nextOrder.every(Number.isInteger)) {
            setCurrentOrder(nextOrder);
        }

        pointerDragState = null;
        renderOrderList();
    };

    container.addEventListener('pointerup', finishPointerDrag);
    container.addEventListener('pointercancel', finishPointerDrag);

    container.dataset.pointerBound = 'true';
}

function moveOrderItem(fromIndex, toIndex, options = {}) {
    const order = getCurrentOrder();
    if (!Array.isArray(order)) return;
    if (toIndex < 0 || toIndex >= order.length) return;
    if (fromIndex < 0 || fromIndex >= order.length) return;

    const nextOrder = [...order];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);

    if (options.animate) {
        lastMoveOptionIndex = moved;
        lastMoveDirection = options.direction === -1 ? 'up' : 'down';
    }

    setCurrentOrder(nextOrder);
    renderOrderList();
}

// startOrderAutoSendTimer is now in player-state.js to avoid circular imports
