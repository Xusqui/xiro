// player-main.js
// Punto de entrada principal - importa todos los módulos y expone funciones globales

// ===== IMPORTS =====
import { redirectIfConcluded } from './player-game-concluded.js?v=20260922172926';
import './player-socket-config.js?v=20260922172926'; // Socket se inicializa automáticamente al importar
import { registerConnectionEvents, setupVisibilityDetection } from './player-connection.js?v=20260922172926';
import { registerSessionEvents, initSessionDetection, validarSession, unirseAlLobby } from './player-session.js?v=20260922172926';
import { registerTeamEvents, seleccionarEquipo, mostrarSeleccionEquipo } from './player-team.js?v=20260922172926';
import { registerAnswerEvents } from './player-answer-events.js?v=20260922172926';
import { enviarRespuesta, enviarOrdenRespuesta, enviarMatchingRespuesta, enviarRespuestaNumerica, enviarRespuestaWordScramble, enviarPendiente } from './player-answer.js?v=20260922172926';
import { enviarRespuestaWordSearch } from './player-answer-wordsearch.js?v=20260922172926';
import { registerResultsEvents } from './player-results.js?v=20260922172926';
import { registerGameFlowEvents, salirDelLobby } from './player-game-flow.js?v=20260922172926';
import { registerReconnectionEvents } from './player-reconnection.js?v=20260922172926';
import { registerTrivialPlayerSocketHandlers } from './player-trivial-socket.js?v=20260922172926';

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
window.enviarRespuestaWordSearch = enviarRespuestaWordSearch;
window.enviarPendiente = enviarPendiente;

// Game flow functions
window.salirDelLobby = salirDelLobby; // Ya expuesto en player-game-flow.js, pero lo reafirmamos

function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Llama a fn(número) si data-<datasetKey> es un número válido. */
function withNumber(datasetKey, fn) {
    return el => {
        const value = toNumberOrNull(el.dataset[datasetKey]);
        if (value !== null) fn(value);
    };
}

/** Llama a window[name] solo si otro módulo ya la ha expuesto. */
function callGlobal(name, ...args) {
    if (typeof window[name] === 'function') window[name](...args);
}

const PLAYER_CLICK_ACTIONS = {
    'validar-session': () => validarSession(),
    'validar-pin': () => validarSession(),
    'join-lobby': () => unirseAlLobby(),
    'reload-page': () => window.location.reload(),
    'salir-lobby': () => salirDelLobby(),
    'retry-pending': () => enviarPendiente(),
    'select-team': withNumber('teamIndex', seleccionarEquipo),
    'send-answer': withNumber('answerIndex', enviarRespuesta),
    'send-order': () => enviarOrdenRespuesta(false),
    'send-match': () => enviarMatchingRespuesta(false),
    'toggle-multiple': withNumber('answerIndex', i => callGlobal('toggleSeleccionMultiple', i)),
    'send-multiple': () => callGlobal('enviarRespuestaMultiple'),
    'trivial-roll': () => callGlobal('trivialRollDice'),
    'trivial-move': el => {
        if (el.dataset.position) callGlobal('trivialMove', el.dataset.position);
    },
    'trivial-category': withNumber('categoryIndex', i => callGlobal('trivialChooseCategoryPlayer', i))
};

function setupPlayerActionDelegation() {
    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-player-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.playerAction;
        if (Object.hasOwn(PLAYER_CLICK_ACTIONS, action)) PLAYER_CLICK_ACTIONS[action](actionElement);
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
    registerSessionEvents(mostrarSeleccionEquipo);
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
