/**
 * @fileoverview Presenter Reconnection Handler
 * Handles server responses after reconnect-presenter:
 *  - reconnected-success → restores game or lobby UI
 *  - reconnect-failed → shows error with retry
 * Also emits reconnect-presenter on Socket.IO auto-reconnect.
 */

import { socket, presenterPlayerId } from './presenter-socket-config.js?v=20260822074303';
import {
    setSessionId, setPin, setCurrentQuestionIndex, setTotalQuestions,
    setPlayersData, setConnectedPlayers, setTotalPlayers,
    setIsTeamMode, setTeamConfig, getIsTeamMode, getTeamConfig
} from './presenter-state.js?v=20260822074303';
import {
    renderPregunta, renderCommentSlide, renderInfoSlide, renderTextSlide, renderImageSlide, renderTextImageSlide,
    updatePlayersPanel, renderTeamLobby, mostrarQR
} from './presenter-game-ui.js?v=20260822074303';
import { restoreLobbyHTML, showAbandonButton } from './presenter-utils.js?v=20260822074303';
import { handleGameAbandoned } from './presenter-session-control.js?v=20260822074303';

function getStoredSessionId() {
    return sessionStorage.getItem('xiro_presenter_sessionId')
        || localStorage.getItem('xiro_presenter_sessionId')
        || '';
}

function getSessionIdFromUrl() {
    return new URLSearchParams(window.location.search).get('session')?.toUpperCase() || '';
}

function buildFallbackJoinLobbyPayload() {
    const sessionId = getSessionIdFromUrl() || getStoredSessionId();
    if (!sessionId || !/^[A-Z0-9]{4,10}-\d{4}$/.test(sessionId)) {
        return null;
    }

    const pin = sessionId.split('-')[0];
    const payload = {
        pin,
        sessionId,
        playerId: presenterPlayerId,
        isTeamMode: !!getIsTeamMode()
    };

    const token = localStorage.getItem('adminToken') || '';
    if (token) {
        payload.token = token;
    }

    const sessionSecret = sessionStorage.getItem('xiro_presenter_sessionSecret')
        || localStorage.getItem('xiro_presenter_sessionSecret');
    if (sessionSecret) {
        payload.sessionSecret = sessionSecret;
    }

    const teamConfig = getTeamConfig();
    if (teamConfig) {
        payload.teamConfig = teamConfig;
    }

    return payload;
}

function tryFallbackJoinPresenterLobby(data) {
    if (data?.reason !== 'not-found') {
        return false;
    }

    if (window._xiroReconnectJoinFallbackTried) {
        return false;
    }

    const payload = buildFallbackJoinLobbyPayload();
    if (!payload) {
        return false;
    }

    window._xiroReconnectJoinFallbackTried = true;
    window._xiroFreshJoinPending = true;
    window._xiroPendingLobbyData = payload;

    console.warn('♻️ reconnect-presenter not-found; intentando fallback con join-presenter-lobby', {
        sessionId: payload.sessionId,
        pin: payload.pin
    });

    socket.emit('join-presenter-lobby', payload);

    setTimeout(() => {
        window._xiroFreshJoinPending = false;
    }, 2000);

    return true;
}

/**
 * Restore presenter UI from the snapshot sent by the server.
 */
function handleReconnectedSuccess(snapshot) {
    console.log('✅ Presenter reconnected-success:', snapshot);

    if (window._xiroReconnectTimeout) {
        clearTimeout(window._xiroReconnectTimeout);
        window._xiroReconnectTimeout = null;
    }

    // Remove reconnection overlay
    const overlay = document.getElementById('presenter-reconnect-overlay');
    if (overlay) overlay.remove();

    // Sync core state
    if (snapshot.sessionId) setSessionId(snapshot.sessionId);
    if (snapshot.pin) setPin(snapshot.pin);

    // Team mode
    if (snapshot.teamMode && snapshot.teamMode.isTeamMode) {
        setIsTeamMode(true);
        setTeamConfig(snapshot.teamMode);
    }

    // Rebuild players data if available
    if (snapshot.gameState && snapshot.gameState.scores) {
        rebuildPlayersData(snapshot.gameState.players, snapshot.gameState.scores);
    } else if (snapshot.lobbyPlayers) {
        rebuildPlayersFromLobby(snapshot.lobbyPlayers);
    }

    // --- Decide which screen to restore ---

    if (snapshot.gameState && snapshot.gameState.isGameActive) {
        restoreGameScreen(snapshot);
    } else {
        restoreLobbyScreen(snapshot);
    }
}

/**
 * Handle failed reconnection.
 */
