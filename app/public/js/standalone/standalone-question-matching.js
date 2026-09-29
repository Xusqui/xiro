/**
 * @fileoverview Renderiza preguntas de tipo "matching" (emparejar columnas)
 * Contrato: { answerType:'matching', matches: number[] } — matches[i] = índice
 * del valor de la columna derecha (tal cual llegó en `options`) emparejado con
 * el elemento izquierdo i. Interacción y estética idénticas a
 * player-matching-ui.js: columna izquierda fija, columna derecha se arrastra
 * (ratón/touch) para emparejar, luego se pulsa "Enviar".
 */

'use strict';

globalThis.StandaloneQuestionMatching = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;

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
        let matches = _shuffle(options.map((_, idx) => idx));
        let dragSourcePos = null;
        let pointerDragState = null;

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar pl-nickname-bar--amber"><p>${nickname}</p></div>
                <div class="pl-question-panel pl-question-panel--amber"><h2>${escapeHtml(question.question_text)}</h2></div>
                <div class="pl-hint-banner">${window.XiroI18n?.t('standalone.game.matching_hint') || 'Arrastra la columna derecha para emparejar con la izquierda'}</div>
                <div class="pl-match-columns">
                    <div class="pl-match-column">
                        ${options.map((opt, idx) => `
                            <div class="pl-glass-item ${OPTION_GRADIENTS[idx % OPTION_GRADIENTS.length]}">
                                <span class="pl-item-text">${escapeHtml(opt.optionText || opt.text || '')}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="pl-match-arrow">↔</div>
                    <div id="standalone-match-right" class="pl-match-column"></div>
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-matching">
                        ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar'}
                    </button>
                </div>
            </div>
        `;

        function drawRight() {
            const right = container.querySelector('#standalone-match-right');
            right.innerHTML = matches.map((optIdx, pos) => `
                <div class="pl-glass-item pl-gradient-amber" data-match-item draggable="true" data-position="${pos}" data-option-index="${optIdx}">
                    <span class="pl-item-text">${escapeHtml(options[optIdx].match_value || '')}</span>
                    <span style="color:rgba(255,255,255,0.7);">≡</span>
                </div>
            `).join('');

            bindDragHandlers(right);
            bindPointerHandlers(right);
        }

        function swapItems(fromPos, toPos) {
            const next = [...matches];
            [next[fromPos], next[toPos]] = [next[toPos], next[fromPos]];
            matches = next;
            drawRight();
        }

        function bindDragHandlers(right) {
            right.querySelectorAll('[data-match-item]').forEach(item => {
                item.addEventListener('dragstart', (event) => {
                    dragSourcePos = Number(item.dataset.position);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(dragSourcePos));
                });
                item.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    item.classList.add('is-drag-over');
                });
                item.addEventListener('dragleave', () => item.classList.remove('is-drag-over'));
                item.addEventListener('drop', (event) => {
                    event.preventDefault();
                    item.classList.remove('is-drag-over');
                    const targetPos = Number(item.dataset.position);
                    const sourcePos = dragSourcePos ?? Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(sourcePos) && !Number.isNaN(targetPos) && sourcePos !== targetPos) {
                        swapItems(sourcePos, targetPos);
                    }
                });
            });
        }

        function bindPointerHandlers(right) {
            right.addEventListener('pointerdown', (event) => {
                const item = event.target.closest('[data-match-item]');
                if (!item) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();

                pointerDragState = { pointerId: event.pointerId, draggedItem: item, startY: event.clientY };
                item.setPointerCapture?.(event.pointerId);
                item.classList.add('is-dragging');
            });

            right.addEventListener('pointermove', (event) => {
                if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
                event.preventDefault();

                let offsetY = event.clientY - pointerDragState.startY;
                offsetY = Math.max(-40, Math.min(40, offsetY));
                pointerDragState.draggedItem.style.transform = `translateY(${offsetY * 0.5}px) scale(0.98)`;

                const element = document.elementFromPoint(event.clientX, event.clientY);
                const overItem = element?.closest?.('[data-match-item]');
                if (!overItem || overItem === pointerDragState.draggedItem) return;
                if (Math.abs(offsetY) < 15) return;

                const items = Array.from(right.querySelectorAll('[data-match-item]'));
                const fromIndex = items.indexOf(pointerDragState.draggedItem);
                const toIndex = items.indexOf(overItem);
                if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

                if (fromIndex < toIndex) {
                    right.insertBefore(pointerDragState.draggedItem, overItem.nextSibling);
                } else {
                    right.insertBefore(pointerDragState.draggedItem, overItem);
                }
            });

            const finish = (event) => {
                if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
                pointerDragState.draggedItem.style.transform = '';
                pointerDragState.draggedItem.classList.remove('is-dragging');

                const items = Array.from(right.querySelectorAll('[data-match-item]'));
                const nextMatches = items.map(item => Number(item.dataset.optionIndex));
                if (nextMatches.every(Number.isInteger)) matches = nextMatches;

                pointerDragState = null;
                drawRight();
            };

            right.addEventListener('pointerup', finish);
            right.addEventListener('pointercancel', finish);
        }

        container.querySelector('[data-standalone-action="submit-matching"]').addEventListener('click', async () => {
            container.querySelectorAll('button').forEach(el => { el.disabled = true; });
            const ack = await submitAnswer({ matches: [...matches] }, 'matching');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                container.querySelectorAll('button').forEach(el => { el.disabled = false; });
                return;
            }
            onSubmitted();
        });

        drawRight();
    }

    return { render };
})();
