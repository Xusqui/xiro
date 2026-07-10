/**
 * @fileoverview Renderiza preguntas de opción única: multiple, quiz, survey, true_false
 * Contrato submit-answer: { pin/sessionId, nickname, index, requestId } (sin answerType)
 * Estética idéntica a player-quiz-ui.js (nickname pill, panel blanco, grid 2 cols
 * con botones cristal 3D), pero con DOM y ficheros propios de Standalone.
 */

'use strict';

const StandaloneQuestionChoice = (() => {
    const { escapeHtml, lockAnswering, optionText, submitAnswer, buildQuestionMedia, wireQuestionAudio } = StandaloneQuestionCommon;

    const OPTION_GRADIENTS = ['pl-gradient-red', 'pl-gradient-blue', 'pl-gradient-yellow', 'pl-gradient-green', 'pl-gradient-purple', 'pl-gradient-pink'];

    function _renderOptions(options) {
        return options.map((opt, idx) => `
            <button class="pl-answer-btn pl-glass-3d ${OPTION_GRADIENTS[idx % OPTION_GRADIENTS.length]}" data-standalone-answer data-index="${idx}">
                <span class="pl-answer-number">${idx + 1}</span>
                ${opt.option_image_url ? `<img src="${escapeHtml(opt.option_image_url)}" alt="" class="pl-answer-image">` : ''}
                <span class="pl-answer-text">${escapeHtml(optionText(opt))}</span>
            </button>
        `).join('');
    }

    async function _handleSelect(container, index, onSubmitted) {
        lockAnswering(container);
        container.querySelector(`[data-index="${index}"]`)?.classList.add('is-selected');

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
        const nickname = escapeHtml(StandaloneState.get().nickname);
        const { mediaBlock, statementImageHtml, hasAudio } = buildQuestionMedia(question);

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${nickname}</p></div>
                ${mediaBlock}
                <div class="pl-question-panel">
                    <h2>${escapeHtml(question.question_text)}</h2>
                    ${statementImageHtml}
                </div>
                <div class="pl-answers-grid">
                    ${_renderOptions(options)}
                </div>
            </div>
        `;

        if (hasAudio) wireQuestionAudio(container);

        container.querySelectorAll('[data-standalone-answer]').forEach(btn => {
            btn.addEventListener('click', () => {
                _handleSelect(container, Number(btn.dataset.index), onSubmitted);
            });
        });
    }

    return { render };
})();
