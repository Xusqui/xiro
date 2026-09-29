/**
 * @fileoverview Renderiza preguntas de tipo "order" (ordenar opciones)
 * Contrato: { answerType:'order', order: number[] } — order[posición] = índice
 * original (dentro del array `options` tal cual llegó al cliente) colocado ahí.
 * Interacción y estética idénticas a player-order-ui.js: arrastrar (ratón/touch)
 * para reordenar tarjetas cristal 3D, luego pulsar "Enviar".
 */

'use strict';

const StandaloneQuestionOrder = (() => {
    const { escapeHtml, optionText, submitAnswer } = StandaloneQuestionCommon;

    const OPTION_GRADIENTS = ['pl-gradient-red', 'pl-gradient-blue', 'pl-gradient-yellow', 'pl-gradient-green', 'pl-gradient-purple', 'pl-gradient-pink'];

    function _shuffle(indices) {
        const arr = [...indices];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function render(container, question, { onSubmitted }) {
        const options = question.options || [];
        const nickname = escapeHtml(StandaloneState.get().nickname);
        let order = _shuffle(options.map((_, idx) => idx));
        let dragSourceIndex = null;
        let pointerDragState = null;

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${nickname}</p></div>
                <div class="pl-question-panel"><h2>${escapeHtml(question.question_text)}</h2></div>
                <div class="pl-hint-banner">${window.XiroI18n?.t('standalone.game.order_hint') || 'Arrastra para ordenar de arriba a abajo y luego pulsa Enviar'}</div>
                <div id="standalone-order-list" class="pl-order-list"></div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-order">
                        ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar'}
                    </button>
                </div>
            </div>
        `;

        function drawList() {
            const list = container.querySelector('#standalone-order-list');
            list.innerHTML = order.map((optionIndex, position) => `
                <div class="pl-glass-item ${OPTION_GRADIENTS[optionIndex % OPTION_GRADIENTS.length]} order-item"
                    data-order-item draggable="true" data-position="${position}" data-option-index="${optionIndex}">
                    <span class="pl-item-number">${position + 1}</span>
                    <span class="pl-item-text">${escapeHtml(optionText(options[optionIndex]))}</span>
                    <span style="color:rgba(255,255,255,0.7);">≡</span>
                </div>
            `).join('');

            bindDragHandlers(list);
            bindPointerHandlers(list);
        }

        function moveItem(fromIndex, toIndex) {
            if (toIndex < 0 || toIndex >= order.length || fromIndex < 0 || fromIndex >= order.length) return;
            const next = [...order];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            order = next;
            drawList();
        }

        function bindDragHandlers(list) {
            list.querySelectorAll('[data-order-item]').forEach(item => {
                item.addEventListener('dragstart', (event) => {
                    dragSourceIndex = Number(item.dataset.position);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(dragSourceIndex));
                });
                item.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    item.classList.add('is-drag-over');
                });
                item.addEventListener('dragleave', () => item.classList.remove('is-drag-over'));
                item.addEventListener('drop', (event) => {
                    event.preventDefault();
                    item.classList.remove('is-drag-over');
                    const targetIndex = Number(item.dataset.position);
                    const sourceIndex = dragSourceIndex ?? Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(sourceIndex) && !Number.isNaN(targetIndex) && sourceIndex !== targetIndex) {
                        moveItem(sourceIndex, targetIndex);
                    }
                });
            });
        }

        function bindPointerHandlers(list) {
            list.addEventListener('pointerdown', (event) => {
                const item = event.target.closest('[data-order-item]');
                if (!item) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();

                pointerDragState = { pointerId: event.pointerId, draggedItem: item, startY: event.clientY };
                item.setPointerCapture?.(event.pointerId);
                item.classList.add('is-dragging');
            });

            list.addEventListener('pointermove', (event) => {
                if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
                event.preventDefault();

                let offsetY = event.clientY - pointerDragState.startY;
                offsetY = Math.max(-40, Math.min(40, offsetY));
                pointerDragState.draggedItem.style.transform = `translateY(${offsetY * 0.5}px) scale(0.98)`;

                const element = document.elementFromPoint(event.clientX, event.clientY);
                const overItem = element?.closest?.('[data-order-item]');
                if (!overItem || overItem === pointerDragState.draggedItem) return;
                if (Math.abs(offsetY) < 15) return;

                const items = Array.from(list.querySelectorAll('[data-order-item]'));
                const fromIndex = items.indexOf(pointerDragState.draggedItem);
                const toIndex = items.indexOf(overItem);
                if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

                if (fromIndex < toIndex) {
                    list.insertBefore(pointerDragState.draggedItem, overItem.nextSibling);
                } else {
                    list.insertBefore(pointerDragState.draggedItem, overItem);
                }
            });

            const finishPointerDrag = (event) => {
                if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
                pointerDragState.draggedItem.style.transform = '';
                pointerDragState.draggedItem.classList.remove('is-dragging');

                const items = Array.from(list.querySelectorAll('[data-order-item]'));
                const nextOrder = items.map(item => Number(item.dataset.optionIndex));
                if (nextOrder.every(Number.isInteger)) order = nextOrder;

                pointerDragState = null;
                drawList();
            };

            list.addEventListener('pointerup', finishPointerDrag);
            list.addEventListener('pointercancel', finishPointerDrag);
        }

        container.querySelector('[data-standalone-action="submit-order"]').addEventListener('click', async () => {
            container.querySelectorAll('button').forEach(el => { el.disabled = true; });
            const ack = await submitAnswer({ order: [...order] }, 'order');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                container.querySelectorAll('button').forEach(el => { el.disabled = false; });
                return;
            }
            onSubmitted();
        });

        drawList();
    }

    return { render };
})();
