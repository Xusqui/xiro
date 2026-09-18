// player-main.js
// Punto de entrada principal - importa todos los módulos y expone funciones globales

// ===== IMPORTS =====
import { redirectIfConcluded } from './player-game-concluded.js?v=20260918181418';
import './player-socket-config.js?v=20260918181418'; // Socket se inicializa automáticamente al importar
import { registerConnectionEvents, setupVisibilityDetection } from './player-connection.js?v=20260918181418';
import { registerSessionEvents, initSessionDetection, validarSession, unirseAlLobby } from './player-session.js?v=20260918181418';
import { registerTeamEvents, seleccionarEquipo, mostrarSeleccionEquipo } from './player-team.js?v=20260918181418';
import { registerAnswerEvents, enviarRespuesta, enviarOrdenRespuesta, enviarMatchingRespuesta, enviarRespuestaNumerica, enviarRespuestaWordScramble, enviarPendiente } from './player-answer.js?v=20260918181418';
import { registerResultsEvents } from './player-results.js?v=20260918181418';
import { registerGameFlowEvents, salirDelLobby } from './player-game-flow.js?v=20260918181418';
import { registerReconnectionEvents } from './player-reconnection.js?v=20260918181418';
import { registerTrivialPlayerSocketHandlers } from './player-trivial-socket.js?v=20260918181418';

if (window.XiroI18n && typeof window.XiroI18n.addSections === 'function') {
    void window.XiroI18n.addSections(['player'], { reload: false });
}

// ===== EXPOSICIÓN DE FUNCIONES GLOBALES (compatibilidad legacy) =====

// Session functions
window.validarPIN = validarSession; // Alias legacy (se llama validarPIN pero usa validarSession)
window.validarSession = validarSession;
window.unirseAlLobby = unirseAlLobby;

// Team functions
window.seleccionarEquipo = seleccionarEquipo;

// Answer functions
window.enviarRespuesta = enviarRespuesta;
window.enviarOrdenRespuesta = enviarOrdenRespuesta;
window.enviarMatchingRespuesta = enviarMatchingRespuesta;
window.enviarRespuestaNumerica = enviarRespuestaNumerica;
window.enviarRespuestaWordScramble = enviarRespuestaWordScramble;
window.enviarPendiente = enviarPendiente;

// Game flow functions
window.salirDelLobby = salirDelLobby; // Ya expuesto en player-game-flow.js, pero lo reafirmamos

function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function setupPlayerActionDelegation() {
    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-player-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.playerAction;
        switch (action) {
            case 'validar-session':
            case 'validar-pin':
                validarSession();
                break;
            case 'join-lobby':
                unirseAlLobby();
                break;
            case 'reload-page':
                window.location.reload();
                break;
            case 'salir-lobby':
                salirDelLobby();
                break;
            case 'retry-pending':
                enviarPendiente();
                break;
            case 'select-team': {
                const teamIndex = toNumberOrNull(actionElement.dataset.teamIndex);
                if (teamIndex !== null) {
                    seleccionarEquipo(teamIndex);
                }
                break;
            }
            case 'send-answer': {
                const answerIndex = toNumberOrNull(actionElement.dataset.answerIndex);
                if (answerIndex !== null) {
                    enviarRespuesta(answerIndex);
                }
                break;
            }
            case 'send-order':
                enviarOrdenRespuesta(false);
                break;
            case 'send-match':
                enviarMatchingRespuesta(false);
                break;
            case 'toggle-multiple': {
                const answerIndex = toNumberOrNull(actionElement.dataset.answerIndex);
                if (answerIndex !== null && typeof window.toggleSeleccionMultiple === 'function') {
                    window.toggleSeleccionMultiple(answerIndex);
                }
                break;
            }
            case 'send-multiple':
                if (typeof window.enviarRespuestaMultiple === 'function') {
                    window.enviarRespuestaMultiple();
                }
                break;
            case 'trivial-roll':
                if (typeof window.trivialRollDice === 'function') {
                    window.trivialRollDice();
                }
                break;
            case 'trivial-move': {
                const { position } = actionElement.dataset;
                if (position && typeof window.trivialMove === 'function') {
                    window.trivialMove(position);
                }
                break;
            }
            case 'trivial-category': {
                const categoryIndex = toNumberOrNull(actionElement.dataset.categoryIndex);
                if (categoryIndex !== null && typeof window.trivialChooseCategoryPlayer === 'function') {
                    window.trivialChooseCategoryPlayer(categoryIndex);
                }
                break;
            }
            default:
                break;
        }
    });
}

setupPlayerActionDelegation();

// ===== EVENT LISTENER: ENTER KEY SUBMIT =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const step1 = document.getElementById('step-1');
        const step2 = document.getElementById('step-2');

        if (step1 && !step1.classList.contains('hidden')) {
            // Si estamos en el paso 1 (ingreso de PIN), validar PIN
            validarSession();
        } else if (step2 && !step2.classList.contains('hidden')) {
            // Si estamos en el paso 2 (ingreso de nombre), unirse al lobby
            unirseAlLobby();
        }
    }
});

// ===== INICIALIZACIÓN AL CARGAR LA PÁGINA =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Aplicación del jugador iniciada');
    console.log('[RECONNECT DEBUG] DOMContentLoaded disparado, registrando event handlers');

    if (redirectIfConcluded()) {
        return;
    }

    // Registrar todos los event listeners de Socket.IO
    // IMPORTANT: Register reconnection response handlers FIRST so they are ready
    // before registerConnectionEvents() may emit reconnect-player immediately
    // (if socket connected before DOMContentLoaded).
    console.log('[RECONNECT DEBUG] 1. Registrando reconnection events');
    registerReconnectionEvents();
    console.log('[RECONNECT DEBUG] 2. Registrando connection events');
    registerConnectionEvents();
    registerSessionEvents(mostrarSeleccionEquipo, salirDelLobby);
    registerTeamEvents();
    registerAnswerEvents();
    registerResultsEvents();
    registerGameFlowEvents();
    registerTrivialPlayerSocketHandlers();

    // Activar detección de visibilidad (wake lock + reconnect on resume)
    setupVisibilityDetection();

    // Detectar y validar sesión desde URL o localStorage
    console.log('[RECONNECT DEBUG] 7. Llamando a initSessionDetection()');
    initSessionDetection();

    console.log('✅ Todos los módulos del jugador cargados correctamente');
    console.log('[RECONNECT DEBUG] Inicialización completa');
});
