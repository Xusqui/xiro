/**
 * @fileoverview Renderiza preguntas de tipo "order" (ordenar opciones)
 * Contrato: { answerType:'order', order: number[] } — order[posición] = índice
 * original (dentro del array `options` tal cual llegó al cliente) colocado ahí.
 */

'use strict';

const StandaloneQuestionOrder = (() => {
    const { escapeHtml, optionText, submitAnswer } = StandaloneQuestionCommon;

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
        const picked = [];
        let pool = _shuffle(options.map((_, idx) => idx));

        function draw() {
            container.innerHTML = `
                <div class="question">
                    <h2>${escapeHtml(question.question_text)}</h2>
                    <p class="order-hint">${window.XiroI18n?.t('standalone.game.order_hint') || 'Toca las opciones en el orden correcto'}</p>
                    <ol class="order-picked-list">
                        ${picked.map(idx => `<li>${escapeHtml(optionText(options[idx]))}</li>`).join('')}
                    </ol>
                    <div class="answers order-pool">
                        ${pool.map(idx => `
                            <button type="button" class="answer-btn" data-standalone-answer data-order-index="${idx}">
                                ${escapeHtml(optionText(options[idx]))}
                            </button>
                        `).join('')}
                    </div>
                    ${picked.length > 0 ? `<button type="button" class="link-btn" data-standalone-action="order-reset">${window.XiroI18n?.t('standalone.game.order_reset') || 'Reiniciar orden'}</button>` : ''}
                </div>
            `;

            container.querySelectorAll('[data-standalone-answer]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.orderIndex);
                    picked.push(idx);
                    pool = pool.filter(i => i !== idx);

                    if (picked.length === options.length) {
                        _submit();
                    } else {
                        draw();
                    }
                });
            });

            container.querySelector('[data-standalone-action="order-reset"]')?.addEventListener('click', () => {
                picked.length = 0;
                pool = _shuffle(options.map((_, idx) => idx));
                draw();
            });
        }

        async function _submit() {
            container.querySelectorAll('button').forEach(el => { el.disabled = true; });
            const ack = await submitAnswer({ order: picked }, 'order');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                picked.length = 0;
                pool = _shuffle(options.map((_, idx) => idx));
                draw();
                return;
            }
            onSubmitted();
        }

        draw();
    }

    return { render };
})();
