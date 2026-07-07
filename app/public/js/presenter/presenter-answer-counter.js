/**
 * @fileoverview Contador de respuestas del presentador
 * Actualiza el contador "RESPUESTAS: X / Y" en la pantalla de preguntas
 */

import { getPlayersData } from './presenter-state.js?v=20260707171802';

/**
 * Actualizar contador de respuestas en la UI
 * Cuenta cuántos jugadores han respondido la pregunta actual
 */
export function updateAnswerCounter() {
    const ansCountEl = document.getElementById('ans-count');
    if (!ansCountEl) return;

    const ansTotalEl = document.getElementById('ans-total');

    const playersData = getPlayersData();
    let answeredCount = 0;

    for (const nick in playersData) {
        if (playersData[nick].answered === true) {
            answeredCount++;
        }
    }

    ansCountEl.textContent = _t(answeredCount);
    if (ansTotalEl) {
        ansTotalEl.textContent = _t(Object.keys(playersData).length);
    }
}
