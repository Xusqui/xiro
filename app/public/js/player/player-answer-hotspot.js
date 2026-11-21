/**
 * @fileoverview Envío de «Toca la imagen» (hotspot): manda el toque { x, y } relativo a la imagen.
 * Sin toque no hay envío (el botón está desactivado hasta tocar). Al agotarse el tiempo se envía la
 * chincheta puesta (blocked-answer), como en ordenar o la sopa de letras.
 */

import { setBodyHTML } from './player-streak-ui.js?v=20260922172926';
import { enviarPendiente } from './player-answer.js?v=20260922172926';
import {
    getPin,
    getSessionId,
    getNickname,
    getCanAnswer,
    setHaRespondido,
    getPendingAnswer,
    setPendingAnswer,
    getSendingAnswer
} from './player-state.js?v=20260922172926';
import { hotspotPayload } from './player-hotspot-state.js?v=20261119180000';

function createRequestId() {
    return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Envía el toque del jugador.
 * @param {boolean} [isAuto=false] - true al agotarse el tiempo (blocked-answer): manda la chincheta puesta
 */
export function enviarRespuestaHotspot(isAuto = false) {
    // Tiempo agotado: solo el envío automático puede mandar la chincheta
    if (!getCanAnswer() && !isAuto) return;
    if (getPendingAnswer() || getSendingAnswer() || !getNickname()) return;
    const room = getSessionId() ? { sessionId: getSessionId() } : { pin: getPin() };
    const payload = hotspotPayload(room, getNickname(), createRequestId());
    if (!payload) return;

    setHaRespondido(true);
    setPendingAnswer({ payload, playerAnswer: payload.tap, isAuto });
    if (isAuto) {
        enviarPendiente();
        return;
    }
    setBodyHTML(`
        <div class="answer-loading-container">
            <div class="spinner spinner-purple"></div>
            <h2>${_t('player.answer.sending_answer', null, 'Enviando tu respuesta...')}</h2>
        </div>
    `);
    enviarPendiente();
}
