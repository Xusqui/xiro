/**
 * @fileoverview Renderiza preguntas de tipo "multiple_choice" (selección múltiple)
 * Contrato: { answerType:'multiple_choice', selectedIndices: number[] } (1-6 elementos)
 * Estética E INTERACCIÓN igual que player-multiplechoice-ui.js: al tocar una
 * opción se marca con un overlay verde + check grande (no solo un borde sutil),
 * para que sea evidente qué se ha seleccionado antes y después de enviar.
 */

'use strict';

const StandaloneQuestionMultipleChoice = (() => {
    const { escapeHtml, optionText, submitAnswer, buildQuestionMedia, wireQuestionAudio } = StandaloneQuestionCommon;

    const OPTION_GRADIENTS = ['pl-gradient-red', 'pl-gradient-blue', 'pl-gradient-yellow', 'pl-gradient-green', 'pl-gradient-purple', 'pl-gradient-pink'];

    function _markSelected(btn, isSelected) {
        const prevOverlay = btn.querySelector('.pl-check-overlay');
        if (prevOverlay) prevOverlay.remove();

        if (isSelected) {
            const overlay = document.createElement('div');
            overlay.className = 'pl-check-overlay';
            overlay.innerHTML = '<i class="fas fa-check"></i>';
            btn.appendChild(overlay);
            btn.classList.add('is-selected');
        } else {
            btn.classList.remove('is-selected');
        }
    }

    function render(container, question, { onSubmitted }) {
        const options = question.options || [];
        const nickname = escapeHtml(StandaloneState.get().nickname);
        const selected = new Set();
        const { mediaBlock, statementImageHtml, hasAudio } = buildQuestionMedia(question);

        container.innerHTML = `
            <div class="pl-viewport">
                <div class="pl-nickname-bar"><p>${nickname}</p></div>
                ${mediaBlock}
                <div class="pl-question-panel">
                    <h2>${escapeHtml(question.question_text)}</h2>
                    ${statementImageHtml}
                </div>
                <div class="pl-multi-banner"><p>✓ ${window.XiroI18n?.t('standalone.game.multiple_hint') || 'Selección múltiple (puedes marcar varias)'}</p></div>
                <div class="pl-answers-grid">
                    ${options.map((opt, idx) => `
                        <button type="button" class="pl-answer-btn pl-glass-3d ${OPTION_GRADIENTS[idx % OPTION_GRADIENTS.length]}" data-standalone-answer data-index="${idx}">
                            <span class="pl-answer-number">${idx + 1}</span>
                            ${opt.option_image_url ? `<img src="${escapeHtml(opt.option_image_url)}" alt="" class="pl-answer-image">` : ''}
                            <span class="pl-answer-text">${escapeHtml(optionText(opt))}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-multiple" disabled>
                        ${window.XiroI18n?.t('standalone.game.submit') || 'Enviar respuesta'}
                    </button>
                </div>
            </div>
        `;

        if (hasAudio) wireQuestionAudio(container);

        const buttons = Array.from(container.querySelectorAll('[data-standalone-answer]'));
        const submitBtn = container.querySelector('[data-standalone-action="submit-multiple"]');

        buttons.forEach(btn => btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            if (selected.has(idx)) {
                selected.delete(idx);
            } else {
                selected.add(idx);
            }
            _markSelected(btn, selected.has(idx));
            submitBtn.disabled = selected.size === 0;
        }));

        submitBtn.addEventListener('click', async () => {
            buttons.forEach(btn => { btn.disabled = true; });
            submitBtn.disabled = true;

            const ack = await submitAnswer({ selectedIndices: [...selected] }, 'multiple_choice');
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                buttons.forEach(btn => { btn.disabled = false; });
                submitBtn.disabled = false;
                return;
            }
            onSubmitted();
        });
    }

    return { render };
})();
