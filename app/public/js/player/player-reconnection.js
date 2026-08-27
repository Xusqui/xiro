/**
 * @fileoverview Player Reconnection Handler
 * Handles server responses to reconnect-player:
 *  - reconnected-success → restore UI to current game/lobby state
 *  - reconnect-failed → show error and fallback
 *  - presenter-reconnected → inform player the host is back
 */

import { socket } from './player-socket-config.js?v=20260827184252';
import {
    setIsReconnecting, setNickname, setPin, setSessionId,
    setHaRespondido, setCanAnswer, setSelectedTeam, setTeamMode,
    getNickname, setPendingAnswer, setSendingAnswer, setStreakInfo
} from './player-state.js?v=20260827184252';
import { removeDisconnectOverlay, activarWakeLock } from './player-connection.js?v=20260827184252';
import { renderizarPregunta, renderizarPreguntaOrdena, renderizarSlideComentario, renderizarSlideInfo, renderizarSlideTexto, renderizarSlideImagen, renderizarPreguntaWordScramble, renderizarPreguntaMultipleChoice, renderizarPreguntaMatching } from './player-question-ui.js?v=20260827184252';
import { renderizarPreguntaNumerica } from './player-numeric-ui.js?v=20260827184252';
import { injectStreakBadge } from './player-streak-ui.js?v=20260827184252';
import { syncTrivialBadgesFromSnapshot } from './player-trivial-badges-ui.js?v=20260827184252';

/**
 * Restore player UI based on the snapshot sent by the server
 * after a successful reconnection.
 */
function handleReconnectedSuccess(snapshot) {
    console.log('✅ reconnected-success recibido:', snapshot);
    console.log('[RECONNECT DEBUG] ✅ reconnected-success procesado, estableciendo isReconnecting = false');
    console.log('[RECONNECT DEBUG] snapshot completo:', JSON.stringify(snapshot, null, 2));

    // Keep badges HUD in sync with snapshot state (trivial only).
    syncTrivialBadgesFromSnapshot(snapshot);

    removeDisconnectOverlay();
    setIsReconnecting(false);

    // CRITICAL: Clear any pending answer from before disconnect
    // The game state may have advanced, so old pendingAnswer is invalid
    setPendingAnswer(null);
    setSendingAnswer(false);
    console.log('[RECONNECT DEBUG] Cleared pendingAnswer and sendingAnswer');

    // Update core state from snapshot
    if (snapshot.nickname) setNickname(snapshot.nickname);
    if (snapshot.roomId) {
        if (snapshot.roomId.includes('-')) {
            setSessionId(snapshot.roomId);
            setPin(snapshot.roomId.split('-')[0]);
        } else {
            setPin(snapshot.roomId);
        }
    }

    // Team info
    if (snapshot.teamMode && snapshot.teamMode.isTeamMode) {
        setTeamMode(snapshot.teamMode);
        if (snapshot.playerTeam) {
            setSelectedTeam(snapshot.playerTeam.teamIndex);
        }
    }

    // Restaurar información de racha si existe
    if (snapshot.streakInfo) {
        setStreakInfo(snapshot.streakInfo);
        console.log('[RECONNECT DEBUG] Racha restaurada:', snapshot.streakInfo);
    }

    // Activate wake lock
    activarWakeLock();

    console.log('[RECONNECT DEBUG] Analizando gameState:', {
        hasGameState: !!snapshot.gameState,
        gameState: snapshot.gameState
    });

    // --- Decide which screen to show ---

    // Case 1: Game is in progress → show current question
    if (snapshot.gameState) {
        const gs = snapshot.gameState;
        const question = gs.currentQuestion;

        console.log('[RECONNECT DEBUG] Procesando gameState:', {
            hasCurrentQuestion: !!question,
            canAnswer: gs.canAnswer,
            currentQuestionIndex: gs.currentQuestionIndex,
            totalQuestions: gs.totalQuestions,
            question: question
        });

        if (!question) {
            console.log('[RECONNECT DEBUG] No hay pregunta actual → mostrando pantalla de espera');
            showWaitingScreen(snapshot.nickname, _t('player.reconnection.waiting_next', null, 'Esperando siguiente pregunta...'));
            return;
        }

        // Special case: Trivial board phase.
        // The server re-emits the exact board event (trivial-turn-changed /
        // trivial-dice-rolled / trivial-choose-category) right after reconnected-success.
        // Show a brief transition screen so the "ya has contestado" path is never reached.
        if (gs.isTrivialBoardPhase) {
            console.log('[RECONNECT DEBUG] Trivial board phase → waiting for board event from server');
            showWaitingScreen(snapshot.nickname, 'Restaurando tablero...');
            return;
        }

        // If canAnswer is explicitly false, player already answered
        // If canAnswer is null/undefined/true, allow player to answer (optimistic)
        if (gs.canAnswer === false) {
            // Player already answered or time expired — show waiting
            console.log('[RECONNECT DEBUG] canAnswer === false → jugador ya respondió');
            setHaRespondido(true);
            setCanAnswer(false);
            showWaitingForResults(snapshot.nickname, gs.currentQuestionIndex + 1, gs.totalQuestions);
        } else {
            // canAnswer is true, null, or undefined → show question (optimistic)
            console.log('[RECONNECT DEBUG] ✅ Renderizando pregunta (canAnswer =', gs.canAnswer, ')');
            renderQuestion(question);
        }
        return;
    }

    // Case 2: Still in lobby — show lobby screen
    console.log('[RECONNECT DEBUG] No hay gameState → mostrando lobby reconectado');
    showLobbyReconnected(snapshot.nickname);
}

/**
 * Handle failed reconnection from the server.
 */
