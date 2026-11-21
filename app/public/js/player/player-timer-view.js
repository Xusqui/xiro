/**
 * @fileoverview Píldora del temporizador informativo del móvil (no se toca, solo informa). Repite lo
 * que enseña el presentador a partir de su marca (core/countdown-anchor.js), en hora del servidor.
 *
 * Cada pantalla de pregunta marca su barra del apodo con `data-player-timer-slot`. Como las pantallas
 * se pintan con document.body.innerHTML, la píldora se vuelve a poner en cada segundo si hace falta;
 * en pantallas sin hueco (diapositivas, espera, resultado) no se ve, y tras responder se quita.
 * Estilos en css/player-timer.css.
 */

import { displayFromAnchor } from '../core/countdown-anchor.js?v=20261121180000';

const SLOT_SELECTOR = '[data-player-timer-slot]';
const PILL_SELECTOR = '.pl-timer';
// Margen para despertar justo después del cambio de segundo, no justo antes
const TICK_SLACK_MS = 15;

function isValidAnchor(anchor) {
    return Boolean(anchor) &&
        [anchor.value, anchor.total, anchor.at].every(Number.isFinite) &&
        anchor.total > 0 && anchor.value >= 0 && typeof anchor.paused === 'boolean';
}

function pillMarkup(doc, label) {
    const pill = doc.createElement('span');
    pill.className = 'pl-timer';
    pill.setAttribute('role', 'timer');
    pill.setAttribute('aria-label', typeof label === 'function' ? label() : label);
    pill.innerHTML =
        '<svg class="pl-timer__ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' +
        '<circle class="pl-timer__track" cx="18" cy="18" r="15"/>' +
        '<circle class="pl-timer__progress" cx="18" cy="18" r="15" pathLength="100"/></svg>' +
        '<span class="pl-timer__value"></span>';
    return pill;
}

/**
 * El anillo se coloca donde está ahora y se vacía en línea recta hasta el siguiente segundo, así se
 * mueve suave sin pintar en cada fotograma.
 */
function moveRing(ring, shown, total) {
    ring.style.transition = 'none';
    ring.style.strokeDashoffset = String(100 * (1 - shown.fraction));
    if (shown.msToNextTick === null) return;
    ring.getBoundingClientRect();
    ring.style.transition = `stroke-dashoffset ${shown.msToNextTick}ms linear`;
    ring.style.strokeDashoffset = String(100 * (1 - Math.max(0, shown.value - 1) / total));
}

function applyToPill(pill, shown, total) {
    const valueEl = pill.querySelector('.pl-timer__value');
    const text = String(shown.value);
    const changed = valueEl.textContent !== text;
    valueEl.textContent = text;
    pill.classList.toggle('is-urgent', shown.urgent);
    pill.classList.toggle('is-paused', shown.paused);
    if (changed && shown.urgent) {
        pill.classList.remove('is-beat');
        pill.getBoundingClientRect();
        pill.classList.add('is-beat');
    }
    moveRing(pill.querySelector('.pl-timer__progress'), shown, total);
}

/**
 * @param {Object} deps
 * @param {{now: function(): number}} deps.clock - Hora del servidor (core/server-clock.js)
 * @param {function(): boolean} deps.isAnswered - ¿Ya respondió el jugador esta pregunta?
 * @param {string|function(): string} deps.label - Nombre accesible («Tiempo restante»); función si se
 *   traduce al pintar (los diccionarios cargan después de registrar)
 * @param {function(Function): *} [deps.requestFrame] - requestAnimationFrame (inyectable en tests)
 * @param {Document} [deps.doc=document]
 * @returns {{setAnchor: function(Object): void, clear: function(): void}}
 */
export function createPlayerTimer({ clock, isAnswered, label, requestFrame, doc = document }) {
    const frame = requestFrame || (fn => window.requestAnimationFrame(fn));
    let anchor = null;
    let tickTimer = null;

    function removePill() {
        const pill = doc.querySelector(PILL_SELECTOR);
        if (pill) pill.remove();
    }

    function currentPill() {
        const slot = doc.querySelector(SLOT_SELECTOR);
        if (!slot || isAnswered()) {
            removePill();
            return null;
        }
        return slot.querySelector(PILL_SELECTOR) || slot.appendChild(pillMarkup(doc, label));
    }

    function paint() {
        if (!anchor) return;
        const shown = displayFromAnchor(anchor, clock.now());
        const pill = currentPill();
        if (pill) applyToPill(pill, shown, anchor.total);
        clearTimeout(tickTimer);
        if (shown.msToNextTick !== null) {
            tickTimer = setTimeout(() => frame(paint), shown.msToNextTick + TICK_SLACK_MS);
        }
    }

    return {
        setAnchor(next) {
            if (!isValidAnchor(next)) return;
            anchor = { value: next.value, total: next.total, at: next.at, paused: next.paused };
            frame(paint);
        },
        clear() {
            anchor = null;
            clearTimeout(tickTimer);
            removePill();
        }
    };
}
