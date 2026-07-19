// player-game-flow.js
// Manejo del flujo del juego: inicio, nuevas preguntas, reinicio del servidor, salida del lobby

import { getSocket, getPlayerId } from './player-socket-config.js?v=20260719190748';
import {
    getPin, getNickname, getSessionId,
    setPin, setNickname, setSessionId,
    setHaRespondido, setResultReceived,
    setPendingAnswer, setSendingAnswer,
    getWakeLock, setWakeLock,
    resetSessionState
} from './player-state.js?v=20260719190748';
import { renderizarPregunta, renderizarPreguntaOrdena, renderizarPreguntaMatching, renderizarPreguntaNumerica, renderizarPreguntaWordScramble, renderizarPreguntaMultipleChoice } from './player-question-ui.js?v=20260719190748';
import { renderizarSlideComentario, renderizarSlideInfo, renderizarSlideTexto, renderizarSlideImagen, renderizarSlideTextoImagen } from './player-question-ui.js?v=20260719190748';
import { removeDisconnectOverlay } from './player-connection.js?v=20260719190748';
import { mostrarModalConfirmacion, mostrarModalMensaje } from '../shared/modal.js?v=20260719190748';
import { markGameConcluded } from './player-game-concluded.js?v=20260719190748';
import { injectStreakBadge, cancelStreakAnimation } from './player-streak-ui.js?v=20260719190748';
import { preloadGameImages } from './player-image-preloader.js?v=20260719190748';

/**
 * Salir del lobby y liberar credenciales
 */
export function salirDelLobby() {
    mostrarModalConfirmacion(
        _t('player.game_flow.exit_title', null, 'Salir del juego'),
        _t('player.game_flow.exit_msg', null, '¿Seguro que quieres salir del juego? Tu nombre de usuario será liberado.'),
        () => {
            console.log('🚪 Saliendo del lobby...');

            const socket = getSocket();
            const playerId = getPlayerId();

            // Emitir evento al servidor
            socket.emit('leave-lobby', {
                pin: getPin(),
                nickname: getNickname(),
                playerId: playerId
            });

            // Limpiar localStorage
            localStorage.removeItem('xiro_lastPin');
            localStorage.removeItem('xiro_lastNickname');
            localStorage.removeItem('xiro_lastSessionId');
            localStorage.removeItem('xiro_lastTeamIndex');
            localStorage.removeItem('xiro_lastTeamName');

            // Liberar Wake Lock si está activo
            const wakeLock = getWakeLock();
            if (wakeLock !== null) {
                wakeLock.release().then(() => {
                    console.log('🔋 Wake Lock liberado');
                    setWakeLock(null);
                });
            }

            // Resetear variables globales
            setPin("");
            setSessionId("");
            setNickname("");

            // Volver a la pantalla inicial
            location.reload();
        },
        null,
        _t('player.game_flow.btn_exit', null, 'Salir'),
        _t('player.game_flow.btn_cancel', null, 'Cancelar')
    );
}

/**
 * Evento: game-started (inicio del juego)
 */
function onGameStarted(data, ack) {
    console.log('🎮 [EVENT] game-started:', data);

    // Eliminar overlay de desconexión si existe
    removeDisconnectOverlay();

    // Cancelar cualquier animación de racha activa (por si acaso)
    cancelStreakAnimation();

    // Limpiar estado pendiente por seguridad
    setPendingAnswer(null);
    setSendingAnswer(false);

    // Precargar imágenes de slides con jitter para evitar burst de N peticiones
    preloadGameImages(data.imagePreloads);

    if (data.firstQuestion.slide_type === 'comment') {
        renderizarSlideComentario(data.firstQuestion);
    } else if (data.firstQuestion.slide_type === 'info') {
        renderizarSlideInfo(data.firstQuestion);
    } else if (data.firstQuestion.slide_type === 'text') {
        renderizarSlideTexto(data.firstQuestion);
    } else if (data.firstQuestion.slide_type === 'image') {
        renderizarSlideImagen(data.firstQuestion);
    } else if (data.firstQuestion.slide_type === 'text-image') {
        renderizarSlideTextoImagen(data.firstQuestion);
    } else if (data.firstQuestion.question_type === 'order') {
        renderizarPreguntaOrdena(data.firstQuestion);
    } else if (data.firstQuestion.question_type === 'matching') {
        renderizarPreguntaMatching(data.firstQuestion);
    } else if (data.firstQuestion.question_type === 'numeric_approximation') {
        renderizarPreguntaNumerica(data.firstQuestion);
    } else if (data.firstQuestion.question_type === 'word_scramble') {
        renderizarPreguntaWordScramble(data.firstQuestion);
    } else if (data.firstQuestion.question_type === 'multiple_choice') {
        renderizarPreguntaMultipleChoice(data.firstQuestion);
    } else {
        renderizarPregunta(data.firstQuestion);
    }

    injectStreakBadge();

    // Confirmar recepción al backend
    if (typeof ack === 'function') ack();
}

