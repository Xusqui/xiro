/**
 * @fileoverview Sopa de letras en equipos (jugador): lo que encuentra un
 * compañero y las pistas que pide aparecen en todo el equipo.
 *
 * - Cada palabra encontrada se comparte ('word-search-found'); el servidor la
 *   valida y la reenvía a los compañeros ('word-search-team-found').
 * - Las pistas del equipo llegan por 'word-search-team-hint'.
 * - Al pintar la pregunta (también tras reconectar) 'word-search-sync' trae lo
 *   que el equipo ya tenía.
 */

import { socket } from './player-socket-config.js?v=20260922172926';
import { getTeamMode } from './player-state.js?v=20260922172926';

let listeners = null;

export function isTeamWordSearch() {
    return Boolean(getTeamMode()?.isTeamMode);
}

export function leaveTeamWordSearch() {
    if (!listeners) return;
    socket.off('word-search-team-found', listeners.found);
    socket.off('word-search-team-hint', listeners.hint);
    listeners = null;
}

/**
 * Engancha la pregunta actual al equipo.
 * @param {{ onFound: Function, onHint: Function }} handlers - reciben
 *   { wordIndex, r1, c1, r2, c2, by } y { wordIndex, row, col }
 */
export function joinTeamWordSearch({ onFound, onHint }) {
    leaveTeamWordSearch();
    if (!isTeamWordSearch()) return;

    const current = { found: onFound, hint: onHint };
    socket.on('word-search-team-found', current.found);
    socket.on('word-search-team-hint', current.hint);
    listeners = current;

    socket.emit('word-search-sync', {}, (ack) => {
        // Si ya se pasó a otra pregunta, la respuesta no vale
        if (!ack?.ok || listeners !== current) return;
        (ack.found || []).forEach(found => onFound(found));
        (ack.hints || []).forEach(hint => onHint(hint));
    });
}

/** Comparte con el equipo una palabra recién encontrada (solo coordenadas). */
export function shareFoundWord({ r1, c1, r2, c2 }) {
    if (!isTeamWordSearch()) return;
    socket.emit('word-search-found', { r1, c1, r2, c2 });
}