function handleReconnectFailed(data) {
    console.warn('❌ Presenter reconnect-failed:', data);

    const currentSession = getSessionIdFromUrl() || getStoredSessionId();
    if (window._xiroFreshJoinPending || (data && data.sessionId && data.sessionId !== currentSession)) {
        console.log('⚠️ Ignoring reconnect-failed for non-matching or pending session:', {
            attempted: data?.sessionId,
            current: currentSession,
            freshJoinPending: window._xiroFreshJoinPending
        });
        return;
    }

    if (window._xiroReconnectTimeout) {
        clearTimeout(window._xiroReconnectTimeout);
        window._xiroReconnectTimeout = null;
    }

    if (tryFallbackJoinPresenterLobby(data)) {
        return;
    }

    const overlay = document.getElementById('presenter-reconnect-overlay');
    if (overlay) overlay.remove();

    const msg = data.message || 'No se pudo reconectar.';
    const lobbyMain = document.getElementById('lobby-main');
    if (lobbyMain) {
        lobbyMain.style.display = 'flex';
        lobbyMain.innerHTML = _tHtml(`
            <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
                <i class="fas fa-exclamation-triangle text-red-500 text-8xl mb-6"></i>
                <h1 class="text-4xl font-black text-white mb-4">Error de Reconexión</h1>
                <p class="text-slate-400 mb-6 text-xl">${msg}</p>
                <div class="flex gap-4">
                    <button data-presenter-action="reload-page"
                        class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full text-white font-bold uppercase transition shadow-lg">
                        <i class="fas fa-redo mr-2"></i>Reintentar
                    </button>
                    <button data-presenter-action="reset-presenter-session"
                        class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-full text-white font-bold uppercase transition">
                        <i class="fas fa-plus mr-2"></i>Nuevo Juego
                    </button>
                </div>
            </div>
        `);
        showAbandonButton();
    }

    // Clean stale storage
    localStorage.removeItem('xiro_presenter_sessionId');
    localStorage.removeItem('xiro_presenter_pin');
    sessionStorage.removeItem('xiro_presenter_sessionId');
    sessionStorage.removeItem('xiro_presenter_pin');
}

// ===== UI RESTORATION =====

function restoreGameScreen(snapshot) {
    const gs = snapshot.gameState;
    setCurrentQuestionIndex(gs.currentQuestionIndex || 0);
    setTotalQuestions(gs.totalQuestions || 0);

    const question = gs.currentQuestion;
    if (!question) {
        // No current question — probably between questions
        const lobbyMain = document.getElementById('lobby-main');
        if (lobbyMain) {
            lobbyMain.style.display = 'flex';
            lobbyMain.innerHTML = _tHtml(`
                <div class="h-full w-full flex flex-col items-center justify-center pt-10 px-10 pb-16">
                    <div class="w-20 h-20 border-8 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h1 class="text-4xl font-black text-white mb-4">Reconectado</h1>
                    <p class="text-slate-400 text-xl">Esperando siguiente pregunta...</p>
                </div>
            `);
            showAbandonButton();
        }
        return;
    }

    // Render the current question/slide
    if (question.slide_type === 'comment') {
        renderCommentSlide(question);
    } else if (question.slide_type === 'info') {
        renderInfoSlide(question);
    } else if (question.slide_type === 'text') {
        renderTextSlide(question);
    } else if (question.slide_type === 'image') {
        renderImageSlide(question);
    } else if (question.slide_type === 'text-image') {
        renderTextImageSlide(question);
    } else {
        window.canShowRanking = true;
        renderPregunta(question);
    }

    updatePlayersPanel();
}

function restoreLobbyScreen(snapshot) {
    restoreLobbyHTML();

    const lobbyMain = document.getElementById('lobby-main');
    if (lobbyMain) lobbyMain.style.display = 'flex';

    // Show QR and PIN
    const displayPin = document.getElementById('display-pin');
    if (displayPin && snapshot.sessionId) {
        displayPin.innerText = _t(snapshot.sessionId);
    }
    if (snapshot.sessionId) {
        mostrarQR(snapshot.sessionId);
    }

    // Rebuild player cards in lobby
    const pCount = document.getElementById('p-count');
    const players = snapshot.lobbyPlayers || [];
    const nonHostPlayers = players.filter(p => p !== 'HOST');

    if (pCount) pCount.innerText = _t(nonHostPlayers.length);
    setTotalPlayers(nonHostPlayers.length);

    if (getIsTeamMode() && getTeamConfig()) {
        renderTeamLobby();
    } else {
        const pList = document.getElementById('p-list');
        if (pList) {
            pList.innerHTML = _tHtml('');
            nonHostPlayers.forEach(nick => {
                const div = document.createElement('div');
                div.className = 'bg-white text-slate-900 p-3 rounded-xl font-black text-center uppercase italic text-sm';
                div.setAttribute('data-nickname', nick);
                div.textContent = _t(nick);
                pList.appendChild(div);
            });
        }
    }

    // Enable start button if players present
    const btn = document.getElementById('btn-empezar');
    if (btn) {
        btn.disabled = nonHostPlayers.length === 0;
        btn.style.opacity = nonHostPlayers.length === 0 ? '0.5' : '';
        btn.style.cursor = nonHostPlayers.length === 0 ? 'not-allowed' : '';
    }

    updatePlayersPanel();
}