/**
 * Evento: new-question (nueva pregunta)
 */
function onNewQuestion(data, ack) {
    console.log('❓ [EVENT] new-question:', data);

    // Cancelar cualquier animación de racha activa ANTES de renderizar
    // (evita que la pregunta no se muestre si el presentador avanzó rápido)
    cancelStreakAnimation();

    // Reset estado para nueva pregunta
    setHaRespondido(false);
    setResultReceived(false);
    setPendingAnswer(null);
    setSendingAnswer(false);

    // Eliminar overlay de desconexión si existe
    removeDisconnectOverlay();

    if (data.question.slide_type === 'comment') {
        renderizarSlideComentario(data.question);
    } else if (data.question.slide_type === 'info') {
        renderizarSlideInfo(data.question);
    } else if (data.question.slide_type === 'text') {
        renderizarSlideTexto(data.question);
    } else if (data.question.slide_type === 'image') {
        renderizarSlideImagen(data.question);
    } else if (data.question.slide_type === 'text-image') {
        renderizarSlideTextoImagen(data.question);
    } else if (data.question.question_type === 'order') {
        renderizarPreguntaOrdena(data.question);
    } else if (data.question.question_type === 'matching') {
        renderizarPreguntaMatching(data.question);
    } else if (data.question.question_type === 'numeric_approximation') {
        renderizarPreguntaNumerica(data.question);
    } else if (data.question.question_type === 'word_scramble') {
        renderizarPreguntaWordScramble(data.question);
    } else if (data.question.question_type === 'multiple_choice') {
        renderizarPreguntaMultipleChoice(data.question);
    } else {
        renderizarPregunta(data.question);
    }

    injectStreakBadge();

    // Confirmar recepción al backend
    if (typeof ack === 'function') ack();
}

/**
 * Evento: server-restarting (servidor reiniciando)
 */
function onServerRestarting(data) {
    console.log('🔄 Servidor reiniciando:', data);

    document.body.innerHTML = _tHtml(`
        <div class="server-restarting-screen">
            <div class="mb-6">
                <div class="server-restart-spinner"></div>
                <i class="fas fa-server text-6xl mb-4 animate-pulse"></i>
            </div>
            <h2 class="text-3xl font-black uppercase italic mb-4">Servidor Reiniciando</h2>
            <p class="text-xl font-semibold text-white/90 mb-6">${data.message || 'Reconectando automáticamente...'}</p>
            <div class="server-restart-info">
                <p class="text-sm text-white/80">No cierres esta ventana. La partida continuará automáticamente.</p>
            </div>
        </div>
    `);

    // Socket.io intentará reconectar automáticamente
    // El listener 'reconnect' se encargará de restaurar la sesión
}

/**
 * Evento: game-abandoned (presentador abandono la sesion)
 */
function onGameAbandoned(data) {
    console.log('🚪 Sesion abandonada por el presentador:', data);

    localStorage.removeItem('xiro_lastPin');
    localStorage.removeItem('xiro_lastNickname');
    localStorage.removeItem('xiro_lastSessionId');
    localStorage.removeItem('xiro_lastTeamIndex');
    localStorage.removeItem('xiro_lastTeamName');

    resetSessionState();

    if (data?.reason === 'concluded') {
        markGameConcluded();
        window.location.href = '/juego-concluido.html';
        return;
    }

    let _redirected = false;
    const _doRedirect = () => {
        if (!_redirected) {
            _redirected = true;
            window.location.href = '/juego-finalizado-presentador.html';
        }
    };

    setTimeout(_doRedirect, 3000);

    mostrarModalMensaje(
        _t('player.game_flow.session_ended', null, 'Sesión finalizada'),
        _t('player.game_flow.presenter_left', null, 'El presentador ha abandonado la sesión.'),
        'info',
        _t('player.game_flow.btn_back', null, 'Volver'),
        _doRedirect
    );
}

/**
 * Registrar todos los eventos de flujo del juego
 */
export function registerGameFlowEvents() {
    const socket = getSocket();

    socket.on('game-started', onGameStarted);
    socket.on('new-question', onNewQuestion);
    socket.on('server-restarting', onServerRestarting);
    socket.on('game-abandoned', onGameAbandoned);

    console.log('✅ Eventos de flujo del juego registrados');
}

// Exponer salirDelLobby globalmente para onclick handlers
window.salirDelLobby = salirDelLobby;
