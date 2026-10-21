/**
 * @fileoverview Renderiza preguntas de tipo "multiple_choice" (selección múltiple)
 * Contrato: { answerType:'multiple_choice', selectedIndices: number[] } (1-6 elementos)
 * Estética E INTERACCIÓN igual que player-multiplechoice-ui.js: al tocar una
 * opción se marca con un overlay verde + check grande (no solo un borde sutil),
 * para que sea evidente qué se ha seleccionado antes y después de enviar.
 * La encuesta de selección múltiple (survey_multiple) usa la misma pantalla con
 * SURVEY_VARIANT: otro rótulo y se puede enviar sin marcar nada («Ninguna»).
 * En solitario no se muestran porcentajes (con un solo jugador no dicen nada).
 */

'use strict';

const StandaloneQuestionMultipleChoice = (() => {
    const { escapeHtml, optionText, submitAnswer, buildQuestionMedia, wireQuestionAudio } = StandaloneQuestionCommon;

    const OPTION_GRADIENTS = [
        'pl-gradient-red',
        'pl-gradient-blue',
        'pl-gradient-yellow',
        'pl-gradient-green',
        'pl-gradient-purple',
        'pl-gradient-pink'
    ];

    function _t(key, fallback) {
        return window.XiroI18n?.t(key) || fallback;
    }

    const MULTIPLE_VARIANT = {
        answerType: 'multiple_choice',
        allowEmpty: false,
        banner: () => `✓ ${_t('standalone.game.multiple_hint', 'Selección múltiple (puedes marcar varias)')}`,
        sendLabel: () => _t('standalone.game.submit', 'Enviar respuesta'),
        emptyLabel: () => _t('standalone.game.submit', 'Enviar respuesta')
    };

    const SURVEY_VARIANT = {
        answerType: 'survey_multiple',
        allowEmpty: true,
        banner: () =>
            `<i class="fas fa-square-poll-horizontal" aria-hidden="true"></i> ${_t('standalone.game.survey_multiple_hint', 'Encuesta · marca las que quieras, o ninguna')}`,
        sendLabel: () => _t('standalone.game.submit', 'Enviar respuesta'),
        emptyLabel: () => _t('standalone.game.survey_multiple_none', 'Ninguna')
    };

    function _updateSubmit(submitBtn, variant, count) {
        submitBtn.disabled = count === 0 && !variant.allowEmpty;
        if (variant.allowEmpty) submitBtn.textContent = count > 0 ? variant.sendLabel() : variant.emptyLabel();
    }

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

    function render(container, question, { onSubmitted }, variant = MULTIPLE_VARIANT) {
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
                <div class="pl-multi-banner"><p>${variant.banner()}</p></div>
                <div class="pl-answers-grid">
                    ${options
        .map(
            (opt, idx) => `
                        <button type="button" class="pl-answer-btn pl-glass-3d ${OPTION_GRADIENTS[idx % OPTION_GRADIENTS.length]}" data-standalone-answer data-index="${idx}">
                            <span class="pl-answer-number">${idx + 1}</span>
                            ${opt.option_image_url ? `<img src="${escapeHtml(opt.option_image_url)}" alt="" class="pl-answer-image">` : ''}
                            <span class="pl-answer-text">${escapeHtml(optionText(opt))}</span>
                        </button>
                    `
        )
        .join('')}
                </div>
                <div class="pl-submit-bar">
                    <button type="button" class="pl-submit-btn" data-standalone-action="submit-multiple" disabled>
                        ${variant.emptyLabel()}
                    </button>
                </div>
            </div>
        `;

        if (hasAudio) wireQuestionAudio(container);

        const buttons = Array.from(container.querySelectorAll('[data-standalone-answer]'));
        const submitBtn = container.querySelector('[data-standalone-action="submit-multiple"]');
        _updateSubmit(submitBtn, variant, 0);

        buttons.forEach(btn =>
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.index);
                if (selected.has(idx)) {
                    selected.delete(idx);
                } else {
                    selected.add(idx);
                }
                _markSelected(btn, selected.has(idx));
                _updateSubmit(submitBtn, variant, selected.size);
            })
        );

        submitBtn.addEventListener('click', async () => {
            buttons.forEach(btn => {
                btn.disabled = true;
            });
            submitBtn.disabled = true;

            const ack = await submitAnswer({ selectedIndices: [...selected] }, variant.answerType);
            if (ack && ack.ok === false) {
                StandaloneState.get().answered = false;
                buttons.forEach(btn => {
                    btn.disabled = false;
                });
                submitBtn.disabled = false;
                return;
            }
            onSubmitted();
        });
    }

    /** Encuesta de selección múltiple. */
    function renderSurvey(container, question, actions) {
        render(container, question, actions, SURVEY_VARIANT);
    }

    /** Resultado de la encuesta: las opciones con las elegidas marcadas (css/survey-multiple.css). */
    function surveyResultMessage(data) {
        const chosen = new Set(data.surveyMultipleDetails?.selectedIndices || []);
        const options = StandaloneState.get().currentQuestion?.options || [];
        const rows = options
            .map(
                (opt, idx) => `<li class="sm-row${chosen.has(idx) ? ' sm-row--mine' : ''}">
                    <div class="sm-row__head">
                        <span class="sm-row__mark">${chosen.has(idx) ? '<i class="fas fa-check" aria-hidden="true"></i>' : ''}</span>
                        <span class="sm-row__text">${escapeHtml(optionText(opt))}</span>
                    </div>
                </li>`
            )
            .join('');
        const none = chosen.size === 0
            ? `<p class="sm-results__status">${_t('standalone.game.survey_multiple_none_chosen', 'No marcaste ninguna opción')}</p>`
            : '';
        return `
            <i class="fas fa-square-poll-horizontal pl-reveal-icon" aria-hidden="true"></i>
            <h2>${_t('standalone.game.answer_registered', 'Respuesta registrada')}</h2>
            <section class="sm-results">${none}<ol class="sm-results__list">${rows}</ol></section>
        `;
    }

    return { render, renderSurvey, surveyResultMessage };
})();
