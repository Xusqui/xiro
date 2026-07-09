/**
 * @fileoverview Pantalla de feedback tras responder (o tras expirar el tiempo)
 * Fuente primaria: evento 'answer-result' (rico, solo llega si el jugador respondió).
 * Fuente secundaria: evento 'reveal-answer' (limitado, cubre el caso de timeout sin responder).
 */

'use strict';

const StandaloneReveal = (() => {
    const { escapeHtml } = StandaloneQuestionCommon;

    function _t(key, fallback) {
        return window.XiroI18n?.t(key) || fallback;
    }

    function _headerFor(correct) {
        if (correct === true) return `<h2 class="reveal-title reveal-correct"><i class="fas fa-circle-check"></i> ${_t('standalone.game.correct', '¡Correcto!')}</h2>`;
        if (correct === false) return `<h2 class="reveal-title reveal-incorrect"><i class="fas fa-circle-xmark"></i> ${_t('standalone.game.incorrect', 'Incorrecto')}</h2>`;
        return `<h2 class="reveal-title"><i class="fas fa-circle-info"></i> ${_t('standalone.game.answer_registered', 'Respuesta registrada')}</h2>`;
    }

    function _multipleChoiceList(details) {
        if (!details?.options) return '';
        return `
            <ul class="reveal-options-list">
                ${details.options.map(opt => `
                    <li class="${opt.isCorrect ? 'is-correct' : ''}">
                        <i class="fas ${opt.isCorrect ? 'fa-check' : 'fa-xmark'}"></i> ${escapeHtml(opt.text)}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    function _nextButton(onNext) {
        return `<button type="button" class="btn-primary" data-standalone-action="reveal-next">${_t('standalone.game.next', 'Siguiente')}</button>`;
    }

    function _wireNext(container, onNext) {
        container.querySelector('[data-standalone-action="reveal-next"]').addEventListener('click', onNext);
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} data - payload de 'answer-result'
     */
    function showAnswerResult(container, data, { onNext }) {
        const pointsLine = typeof data.points === 'number'
            ? `<p class="reveal-points">+${data.points} ${_t('standalone.game.score', 'Puntos')} · ${_t('standalone.game.total', 'Total')}: ${data.totalScore ?? 0}</p>`
            : '';

        container.innerHTML = `
            <div class="standalone-reveal">
                ${_headerFor(data.correct)}
                ${data.correctAnswer ? `<p class="reveal-correct-answer">${_t('standalone.game.correct_answer', 'Respuesta correcta')}: <strong>${escapeHtml(data.correctAnswer)}</strong></p>` : ''}
                ${data.orderDetails ? `<p class="reveal-detail">${_t('standalone.game.order_score', 'Posiciones correctas')}: ${data.orderDetails.correctCount}/${data.orderDetails.totalOptions}</p>` : ''}
                ${_multipleChoiceList(data.multipleChoiceDetails)}
                ${data.justification ? `<p class="reveal-justification">${escapeHtml(data.justification)}</p>` : ''}
                ${pointsLine}
                ${_nextButton()}
            </div>
        `;
        _wireNext(container, onNext);
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} data - payload de 'reveal-answer' ({correctAnswer, justification, correctOrder})
     */
    function showRevealOnly(container, data, { onNext }) {
        const orderList = Array.isArray(data.correctOrder)
            ? `<ol class="reveal-options-list">${data.correctOrder.map(o => `<li>${escapeHtml(o.text)}</li>`).join('')}</ol>`
            : '';

        container.innerHTML = `
            <div class="standalone-reveal">
                <h2 class="reveal-title"><i class="fas fa-hourglass-end"></i> ${_t('standalone.game.time_up', 'Tiempo agotado')}</h2>
                ${data.correctAnswer ? `<p class="reveal-correct-answer">${_t('standalone.game.correct_answer', 'Respuesta correcta')}: <strong>${escapeHtml(data.correctAnswer)}</strong></p>` : ''}
                ${orderList}
                ${data.justification ? `<p class="reveal-justification">${escapeHtml(data.justification)}</p>` : ''}
                ${_nextButton()}
            </div>
        `;
        _wireNext(container, onNext);
    }

    return { showAnswerResult, showRevealOnly };
})();
