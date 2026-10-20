/**
 * @fileoverview «Completa la frase» en equipos (jugador): cada hueco se comprueba al
 * completarlo y lo acertado aparece en todo el equipo.
 *
 * - 'fill-blanks-check' { blankIndex, word }: el servidor dice si la palabra es correcta.
 *   Si lo es, la bloquea para el equipo y avisa a los compañeros ('fill-blanks-team-solved').
 * - Las pistas del equipo llegan por 'fill-blanks-team-hint'.
 * - El primer ENVIAR del equipo cierra la pregunta para todos: 'fill-blanks-team-submitted'
 *   hace que los compañeros envíen lo mismo (con el bonus del que envió).
 * - Al pintar la pregunta (también tras reconectar) 'fill-blanks-sync' trae lo que ya
 *   tenía el equipo (o las pistas propias, en individual).
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { getTeamMode } from './player-state.js?v=20260922172926';

let listeners = null;

export function isTeamFillBlanks() {
    return Boolean(getTeamMode()?.isTeamMode);
}

export function leaveTeamFillBlanks() {
    if (!listeners) return;
    socket.off('fill-blanks-team-solved', listeners.solved);
    socket.off('fill-blanks-team-hint', listeners.hint);
    socket.off('fill-blanks-team-submitted', listeners.submitted);
    listeners = null;
}

/**
 * Engancha la pregunta actual al equipo y pide la sincronización (en individual solo
 * recupera las pistas propias tras reconectar).
 * @param {{ onSolved: Function, onHint: Function, onSubmitted: Function, onSync: Function }} handlers
 */
export function joinFillBlanks({ onSolved, onHint, onSubmitted, onSync }) {
    leaveTeamFillBlanks();
    const current = { solved: onSolved, hint: onHint, submitted: onSubmitted };
    if (isTeamFillBlanks()) {
        socket.on('fill-blanks-team-solved', current.solved);
        socket.on('fill-blanks-team-hint', current.hint);
        socket.on('fill-blanks-team-submitted', current.submitted);
        listeners = current;
    }

    socket.emit('fill-blanks-sync', {}, ack => {
        // Si ya se pasó a otra pregunta, la respuesta no vale
        if (!ack?.ok || (isTeamFillBlanks() && listeners !== current)) return;
        onSync(ack);
    });
}

/**
 * Comprueba la palabra de un hueco (solo equipos).
 * @returns {Promise<{ ok: boolean, correct?: boolean, word?: string, reason?: string }>}
 */
export function checkBlank(blankIndex, word) {
    return new Promise(resolve => {
        if (!isTeamFillBlanks()) {
            resolve({ ok: false, reason: 'not-team' });
            return;
        }
        socket.emit('fill-blanks-check', { blankIndex, word }, ack => resolve(ack || { ok: false, reason: 'error' }));
    });
}

/** Pide una letra del hueco (vale para el equipo si juega en equipos). */
export function requestHint(blankIndex) {
    return new Promise(resolve => {
        socket.emit('fill-blanks-hint', { blankIndex }, ack => resolve(ack || { ok: false, reason: 'error' }));
    });
}
