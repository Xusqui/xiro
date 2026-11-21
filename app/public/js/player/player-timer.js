/**
 * @fileoverview Temporizador informativo del móvil, sincronizado con el del presentador: mide el
 * desfase con el reloj del servidor y pinta la píldora (player-timer-view.js) con cada marca
 * 'timer-sync' que reenvía el servidor. No decide nada: el cierre de la pregunta sigue llegando con
 * 'blocked-answer'.
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { getHaRespondido } from './player-state.js?v=20260922172926';
import { createServerClock } from '../core/server-clock.js?v=20261121180000';
import { createPlayerTimer } from './player-timer-view.js?v=20261121180000';

// Al acabar la pregunta (o la partida) la marca ya no vale
const CLEAR_EVENTS = ['blocked-answer', 'reveal-answer', 'game-ended', 'question-review'];

/** Registra el temporizador del móvil en el socket del jugador. */
export function registerPlayerTimer() {
    const clock = createServerClock(socket);
    clock.sync();
    const timer = createPlayerTimer({
        clock,
        isAnswered: getHaRespondido,
        label: () => _t('player.timer.label', null, 'Tiempo restante')
    });
    let anchorIndex = null;
    socket.on('timer-sync', anchor => {
        anchorIndex = anchor && anchor.questionIndex;
        timer.setAnchor(anchor);
    });
    // La marca de la pregunta nueva puede llegar antes que la propia pregunta: esa se conserva
    socket.on('new-question', data => {
        if (anchorIndex !== (data && data.currentIndex)) timer.clear();
    });
    CLEAR_EVENTS.forEach(event => socket.on(event, () => timer.clear()));
}
