/**
 * @fileoverview Delegación de eventos del presentador: clics en [data-presenter-action]
 * y cambios en [data-presenter-change].
 */

import {
    cambiarFiltro, buscarPINs, seleccionarPIN, volverAJuegos,
    mostrarSeleccionModo, configurarModoIndividual
} from './presenter-lobby.js?v=20260922172926';
import {
    mostrarConfiguracionEquipos, seleccionarNumEquipos,
    confirmarEquipos, updateColorOptions
} from './presenter-team-config.js?v=20260922172926';
import { empezar } from './presenter-lobby-init.js?v=20260922172926';
import { nextQuestionClick, togglePauseTimer, revealAnswerClick, assignManualPoints } from './presenter-socket-handlers-game.js?v=20260922172926';
import { toggleFullscreen } from './presenter-utils.js?v=20260922172926';
import { abandonarJuego, concluirJuegoYVolver, terminarJuego } from './presenter-session-control.js?v=20260922172926';

function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function decodeValue(value) {
    if (!value) return '';
    try {
        return decodeURIComponent(value);
    } catch (_) {
        return value;
    }
}

function resetPresenterSession() {
    localStorage.removeItem('xiro_presenter_sessionId');
    localStorage.removeItem('xiro_presenter_pin');
    sessionStorage.removeItem('xiro_presenter_sessionId');
    sessionStorage.removeItem('xiro_presenter_pin');
    window.location.href = '/presentador.html';
}

/** Llama a fn(pin) solo si el elemento lleva data-pin. */
function withPin(fn) {
    return el => {
        if (el.dataset.pin) fn(el.dataset.pin);
    };
}

/** Llama a fn(numEquipos, pin) si ambos datos son válidos. */
function withTeamCount(fn) {
    return el => {
        const teamCount = toNumberOrNull(el.dataset.numTeams);
        const pinValue = el.dataset.pin;
        if (teamCount !== null && pinValue) fn(teamCount, pinValue);
    };
}

function assignPointsFromElement(el) {
    const targetName = decodeValue(el.dataset.targetName);
    const points = toNumberOrNull(el.dataset.points);
    const isTeam = el.dataset.isTeam === 'true';
    if (targetName && points !== null) {
        assignManualPoints(targetName, points, isTeam);
    }
}

function closeOverlay(el) {
    const overlayId = el.dataset.overlayId;
    if (!overlayId) return;
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
}

/** Copia del QR (SVG o, si no hay, imagen del canvas) para el overlay a pantalla completa. */
function qrCopyForOverlay(qrCanvas) {
    const svgSrc = qrCanvas.querySelector('svg');
    if (svgSrc) {
        const clone = svgSrc.cloneNode(true);
        clone.style.cssText = 'height:100vh;width:auto;max-width:100vw;display:block;border-radius:1rem;';
        return clone;
    }
    const canvas = qrCanvas.querySelector('canvas');
    if (!canvas) return null;
    const img = new Image();
    img.src = canvas.toDataURL();
    img.style.cssText = 'height:100vh;width:auto;max-width:100vw;border-radius:1rem;';
    return img;
}

function expandQr() {
    if (document.getElementById('qr-fullscreen-overlay')) return;
    const qrCanvas = document.getElementById('qr-canvas');
    if (!qrCanvas) return;
    const overlay = document.createElement('div');
    overlay.id = 'qr-fullscreen-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    const copy = qrCopyForOverlay(qrCanvas);
    if (copy) overlay.appendChild(copy);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

/** Menú del operador (⋯): abre/cierra el panel con Terminar, Abandonar, idioma, etc. */
function setStageMenuOpen(open) {
    const button = document.getElementById('stage-menu-btn');
    const panel = document.getElementById('stage-menu-panel');
    if (!button || !panel) return;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
}

function toggleStageMenu() {
    const panel = document.getElementById('stage-menu-panel');
    if (panel) setStageMenuOpen(panel.hidden);
}

const PRESENTER_CLICK_ACTIONS = {
    'toggle-stage-menu': () => toggleStageMenu(),
    'toggle-fullscreen': () => toggleFullscreen(),
    'start-game': () => empezar(),
    'abandon-game': () => abandonarJuego(),
    'terminate-game': () => terminarJuego(),
    'reload-page': () => window.location.reload(),
    'reset-presenter-session': resetPresenterSession,
    'volver-juegos': () => volverAJuegos(),
    'change-filter': el => cambiarFiltro(el.dataset.filter || 'todos'),
    'select-pin': withPin(seleccionarPIN),
    'select-individual-mode': withPin(configurarModoIndividual),
    'show-team-config': withPin(mostrarConfiguracionEquipos),
    'show-mode-selection': withPin(mostrarSeleccionModo),
    'team-count': withTeamCount(seleccionarNumEquipos),
    'confirm-teams': withTeamCount(confirmarEquipos),
    'next-question': () => nextQuestionClick(),
    'toggle-timer': () => togglePauseTimer(),
    'reveal-answer': () => revealAnswerClick(),
    'assign-points': assignPointsFromElement,
    'conclude-and-home': () => concluirJuegoYVolver(),
    'close-overlay': closeOverlay,
    'expand-qr': () => expandQr()
};

export function setupPresenterActionDelegation() {
    document.addEventListener('click', (event) => {
        // Un clic fuera del menú del operador lo cierra
        if (!event.target.closest('#stage-menu-panel, #stage-menu-btn')) setStageMenuOpen(false);

        const actionElement = event.target.closest('[data-presenter-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.presenterAction;
        if (Object.hasOwn(PRESENTER_CLICK_ACTIONS, action)) PRESENTER_CLICK_ACTIONS[action](actionElement);
    });

    document.addEventListener('input', (event) => {
        const inputElement = event.target.closest('[data-presenter-input]');
        if (inputElement?.dataset.presenterInput === 'search-pins') {
            buscarPINs(inputElement.value);
        }
    });

    document.addEventListener('change', (event) => {
        const changeElement = event.target.closest('[data-presenter-change]');
        if (!changeElement) return;

        if (changeElement.dataset.presenterChange === 'team-colors') {
            const teamCount = toNumberOrNull(changeElement.dataset.numTeams);
            if (teamCount !== null) {
                updateColorOptions(teamCount);
            }
        }
    });
}