// ===== HELPERS =====

function rebuildPlayersData(playerList, scores) {
    const pd = {};
    (playerList || []).forEach(nick => {
        if (nick === 'HOST') return;
        pd[nick] = { score: scores[nick] || 0, answered: false, correct: null };
    });
    setPlayersData(pd);
    setConnectedPlayers((playerList || []).filter(n => n !== 'HOST'));
    setTotalPlayers(Object.keys(pd).length);
}

function rebuildPlayersFromLobby(lobbyList) {
    const pd = {};
    const nonHost = (lobbyList || []).filter(n => n !== 'HOST');
    nonHost.forEach(nick => {
        pd[nick] = { score: 0, answered: false, correct: null };
    });
    setPlayersData(pd);
    setConnectedPlayers(nonHost);
    setTotalPlayers(nonHost.length);
}

// ===== REGISTRATION =====

/**
 * Register presenter reconnection socket events.
 * Also hooks into Socket.IO manager's reconnect event to emit
 * the game-level reconnect-presenter event.
 */
export function registerPresenterReconnectionEvents() {
    // Handle server responses
    socket.on('reconnected-success', handleReconnectedSuccess);
    socket.on('reconnect-failed', handleReconnectFailed);
    socket.on('game-abandoned', (data) => {
        handleGameAbandoned(data);
    });

    // On connect (works for BOTH fresh connects and Socket.IO auto-reconnects).
    // Socket.IO fires 'connect' on every successful connection, including auto-reconnects,
    // so a separate socket.io.on('reconnect') handler is NOT needed and would cause
    // double emission of reconnect-presenter.
    const handleConnect = () => {
        // Si hay un join-presenter-lobby fresco pendiente (iniciarLobby en curso),
        // reintentar el join en lugar de emitir reconnect-presenter. Esto cubre el caso
        // donde el socket se cayó entre el emit del join y la recepción del join-success.
        if (window._xiroFreshJoinPending) {
            if (window._xiroPendingLobbyData) {
                console.log('ℹ️  handleConnect: join-presenter-lobby pendiente — reintentando al reconectar');
                socket.emit('join-presenter-lobby', window._xiroPendingLobbyData);
            } else {
                console.log('ℹ️  handleConnect: fresh join-lobby pending (sin lobbyData), esperando');
            }
            return;
        }

        const urlSession = new URLSearchParams(window.location.search).get('session');
        // Comprobar en AMBOS storages — sessionStorage es primario, localStorage secundario
        const ssSessionId = sessionStorage.getItem('xiro_presenter_sessionId');
        const lsSessionId = localStorage.getItem('xiro_presenter_sessionId');
        const hasSession = ssSessionId || lsSessionId;
        const matchingSession = urlSession && hasSession && hasSession === urlSession;

        // presenterPlayerId es la constante del módulo — siempre disponible
        // (recuperada de sessionStorage por getOrCreatePresenterPlayerId)
        if (matchingSession && presenterPlayerId) {
            const token = localStorage.getItem('adminToken') || '';
            console.log('🔄 Sesión de presentador detectada on connect — emitting reconnect-presenter');
            console.log('   urlSession:', urlSession, '| storageSession:', hasSession, '| playerId:', presenterPlayerId);
            console.log('   adminToken present:', !!token, '| length:', token.length);
            if (!token) {
                console.warn('⚠️ adminToken is EMPTY — server will reject with invalid-token');
            }
            socket.emit('reconnect-presenter', {
                playerId: presenterPlayerId,
                token,
                sessionId: hasSession
            });
        } else {
            console.log('ℹ️  handleConnect: no reconnect attempt', {
                hasUrlSession: !!urlSession,
                hasStorageSession: !!hasSession,
                hasMatchingSession: !!matchingSession,
                hasPlayerId: !!presenterPlayerId
            });
        }
    };

    socket.on('connect', handleConnect);

    // FIX: If socket already connected before handlers were registered,
    // trigger the handler manually to avoid missing the connect event.
    if (socket.connected) {
        console.log('⚡ Socket ya conectado antes de registrar handlers — ejecutando handleConnect manualmente');
        handleConnect();
    }

    console.log('✅ Eventos de reconexión del presentador registrados');
}
