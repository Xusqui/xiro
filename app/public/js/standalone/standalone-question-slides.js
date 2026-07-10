/**
 * @fileoverview Renderiza slides informativas (sin respuesta) del modo Standalone
 * Estética igual que player-slides-ui.js / player-slide-text-image-ui.js
 * (fondo degradado por tipo, insignia con icono, título/cuerpo grandes).
 */

'use strict';

globalThis.StandaloneQuestionSlides = (() => {
    const { escapeHtml } = StandaloneQuestionCommon;

    function _freeActivityFallback() {
        return window.XiroI18n?.t('standalone.game.free_activity') || 'Actividad libre';
    }

    function _renderImage(container, question, onContinue) {
        container.innerHTML = `
            <div class="pl-viewport" style="background:#111827; justify-content:center; align-items:center;">
                ${question.slide_image
                ? `<img class="pl-slide-image-img" src="${escapeHtml(question.slide_image)}" alt="">`
                : '<i class="fas fa-image" style="font-size:64px;color:rgba(255,255,255,0.3);"></i>'}
                <div class="pl-submit-bar" style="position:absolute; bottom:0; left:0; right:0;">
                    <button type="button" class="pl-submit-btn" data-standalone-action="continue-slide">
                        ${window.XiroI18n?.t('standalone.game.continue') || 'Continuar'}
                    </button>
                </div>
            </div>
        `;
    }

    function _renderTextual(container, question, onContinue) {
        const config = {
            comment: { bgClass: 'pl-slide-comment', icon: 'fa-comment', text: question.comment_text || question.question_text || _freeActivityFallback() },
            info: { bgClass: 'pl-slide-info', icon: 'fa-info-circle', text: question.comment_text || question.question_text || _freeActivityFallback() }
        }[question.slide_type] || { bgClass: 'pl-slide-text', icon: 'fa-info-circle', text: null };

        const nickname = escapeHtml(StandaloneState.get().nickname);
        const title = config.text ? '' : (question.slide_title ? `<h2 class="pl-slide-title">${escapeHtml(question.slide_title)}</h2>` : '');
        const body = config.text
            ? `<h2 class="pl-slide-title">${escapeHtml(config.text)}</h2>`
            : `<p class="pl-slide-body">${escapeHtml(question.slide_body || question.question_text)}</p>`;

        container.innerHTML = `
            <div class="pl-viewport ${config.bgClass}">
                <div class="pl-nickname-bar"><p>${nickname}</p></div>
                <div class="pl-slide-content">
                    <div class="pl-slide-badge"><i class="fas ${config.icon}"></i></div>
                    ${title}
                    ${body}
                    <div class="pl-reveal-continue">
                        <button type="button" class="pl-submit-btn" data-standalone-action="continue-slide">
                            ${window.XiroI18n?.t('standalone.game.continue') || 'Continuar'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} question
     * @param {{onContinue:Function}} actions
     */
    function render(container, question, { onContinue }) {
        if (question.slide_type === 'image') {
            _renderImage(container, question, onContinue);
        } else {
            _renderTextual(container, question, onContinue);
        }

        container.querySelector('[data-standalone-action="continue-slide"]')
            .addEventListener('click', () => onContinue());
    }

    return { render };
})();