function handleReconnectFailed(data) {
    console.warn('❌ reconnect-failed recibido:', data);
    console.log('[RECONNECT DEBUG] ❌ reconnect-failed procesado, estableciendo isReconnecting = false');

    setIsReconnecting(false);

    const reason = data.reason || 'unknown';
    const message = data.message || 'No se pudo reconectar.';

    // Session expired or not found → clean up and show error
    if (reason === 'not-found' || reason === 'invalid-state' || reason === 'expired') {
        localStorage.removeItem('xiro_lastPin');
        localStorage.removeItem('xiro_lastNickname');
        localStorage.removeItem('xiro_lastSessionId');
        localStorage.removeItem('xiro_lastTeamIndex');
        localStorage.removeItem('xiro_lastTeamName');
    }

    const mainContainer = document.getElementById('main-container') || document.body;
    mainContainer.innerHTML = _tHtml(`
        <div class="text-center p-8">
            <i class="fas fa-exclamation-triangle text-6xl text-red-400 mb-6"></i>
            <h2 class="text-3xl font-black italic mb-4 text-white">NO SE PUDO RECONECTAR</h2>
            <p class="text-xl text-white/80 mb-6">${message}</p>
            <button data-player-action="reload-page"
                class="bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-2xl text-white font-black text-xl transition shadow-lg">
                <i class="fas fa-redo mr-2"></i>REINTENTAR
            </button>
        </div>
    `);
}

/**
 * Handle presenter-reconnected broadcast (host came back).
 */
function handlePresenterReconnected(data) {
    console.log('📢 Presentador reconectado:', data.message);
    removeDisconnectOverlay();
}

// ===== UI HELPERS =====

function renderQuestion(question) {
    if (question.slide_type === 'comment') {
        renderizarSlideComentario(question);
    } else if (question.slide_type === 'info') {
        renderizarSlideInfo(question);
    } else if (question.slide_type === 'text') {
        renderizarSlideTexto(question);
    } else if (question.slide_type === 'image') {
        renderizarSlideImagen(question);
    } else if (question.question_type === 'order') {
        renderizarPreguntaOrdena(question);
    } else if (question.question_type === 'matching') {
        renderizarPreguntaMatching(question);
    } else if (question.question_type === 'numeric_approximation') {
        renderizarPreguntaNumerica(question);
    } else if (question.question_type === 'word_scramble') {
        renderizarPreguntaWordScramble(question);
    } else if (question.question_type === 'multiple_choice') {
        renderizarPreguntaMultipleChoice(question);
    } else {
        renderizarPregunta(question);
    }

    // Asegurar que el badge de racha se muestre si el jugador tiene racha activa
    injectStreakBadge();
}

function showWaitingForResults(nickname, currentQ, totalQ) {
    const display = (nickname || '').toUpperCase();
    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-700 via-purple-600 to-pink-600 text-white text-center p-8">
            <div class="bg-purple-600 px-6 py-3 rounded-full mb-6 shadow-2xl">
                <p class="font-black text-xl uppercase">${display}</p>
            </div>
            <i class="fas fa-check-circle text-6xl text-green-400 mb-6 animate-pulse"></i>
            <h2 class="text-3xl font-black italic mb-4">${_t('player.reconnection.already_answered_title', null, 'YA HAS RESPONDIDO')}</h2>
            <p class="text-xl text-white/80">${_t('player.reconnection.question_progress', { current: currentQ, total: totalQ }, `Pregunta ${currentQ} de ${totalQ}`)}</p>
            <p class="text-lg text-white/60 mt-4">${_t('player.answer.waiting_results', null, 'Esperando resultados...')}</p>
        </div>
    `);

    // Asegurar que el badge de racha se muestre si el jugador tiene racha activa
    injectStreakBadge();
}

function showWaitingScreen(nickname, message) {
    const display = (nickname || '').toUpperCase();
    document.body.innerHTML = _tHtml(`
        <div class="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-700 via-purple-600 to-pink-600 text-white text-center p-8">
            <div class="bg-purple-600 px-6 py-3 rounded-full mb-6 shadow-2xl">
                <p class="font-black text-xl uppercase">${display}</p>
            </div>
            <div class="w-16 h-16 border-8 border-white border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 class="text-2xl font-black italic mb-2">RECONECTADO</h2>
            <p class="text-lg text-white/80">${message}</p>
        </div>
    `);

    // Asegurar que el badge de racha se muestre si el jugador tiene racha activa
    injectStreakBadge();
}

function showLobbyReconnected(nickname) {
    const display = (nickname || '').toUpperCase();
    const container = document.getElementById('main-container') || document.body;
    container.innerHTML = _tHtml(`
        <div class="lobby-container text-center">
            <div class="text-green-400 text-6xl mb-4"><i class="fas fa-check-circle"></i></div>
            <h2 class="text-3xl font-black italic text-white mb-4">¡RECONECTADO!</h2>
            <p class="text-2xl font-bold text-white mb-2">${display}</p>
            <p class="text-lg text-white/80 mb-6">${_t('player.team.waiting_start', null, 'Esperando a que el presentador inicie el juego...')}</p>
            <button data-player-action="salir-lobby" class="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-2xl text-white font-bold transition">
                🚪 SALIR DEL JUEGO
            </button>
        </div>
    `);
}

// ===== REGISTRATION =====

/**
 * Register all reconnection-related socket listeners.
 * Called once from player-main.js at boot.
 */
export function registerReconnectionEvents() {
    socket.on('reconnected-success', handleReconnectedSuccess);
    socket.on('reconnect-failed', handleReconnectFailed);
    socket.on('presenter-reconnected', handlePresenterReconnected);

    console.log('✅ Eventos de reconexión del jugador registrados');
}
