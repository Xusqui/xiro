/**
 * @fileoverview Lectura de la marca del temporizador del presentador: { value, total, at, paused }
 * significa «el presentador enseña `value` desde el instante `at` (hora del servidor, ms) y baja
 * uno cada segundo desde ahí, salvo en pausa». El presentador es la fuente de verdad; el móvil solo
 * repite lo que él enseña. Sin imports a propósito (se prueba en un vm).
 */

// Como el overlay del presentador: los cinco últimos segundos se avisan
export const URGENT_SECONDS = 5;

/**
 * Lo que el temporizador del móvil enseña en un instante.
 * @param {{value: number, total: number, at: number, paused: boolean}} anchor - Marca del presentador
 * @param {number} serverNowMs - Hora del servidor ahora
 * @returns {{value: number, fraction: number, urgent: boolean, paused: boolean, msToNextTick: number|null}}
 *   fraction: tiempo que queda sobre el total (0-1, continuo, para el anillo); msToNextTick: null si ya
 *   no va a cambiar (pausa o cero)
 */
export function displayFromAnchor(anchor, serverNowMs) {
    const total = Math.max(1, anchor.total);
    const elapsedMs = anchor.paused ? 0 : Math.max(0, serverNowMs - anchor.at);
    const value = Math.max(0, anchor.value - Math.floor(elapsedMs / 1000));
    const exact = Math.max(0, anchor.value - elapsedMs / 1000);
    const ticking = !anchor.paused && value > 0;
    return {
        value,
        fraction: Math.min(1, exact / total),
        urgent: value > 0 && value <= URGENT_SECONDS,
        paused: Boolean(anchor.paused),
        msToNextTick: ticking ? 1000 - (elapsedMs % 1000) : null
    };
}
