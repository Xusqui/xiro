/**
 * @fileoverview Renderiza preguntas de tipo "matching" (emparejar columnas)
 * Contrato: { answerType:'matching', matches: number[] } — matches[i] = índice
 * del valor de la columna derecha (tal cual llegó en `options`) emparejado con
 * el elemento izquierdo i. El servidor exige una biyección (sin valores
 * repetidos, ver MatchingAnswerStateService.validateMatchingAnswer) — por eso
 * se asigna desde una bolsa que se va vaciando, igual que en preguntas "order",
 * en vez de selects independientes que permitían elegir el mismo valor dos veces.
 */

'use strict';

globalThis.StandaloneQuestionMatching = (() => {
    const { escapeHtml, submitAnswer } = StandaloneQuestionCommon;

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
        const assigned = [];
        let pool = _shuffle(options.map((_, idx) => idx));

        function draw() {
            const nextLeftIndex = assigned.length;

            container.innerHTML = `
                <div class="question">
                    <h2>${escapeHtml(question.question_text)}</h2>
                    <p class="order-hint">${window.XiroI18n?.t('standalone.game.matching_hint') || 'Empareja cada elemento con su pareja correcta'}</p>
                    <div class="matching-rows">
                        ${options.map((opt, idx) => `
                            <div class="matching-row ${idx === nextLeftIndex ? 'is-active' : ''}">
                                <span class="matching-left">${escapeHtml(opt.optionText || opt.text || '')}</span>
                                <span class="matching-value">${idx < assigned.length ? escapeHtml(options[assigned[idx]].match_value || '') : '…'}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${nextLeftIndex < options.length ? `
                        <div class="answers matching-pool">
                            ${pool.map(rIdx => `
                                <button type="button" class="answer-btn" data-standalone-answer data-right-index="${rIdx}">
                                    ${escapeHtml(options[rIdx].match_value || '')}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${assigned.length > 0 ? `<button type="button" class="link-btn" data-standalone-action="matching-reset">${window.XiroI18n?.t('standalone.game.order_reset') || 'Reiniciar orden'}</button>` : ''}
                </div>
            `;

            container.querySelectorAll('[data-standalone-answer]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const rIdx = Number(btn.dataset.rightIndex);
                    assigned.push(rIdx);
                    pool = pool.filter(i => i !== rIdx);

                    if (assigned.length === options.length) {
                        _submit();
                    } else {
                        draw();
                    }
                });
            });

            container.querySelector('[data-standalone-action="matching-reset"]')?.addEventListener('click', () => {
                assigned.length = 0;
                pool = _shuffle(options.map((_, idx) => idx));
                draw();
            });
        }

        async function _submit() {
            container.querySelectorAll('button').forEach(el => { el.disabled = true; });
            const ack = await submitAnswer({ matches: [...assigned] }, 'matching');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                assigned.length = 0;
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
