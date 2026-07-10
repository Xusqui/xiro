/**
 * @fileoverview Pantalla de feedback tras responder (o tras expirar el tiempo)
 * Fuente primaria: evento 'answer-result' (rico, solo llega si el jugador respondió).
 * Fuente secundaria: evento 'reveal-answer' (limitado, cubre el caso de timeout sin responder).
 * Estética igual que la del jugador real (mismos colores/estructura que el
 * handler 'answer-result' de player-answer.js), reutilizando directamente su
 * lógica de color/aproximación (PlayerAnswerVisualLogic, sin efectos
 * secundarios) para que el resultado se vea idéntico.
 */

'use strict';

const StandaloneReveal = (() => {
    const { escapeHtml } = StandaloneQuestionCommon;

    function _t(key, fallback) {
        return window.XiroI18n?.t(key) || fallback;
    }

    function _pointsPill(points) {
        return typeof points === 'number'
            ? `<p class="pl-reveal-points">${points >= 0 ? '+' : ''}${points} ${_t('standalone.game.score', 'Puntos')}</p>`
            : '';
    }

    function _justificationBox(justification) {
        return justification
            ? `<div class="pl-reveal-box"><p>${escapeHtml(justification)}</p></div>`
            : '';
    }

    function _orderMessage(data) {
        const positionsCorrect = data.orderDetails?.positionsCorrect || [];
        const rows = positionsCorrect.map((isCorrect, position) => `
            <div class="pl-reveal-breakdown-item ${isCorrect ? 'is-correct' : 'is-incorrect'}">
                <span class="pl-reveal-breakdown-label"><i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i> ${_t('standalone.game.order_position', 'Posición')} ${position + 1}</span>
            </div>
        `).join('');

        return `
            <i class="fas fa-list-ol pl-reveal-icon"></i>
            <h2>${_t('standalone.game.order_result', '¡Resultado del orden!')}</h2>
            <div class="pl-reveal-breakdown">${rows}</div>
            ${_pointsPill(data.points)}
        `;
    }

    function _multipleChoiceMessage(data) {
        const mcDetails = data.multipleChoiceDetails;
        const correctSet = new Set(mcDetails.correctIndices || []);

        const breakdown = (mcDetails.selectedIndices || []).map(idx => {
            const option = mcDetails.options[idx];
            const isCorrect = correctSet.has(idx);
            const points = isCorrect ? mcDetails.pointsPerCorrect : -mcDetails.penaltyPerIncorrect;
            return `
                <div class="pl-reveal-breakdown-item ${isCorrect ? 'is-correct' : 'is-incorrect'}">
                    <span class="pl-reveal-breakdown-label"><i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i> ${escapeHtml(option?.text || '')}</span>
                    <span class="pl-reveal-breakdown-points">${points >= 0 ? '+' : ''}${points}</span>
                </div>
            `;
        }).join('');

        const totalIcon = data.points > 0 ? 'fa-circle-check' : 'fa-circle-xmark';
        const totalText = data.points > 0 ? _t('standalone.game.correct', '¡Correcto!') : _t('standalone.game.incorrect', 'Incorrecto');

        return `
            <i class="fas ${totalIcon} pl-reveal-icon"></i>
            <h2>${totalText}</h2>
            <div class="pl-reveal-breakdown">${breakdown}</div>
            ${_pointsPill(data.points)}
        `;
    }

    function _headerMessage(data, isApproximate) {
        if (data.correct === null) {
            return `
                <i class="fas fa-vote-yea pl-reveal-icon"></i>
                <h2>${_t('standalone.game.answer_registered', 'Respuesta registrada')}</h2>
            `;
        }

        if (data.correct) {
            return `
                <i class="fas fa-circle-check pl-reveal-icon"></i>
                <h2>${_t('standalone.game.correct', '¡Correcto!')}</h2>
                ${_pointsPill(data.points)}
                ${_justificationBox(data.justification)}
            `;
        }

        if (isApproximate) {
            return `
                <i class="fas fa-bullseye pl-reveal-icon"></i>
                <h2>${_t('standalone.game.approximate', '¡Aproximada!')}</h2>
                ${_pointsPill(data.points)}
            `;
        }

        return `
            <i class="fas fa-circle-xmark pl-reveal-icon"></i>
            <h2>${_t('standalone.game.incorrect', 'Incorrecto')}</h2>
            ${_pointsPill(data.points)}
            ${data.correctAnswer ? `<div class="pl-reveal-box"><p>${_t('standalone.game.correct_answer', 'Respuesta correcta')}</p><p>${escapeHtml(data.correctAnswer)}</p></div>` : ''}
            ${_justificationBox(data.justification)}
        `;
    }

    function _nextButton() {
        return `<div class="pl-reveal-continue"><button type="button" class="pl-submit-btn" data-standalone-action="reveal-next">${_t('standalone.game.next', 'Siguiente')}</button></div>`;
    }

    function _wireNext(container, onNext) {
        container.querySelector('[data-standalone-action="reveal-next"]').addEventListener('click', onNext);
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} data - payload de 'answer-result'
     */
    function showAnswerResult(container, data, { onNext }) {
        const isOrder = !!data.orderDetails;
        const totalOptions = data.orderDetails?.totalOptions || 0;
        const correctCount = data.orderDetails?.correctCount || 0;
        const isFullyCorrect = totalOptions > 0 && correctCount === totalOptions;
        const currentSlideType = StandaloneState.get().currentQuestion?.question_type || '';

        const visualLogic = window.PlayerAnswerVisualLogic;
        const isApproximate = visualLogic.shouldShowApproximateResult({ isOrder, currentSlideType, data });
        const color = visualLogic.resolveResultColor({ isOrder, isFullyCorrect, isApproximate, isCorrect: data.correct });

        let message;
        if (isOrder) {
            message = _orderMessage(data);
        } else if (data.multipleChoiceDetails?.options) {
            message = _multipleChoiceMessage(data);
        } else {
            message = _headerMessage(data, isApproximate);
        }

        container.innerHTML = `<div class="pl-reveal ${color}">${message}${_nextButton()}</div>`;
        _wireNext(container, onNext);
    }

    /**
     * @param {HTMLElement} container
     * @param {Object} data - payload de 'reveal-answer' ({correctAnswer, justification, correctOrder})
     */
    function showRevealOnly(container, data, { onNext }) {
        const orderList = Array.isArray(data.correctOrder)
            ? `<div class="pl-reveal-breakdown">${data.correctOrder.map(o => `<div class="pl-reveal-breakdown-item is-correct"><span class="pl-reveal-breakdown-label">${escapeHtml(o.text)}</span></div>`).join('')}</div>`
            : '';

        container.innerHTML = `
            <div class="pl-reveal" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);">
                <i class="fas fa-clock pl-reveal-icon" style="color:#fbbf24;"></i>
                <h2>${_t('standalone.game.time_up', '¡Tiempo agotado!')}</h2>
                ${data.correctAnswer ? `<div class="pl-reveal-box"><p>${_t('standalone.game.correct_answer', 'Respuesta correcta')}</p><p>${escapeHtml(data.correctAnswer)}</p></div>` : ''}
                ${orderList}
                ${_justificationBox(data.justification)}
                ${_nextButton()}
            </div>
        `;
        _wireNext(container, onNext);
    }

    return { showAnswerResult, showRevealOnly };
})();
