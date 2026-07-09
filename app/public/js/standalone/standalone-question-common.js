/**
 * @fileoverview Helpers compartidos por los renderizadores de pregunta de Standalone
 */

'use strict';

globalThis.StandaloneQuestionCommon = (() => {
    let countdownHandle = null;

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text ?? '').replace(/[&<>"']/g, m => map[m]);
    }

    function generateRequestId() {
        return `standalone_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * Cuenta atrás visual. No es autoritativa: el servidor revela la respuesta
     * por su cuenta cuando expira el tiempo o cuando el jugador responde.
     */
    function startCountdown(seconds, { onTick, onExpire } = {}) {
        stopCountdown();
        if (!Number.isFinite(seconds) || seconds <= 0) return;

        let remaining = seconds;
        if (typeof onTick === 'function') onTick(remaining);

        countdownHandle = setInterval(() => {
            remaining -= 1;
            if (typeof onTick === 'function') onTick(Math.max(remaining, 0));
            if (remaining <= 0) {
                stopCountdown();
                if (typeof onExpire === 'function') onExpire();
            }
        }, 1000);
    }

    function stopCountdown() {
        if (countdownHandle) {
            clearInterval(countdownHandle);
            countdownHandle = null;
        }
    }

    function lockAnswering(container) {
        if (!container) return;
        container.querySelectorAll('[data-standalone-answer]').forEach(el => {
            el.disabled = true;
            el.classList.add('is-locked');
        });
    }

    function optionText(option) {
        return option?.optionText || option?.text || option?.option_text || '';
    }

    /**
     * Construye el payload común (pin/sessionId/nickname/requestId) y envía la
     * respuesta vía StandaloneSocket. `typeFields` aporta las claves propias
     * del tipo de pregunta (index/order/matches/playerAnswer/selectedIndices).
     * @returns {Promise<Object>} ack del servidor
     */
    async function submitAnswer(typeFields, answerType) {
        const state = StandaloneState.get();
        state.answered = true;

        const payload = {
            pin: state.pin,
            sessionId: state.sessionId,
            nickname: state.nickname,
            requestId: generateRequestId(),
            ...(answerType ? { answerType } : {}),
            ...typeFields
        };

        return StandaloneSocket.submitAnswer(payload);
    }

    return {
        escapeHtml,
        generateRequestId,
        startCountdown,
        stopCountdown,
        lockAnswering,
        optionText,
        submitAnswer
    };
})();
