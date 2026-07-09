/**
 * @fileoverview Renderiza preguntas de opción única: multiple, quiz, survey, true_false
 * Contrato submit-answer: { pin/sessionId, nickname, index, requestId } (sin answerType)
 */

'use strict';

const StandaloneQuestionChoice = (() => {
    const { escapeHtml, lockAnswering, optionText, submitAnswer } = StandaloneQuestionCommon;

    function _renderOptions(options) {
        return options.map((opt, idx) => `
            <button type="button" class="answer-btn" data-standalone-answer data-index="${idx}">
                ${escapeHtml(optionText(opt))}
            </button>
        `).join('');
    }

    async function _handleSelect(container, index, onSubmitted) {
        lockAnswering(container);
        container.querySelector(`[data-index="${index}"]`)?.classList.add('selected');

        const ack = await submitAnswer({ index });
        if (ack && ack.ok === false) {
            container.querySelectorAll('[data-standalone-answer]').forEach(el => {
                el.disabled = false;
                el.classList.remove('is-locked');
            });
            StandaloneState.get().answered = false;
            return;
        }
        onSubmitted();
    }

    function render(container, question, { onSubmitted }) {
        const options = question.options || [];
        container.innerHTML = `
            <div class="question">
                <h2>${escapeHtml(question.question_text)}</h2>
                <div class="answers">
                    ${_renderOptions(options)}
                </div>
            </div>
        `;

        container.querySelectorAll('[data-standalone-answer]').forEach(btn => {
            btn.addEventListener('click', () => {
                _handleSelect(container, Number(btn.dataset.index), onSubmitted);
            });
        });
    }

    return { render };
})();
