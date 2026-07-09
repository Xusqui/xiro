/**
 * @fileoverview Renderiza preguntas de tipo "multiple_choice" (selección múltiple)
 * Contrato: { answerType:'multiple_choice', selectedIndices: number[] } (1-6 elementos)
 */

'use strict';

const StandaloneQuestionMultipleChoice = (() => {
    const { escapeHtml, optionText, submitAnswer } = StandaloneQuestionCommon;

    function render(container, question, { onSubmitted }) {
        const options = question.options || [];

        container.innerHTML = `
            <div class="question">
                <h2>${escapeHtml(question.question_text)}</h2>
                <p class="order-hint">${window.XiroI18n?.t('standalone.game.multiple_hint') || 'Selecciona todas las opciones correctas'}</p>
                <div class="answers multi-select">
                    ${options.map((opt, idx) => `
                        <label class="answer-btn checkbox-answer">
                            <input type="checkbox" data-standalone-answer data-index="${idx}">
                            <span>${escapeHtml(optionText(opt))}</span>
                        </label>
                    `).join('')}
                </div>
                <button type="button" class="btn-primary" data-standalone-action="submit-multiple" disabled>
                    ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar respuesta'}
                </button>
            </div>
        `;

        const checkboxes = Array.from(container.querySelectorAll('[data-standalone-answer]'));
        const submitBtn = container.querySelector('[data-standalone-action="submit-multiple"]');

        checkboxes.forEach(cb => cb.addEventListener('change', () => {
            submitBtn.disabled = !checkboxes.some(c => c.checked);
        }));

        submitBtn.addEventListener('click', async () => {
            checkboxes.forEach(cb => { cb.disabled = true; });
            submitBtn.disabled = true;

            const selectedIndices = checkboxes
                .filter(cb => cb.checked)
                .map(cb => Number(cb.dataset.index));

            const ack = await submitAnswer({ selectedIndices }, 'multiple_choice');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                checkboxes.forEach(cb => { cb.disabled = false; });
                submitBtn.disabled = false;
                return;
            }
            onSubmitted();
        });
    }

    return { render };
})();
