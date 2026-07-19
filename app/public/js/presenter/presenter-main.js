/**
 * @fileoverview Presentador - Archivo principal
 * Coordina todos los módulos del presentador y expone funciones globales
 */

import { initializePresenterSession } from './presenter-socket-config.js?v=20260719190748';
import { initRemoteControlMode } from './presenter-remote.js?v=20260719190748';
import {
    mostrarSelectorPIN, cambiarFiltro, seleccionarPIN, volverAJuegos,
    mostrarSeleccionModo, configurarModoIndividual, mostrarSeleccionModoDirecto,
    rerenderCurrentLobbyView
} from './presenter-lobby.js?v=20260719190748';
import {
    mostrarConfiguracionEquipos, seleccionarNumEquipos,
    confirmarEquipos, updateColorOptions
} from './presenter-team-config.js?v=20260719190748';
import { iniciarLobby, empezar } from './presenter-lobby-init.js?v=20260719190748';
import { registerLobbySocketHandlers } from './presenter-socket-handlers-lobby.js?v=20260719190748';
import { registerGameSocketHandlers, nextQuestionClick, togglePauseTimer, revealAnswerClick, assignManualPoints } from './presenter-socket-handlers-game.js?v=20260719190748';
import { registerPresenterReconnectionEvents } from './presenter-reconnection.js?v=20260719190748';
import { toggleFullscreen, saveOriginalLobbyHTML } from './presenter-utils.js?v=20260719190748';
import { abandonarJuego, concluirJuegoYVolver, terminarJuego } from './presenter-session-control.js?v=20260719190748';
import { startWaitingPanelSync, stopWaitingPanelSync } from './presenter-waiting-panel.js?v=20260719190748';
import { registerTrivialSocketHandlers } from './presenter-trivial-socket.js?v=20260719190748';

// Detect remote mode early (URL params available synchronously) to avoid registering
// full-presenter socket handlers that crash when their DOM elements don't exist.
const _remoteParams = new URLSearchParams(window.location.search);
const _isRemoteMode = _remoteParams.get('remote') === 'true' && Boolean(_remoteParams.get('pin'));

// Inicializar socket y registrar handlers
// IMPORTANT: Register reconnection handlers FIRST so reconnected-success/reconnect-failed
// are ready before registerPresenterReconnectionEvents() may emit reconnect-presenter
// immediately (if socket connected before this code runs).
initializePresenterSession();

if (window.XiroI18n && typeof window.XiroI18n.addSections === 'function') {
    // Presentador declares its own dictionary section from JS modules as requested.
    void window.XiroI18n.addSections(['presenter'], { reload: false });
}

if (!_isRemoteMode) {
    registerPresenterReconnectionEvents();
    registerLobbySocketHandlers();
    registerGameSocketHandlers();
    registerTrivialSocketHandlers();
    startWaitingPanelSync();
}

// Inicializar estado global
window.canShowRanking = false;
window.timerInterval = null;
window.timerPaused = false;
window.currentSeconds = 0;
window.isTrivialGame = false;

// Exponer funciones globales para que el HTML pueda accederlas
window.mostrarSelectorPIN = mostrarSelectorPIN;
window.cambiarFiltro = cambiarFiltro;
window.seleccionarPIN = seleccionarPIN;
window.volverAJuegos = volverAJuegos;
window.mostrarSeleccionModo = mostrarSeleccionModo;
window.configurarModoIndividual = configurarModoIndividual;
window.mostrarConfiguracionEquipos = mostrarConfiguracionEquipos;
window.seleccionarNumEquipos = seleccionarNumEquipos;
window.confirmarEquipos = confirmarEquipos;
window.updateColorOptions = updateColorOptions;
window.empezar = empezar;
window.toggleFullscreen = toggleFullscreen;
window.nextQuestionClick = nextQuestionClick;
window.togglePauseTimer = togglePauseTimer;
window.revealAnswerClick = revealAnswerClick;
window.assignManualPoints = assignManualPoints;
window.abandonarJuego = abandonarJuego;
window.concluirJuegoYVolver = concluirJuegoYVolver;
window.terminarJuego = terminarJuego;

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

