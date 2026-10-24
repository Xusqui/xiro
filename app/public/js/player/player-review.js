/**
 * @fileoverview Revisión de una pregunta ya revelada de un juego personalizado
 * (el presentador ha vuelto atrás). El servidor emite 'question-review' a todos con
 * la solución; cada jugador pide su propio resultado con 'get-review-state' (ack).
 * Al reconectar en revisión, player-reconnection.js llama a requestReviewState.
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';
import { correctAnswerBlockHtml, forgetReveal } from './player-reveal-correct.js?v=20260922172926';
import { cancelStreakAnimation } from './player-streak-ui.js?v=20260922172926';
import {
    setCanAnswer,
    setHaRespondido,
    setPendingAnswer,
    setSendingAnswer,
    clearOrderAutoSendTimer,
    clearMatchAutoSendTimer
} from './player-state.js?v=20260922172926';
import { reviewScreenHtml } from './player-review-view.js?v=20261024180000';

function renderReview(state) {
    document.body.innerHTML = _tHtml(reviewScreenHtml(state, { escapeHtml, correctAnswerBlockHtml }));
}

/** La pregunta ya se jugó: nada de respuestas pendientes ni envíos automáticos. */
function closeAnswering() {
    cancelStreakAnimation();
    window.XiroRandomPointsOverlay?.hide();
    forgetReveal();
    clearOrderAutoSendTimer();
    clearMatchAutoSendTimer();
    setPendingAnswer(null);
    setSendingAnswer(false);
    setHaRespondido(true);
    setCanAnswer(false);
}

/**
 * Pide al servidor la revisión con el resultado propio y la pinta.
 * @param {Object|null} [fallback] - Lo que ya se sabe (sin resultado) por si la petición falla
 */
export function requestReviewState(fallback = null) {
    closeAnswering();
    socket.emit('get-review-state', {}, response => {
        if (response?.ok) {
            renderReview(response);
            return;
        }
        if (fallback) renderReview({ ...fallback, result: null });
    });
}

function onQuestionReview(data) {
    // La solución ya está aquí: se pinta mientras llega el resultado propio
    closeAnswering();
    renderReview({ ...data, result: null });
    requestReviewState(data);
}

export function registerReviewEvents() {
    socket.on('question-review', onQuestionReview);
}
