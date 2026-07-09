/**
 * @fileoverview Renderiza slides informativas (sin respuesta) del modo Standalone
 */

'use strict';

globalThis.StandaloneQuestionSlides = (() => {
    const { escapeHtml } = StandaloneQuestionCommon;

    function _freeActivityFallback() {
        return window.XiroI18n?.t('standalone.game.free_activity') || 'Actividad libre';
    }

    function _body(question) {
        switch (question.slide_type) {
            case 'comment':
                // Un slide 'comment' sin comment_text es una "Actividad libre" a
                // cargo del presentador (ver rc-comment-title en
                // presenter-remote-comment.js) — sin ese fallback quedaba en blanco.
                return `<p class="slide-comment">${escapeHtml(question.comment_text || question.question_text || _freeActivityFallback())}</p>`;
            case 'info':
                // 'info', igual que 'comment', guarda su texto en comment_text
                // (no en slide_title/slide_body) — ver player-slides-ui.js renderizarSlideInfo.
                return `<p class="slide-body">${escapeHtml(question.comment_text || question.question_text || _freeActivityFallback())}</p>`;
            case 'image':
                return `
                    ${question.slide_title ? `<h2 class="slide-title">${escapeHtml(question.slide_title)}</h2>` : ''}
                    ${question.slide_image ? `<img class="slide-image" src="${escapeHtml(question.slide_image)}" alt="">` : ''}
                    ${question.slide_body ? `<p class="slide-body">${escapeHtml(question.slide_body)}</p>` : ''}
                `;
            case 'text-image':
            case 'text':
            default:
                return `
                    ${question.slide_title ? `<h2 class="slide-title">${escapeHtml(question.slide_title)}</h2>` : ''}
                    <p class="slide-body">${escapeHtml(question.slide_body || question.question_text)}</p>
                `;
        }
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} question
     * @param {{onContinue:Function}} actions
     */
    function render(container, question, { onContinue }) {
        container.innerHTML = `
            <div class="standalone-slide">
                ${_body(question)}
                <button type="button" class="btn-primary" data-standalone-action="continue-slide">
                    ${window.XiroI18n?.t('standalone.game.continue') || 'Continuar'}
                </button>
            </div>
        `;

        container.querySelector('[data-standalone-action="continue-slide"]')
            .addEventListener('click', () => onContinue());
    }

    return { render };
})();