function setupPresenterActionDelegation() {
    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-presenter-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.presenterAction;

        switch (action) {
            case 'toggle-fullscreen':
                toggleFullscreen();
                break;
            case 'start-game':
                empezar();
                break;
            case 'abandon-game':
                abandonarJuego();
                break;
            case 'terminate-game':
                terminarJuego();
                break;
            case 'reload-page':
                window.location.reload();
                break;
            case 'go-admin':
                window.location.href = '/admin.html';
                break;
            case 'reset-presenter-session':
                localStorage.removeItem('xiro_presenter_sessionId');
                localStorage.removeItem('xiro_presenter_pin');
                sessionStorage.removeItem('xiro_presenter_sessionId');
                sessionStorage.removeItem('xiro_presenter_pin');
                window.location.href = '/presentador.html';
                break;
            case 'volver-juegos':
                volverAJuegos();
                break;
            case 'change-filter':
                cambiarFiltro(actionElement.dataset.filter || 'todos');
                break;
            case 'select-pin':
                if (actionElement.dataset.pin) {
                    seleccionarPIN(actionElement.dataset.pin);
                }
                break;
            case 'select-individual-mode':
                if (actionElement.dataset.pin) {
                    configurarModoIndividual(actionElement.dataset.pin);
                }
                break;
            case 'show-team-config':
                if (actionElement.dataset.pin) {
                    mostrarConfiguracionEquipos(actionElement.dataset.pin);
                }
                break;
            case 'show-mode-selection':
                if (actionElement.dataset.pin) {
                    mostrarSeleccionModo(actionElement.dataset.pin);
                }
                break;
            case 'team-count': {
                const teamCount = toNumberOrNull(actionElement.dataset.numTeams);
                const pinValue = actionElement.dataset.pin;
                if (teamCount !== null && pinValue) {
                    seleccionarNumEquipos(teamCount, pinValue);
                }
                break;
            }
            case 'confirm-teams': {
                const teamCount = toNumberOrNull(actionElement.dataset.numTeams);
                const pinValue = actionElement.dataset.pin;
                if (teamCount !== null && pinValue) {
                    confirmarEquipos(teamCount, pinValue);
                }
                break;
            }
            case 'next-question':
                nextQuestionClick();
                break;
            case 'toggle-timer':
                togglePauseTimer();
                break;
            case 'reveal-answer':
                revealAnswerClick();
                break;
            case 'assign-points': {
                const targetName = decodeValue(actionElement.dataset.targetName);
                const points = toNumberOrNull(actionElement.dataset.points);
                const isTeam = actionElement.dataset.isTeam === 'true';
                if (targetName && points !== null) {
                    assignManualPoints(targetName, points, isTeam);
                }
                break;
            }
            case 'conclude-and-home':
                concluirJuegoYVolver();
                break;
            case 'close-overlay': {
                const overlayId = actionElement.dataset.overlayId;
                if (overlayId) {
                    const overlay = document.getElementById(overlayId);
                    if (overlay) overlay.remove();
                }
                break;
            }
            case 'expand-qr': {
                if (document.getElementById('qr-fullscreen-overlay')) break;
                const qrCanvas = document.getElementById('qr-canvas');
                if (!qrCanvas) break;
                const overlay = document.createElement('div');
                overlay.id = 'qr-fullscreen-overlay';
                overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
                const svgSrc = qrCanvas.querySelector('svg');
                if (svgSrc) {
                    const clone = svgSrc.cloneNode(true);
                    clone.style.cssText = 'height:100vh;width:auto;max-width:100vw;display:block;border-radius:1rem;';
                    overlay.appendChild(clone);
                } else {
                    const canvas = qrCanvas.querySelector('canvas');
                    if (canvas) {
                        const img = new Image();
                        img.src = canvas.toDataURL();
                        img.style.cssText = 'height:100vh;width:auto;max-width:100vw;border-radius:1rem;';
                        overlay.appendChild(img);
                    }
                }
                overlay.addEventListener('click', () => overlay.remove());
                document.body.appendChild(overlay);
                break;
            }
            default:
                break;
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

setupPresenterActionDelegation();

window.addEventListener('xiro:language-changed', () => {
    rerenderCurrentLobbyView();
});

// Lógica de inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    if (window.__presenterLoadingTimer) {
        window.clearTimeout(window.__presenterLoadingTimer);
        window.__presenterLoadingTimer = null;
    }

    const loading = document.getElementById('presenter-loading');
    if (loading) loading.remove();

    // CRÍTICO: Guardar el HTML original del lobby ANTES de hacer cualquier cosa
    saveOriginalLobbyHTML();

    const urlParams = new URLSearchParams(window.location.search);
    const reset = urlParams.get('reset');
    const pin = urlParams.get('pin');
    const sessionParam = urlParams.get('session');
    const mode = urlParams.get('mode');
    const remote = urlParams.get('remote');

    // Modo control remoto: activado por ?remote=true&pin=XXXX desde el panel de admin
    if (remote === 'true' && pin) {
        initRemoteControlMode(pin);
        return;
    }

    if (reset) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('reset');
        cleanUrl.searchParams.delete('session');
        cleanUrl.searchParams.delete('pin');
        cleanUrl.searchParams.delete('mode');
        cleanUrl.searchParams.delete('teams');
        window.history.replaceState({}, '', cleanUrl);
        mostrarSelectorPIN();
        return;
    }

    if (sessionParam) {
        // Verificar si initializePresenterSession() detectó URL compartida y limpió el storage
        const ssSessionId = sessionStorage.getItem('xiro_presenter_sessionId');
        const lsSessionId = localStorage.getItem('xiro_presenter_sessionId');

        if (!ssSessionId && !lsSessionId) {
            // URL compartida — no hay datos de sesión, no se puede reconectar
            console.log('⚠️ URL compartida — sin datos de sesión, mostrando selector de juegos');
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('session');
            window.history.replaceState({}, '', cleanUrl);
            mostrarSelectorPIN();
        } else {
            // Sesión en URL — reconnect-presenter ya fue emitido por presenter-reconnection.js
            // en el evento 'connect'. Si la reconexión falla, el handler mostrará error con retry.
            // NO llamar iniciarLobby() aquí para evitar crear una sesión duplicada.
            console.log('🔗 Sesión detectada en URL:', sessionParam, '— esperando resultado de reconexión');

            // a) Render visible "Reconectando..." loader spinner immediately
            const lobbyMain = document.getElementById('lobby-main');
            if (lobbyMain) {
                lobbyMain.style.display = 'flex';
                const reconnectingText = (window._t && window._t('presenter.reconnect.reconnecting', null, 'Reconectando...')) || 'Reconectando...';
                const pleaseWaitText = (window._t && window._t('presenter.reconnect.please_wait', null, 'Por favor, espera mientras restablecemos la conexión.')) || 'Por favor, espera mientras restablecemos la conexión.';
                lobbyMain.innerHTML = `
                    <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
                        <div class="w-20 h-20 border-8 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h1 class="text-4xl font-black text-white mb-4">${reconnectingText}</h1>
                        <p class="text-slate-400 text-xl text-center">${pleaseWaitText}</p>
                    </div>
                `;
            }

            // b) Add a 10s timeout
            if (window._xiroReconnectTimeout) {
                clearTimeout(window._xiroReconnectTimeout);
            }
            window._xiroReconnectTimeout = setTimeout(() => {
                console.warn('⌛ Timeout de 10s alcanzado esperando reconexión. Volviendo al selector.');
                
                localStorage.removeItem('xiro_presenter_sessionId');
                localStorage.removeItem('xiro_presenter_pin');
                sessionStorage.removeItem('xiro_presenter_sessionId');
                sessionStorage.removeItem('xiro_presenter_pin');
                
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('session');
                window.history.replaceState({}, '', cleanUrl);
                
                mostrarSelectorPIN();
            }, 10000);
        }
    } else if (pin && (mode === 'individual' || mode === 'teams')) {
        // PIN con modo ya seleccionado - ir directamente al lobby
        console.log('📌 PIN con modo detectado en URL:', pin, mode);

        // Actualizar estado global
        import('./presenter-state.js?v=20260719190748').then(module => {
            module.setPin(pin);
        });

        // Iniciar lobby directamente (ya se configuró el modo)
        iniciarLobby();
    } else if (pin) {
        // PIN en la URL SIN modo - mostrar selección de modo
        console.log('📌 PIN detectado en URL (sin modo):', pin);

        // Actualizar estado global
        import('./presenter-state.js?v=20260719190748').then(module => {
            module.setPin(pin);
        });

        // Validar PIN y mostrar selección de modo
        mostrarSeleccionModoDirecto(pin);
    } else {
        // Sin PIN - limpiar localStorage obsoleto y mostrar selector de juegos
        const savedSessionId = localStorage.getItem('xiro_presenter_sessionId');
        if (savedSessionId) {
            console.log('🧹 Limpiando sessionId obsoleto del storage:', savedSessionId);
            localStorage.removeItem('xiro_presenter_sessionId');
            localStorage.removeItem('xiro_presenter_pin');
            sessionStorage.removeItem('xiro_presenter_sessionId');
            sessionStorage.removeItem('xiro_presenter_pin');
        }

        console.log('📋 Sin PIN - Mostrando selector de juegos');
        mostrarSelectorPIN();
    }
});

// Listener para reajustar tamaño del texto cuando cambie tamaño de ventana
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (document.querySelectorAll('.option-text').length > 0) {
            import('./presenter-utils.js?v=20260719190748').then(module => {
                module.adjustTextSize();
            });
        }
    }, 150);
});

console.log('✅ Presentador inicializado correctamente');

window.addEventListener('beforeunload', () => {
    stopWaitingPanelSync();
});
