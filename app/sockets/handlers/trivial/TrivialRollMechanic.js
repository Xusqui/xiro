/**
 * @fileoverview Trivial - mecánica de tiradas consecutivas
 *
 * Regla: si el actor acierta, puede volver a tirar hasta MAX_CONSECUTIVE veces
 * seguidas. Si falla o llega al límite, el turno pasa al siguiente jugador.
 *
 * El contador se almacena en state.consecutiveRolls (objeto persistido en Redis).
 */

'use strict';

const MAX_CONSECUTIVE = 2;  // Máximo de re-tiradas (total = 1 inicial + 2 = 3)

/**
 * Decide qué hacer después de revelar la respuesta.
 * Muta state.consecutiveRolls del actor.
 *
 * @param {Object} state           - Estado trivial (state.consecutiveRolls debe existir)
 * @param {string} actorNick       - Nickname/equipo del jugador en turno
 * @param {boolean} wasCorrect     - Si acertó la pregunta
 * @returns {'roll-again' | 'advance-turn'}
 */
function nextTurnAction(state, actorNick, wasCorrect) {
    if (!state.consecutiveRolls) state.consecutiveRolls = {};

    const current = state.consecutiveRolls[actorNick] || 0;

    if (!wasCorrect || current >= MAX_CONSECUTIVE) {
        state.consecutiveRolls[actorNick] = 0;
        return 'advance-turn';
    }

    state.consecutiveRolls[actorNick] = current + 1;
    return 'roll-again';
}

/**
 * Reinicia el contador para el actor (llamar al avanzar turno).
 */
function resetRolls(state, actorNick) {
    if (!state.consecutiveRolls) state.consecutiveRolls = {};
    state.consecutiveRolls[actorNick] = 0;
}

module.exports = { MAX_CONSECUTIVE, nextTurnAction, resetRolls };
