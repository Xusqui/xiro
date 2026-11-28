/**
 * @fileoverview Envío de «Nube de palabras» desde el móvil. El botón Enviar manda cada casilla
 * rellenada y después un mensaje final que da al jugador por terminado (ver
 * player-wordcloud-state.js). A diferencia del resto de preguntas no usa la cola de respuesta
 * pendiente ni marca "ya respondió". El cupo y las repetidas los decide el servidor; aquí solo se
 * manda, se interpreta el resultado y se refresca la pantalla.
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { getPin, getSessionId, getNickname, getCanAnswer } from './player-state.js?v=20260922172926';
import { sendWordCloudBatch, wordCloudNotice } from './player-wordcloud-state.js?v=20261128000000';
import { showWordCloudAfterSending, showWordCloudNotice } from './player-wordcloud-ui.js?v=20261128000000';

let _sending = false;

function createRequestId() {
    return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function emitAnswer(payload) {
    return new Promise((resolve, reject) => {
        socket.timeout(20000).emit('submit-answer', payload, (err, resp) => (err ? reject(err) : resolve(resp)));
    });
}

function showResult(result) {
    if (result.status === 'finished') {
        showWordCloudAfterSending(result.cloud);
        showWordCloudNotice(result.someRejected ? wordCloudNotice('some-rejected') : null);
        return;
    }
    // Sin repintar el formulario: lo que escribió el jugador se queda para corregirlo o reintentar
    showWordCloudNotice(wordCloudNotice(result.status === 'retry' ? 'server-error' : result.reason));
}

/**
 * Botón Enviar: manda las casillas rellenadas y da al jugador por terminado.
 * @param {string[]} rawValues - Texto de cada casilla
 * @returns {Promise<void>}
 */
export async function enviarPalabrasNube(rawValues) {
    if (!getCanAnswer() || _sending || !getNickname()) return;
    const room = getSessionId() ? { sessionId: getSessionId() } : { pin: getPin() };
    _sending = true;
    try {
        const result = await sendWordCloudBatch({
            rawValues,
            room,
            nickname: getNickname(),
            newRequestId: createRequestId,
            send: emitAnswer
        });
        showResult(result);
    } finally {
        _sending = false;
    }
}
