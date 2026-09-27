/* global TVApp */
window.TVApp = window.TVApp || {};
window.TVApp.Main = (function () {
    'use strict';

    const state = window.TVApp.State;
    const initAudio = window.TVApp.Audio.initAudio;
    const playTick = window.TVApp.Audio.playTick;
    const unlockAudioContext = window.TVApp.Audio.unlockAudioContext;
    const showTvModal = window.TVApp.Utils.showTvModal;
    const renderCommentSlide = window.TVApp.RenderSlides.renderCommentSlide;

    function finalizarJuego() {
        if (!state.sessionId || !window.TVApp.socket) return;
        window.TVApp.ConfirmModal.show(
            _t('tv.game.end', null, 'Finalizar partida'),
            _t('tv.game.end_msg', null, 'Se enviara el ranking final a todos los jugadores. ¿Continuar?'),
            function () {
                window.TVApp.socket.emit('end-game', { roomIdOrPin: state.sessionId, reason: 'manual' });
            }
        );
    }

    function abortarJuego() {
        if (!state.sessionId || !window.TVApp.socket) return;
        window.TVApp.ConfirmModal.show(
            _t('tv.game.abort', null, 'Abortar partida'),
            _t('tv.game.abort_msg', null, 'Se desconectara a todos los jugadores y volveras al selector de PIN. ¿Continuar?'),
            function () {
                window.TVApp.socket.emit('abandon-game', { roomIdOrPin: state.sessionId, reason: 'abandoned' });
            }
        );
    }

    // Funciones de partida; las acciones delegadas (tv-actions.js) las llaman vía TVApp.Main
    function empezar() {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(function () { });
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }

        initAudio();
        playTick();
        unlockAudioContext();

        if (window.TVApp.socket && state.sessionId) {
            if (state.gameType === 'trivial') {
                window.TVApp.socket.emit('trivial-start', {
                    roomId: state.sessionId,
                    isTeamMode: state.isTeamMode,
                    teamConfig: state.teamConfig
                });
            } else {
                window.TVApp.socket.emit('start-game', state.sessionId);
            }
        }
    }

    function togglePauseTimer() {
        if (!state.sessionId || !window.TVApp.socket) return;
        window.TVApp.socket.emit(state.timerPaused ? 'resume-timer' : 'pause-timer', state.sessionId);
    }

    function assignManualPoints(nickname, points) {
        if (!state.sessionId || !window.TVApp.socket) return;
        window.TVApp.socket.emit('manual-points', { sessionId: state.sessionId, nickname: nickname, points: points });
        if (state.playersData[nickname]) {
            state.playersData[nickname].score = (state.playersData[nickname].score || 0) + points;
            const commentText = document.querySelector('.comment-text');
            if (commentText) renderCommentSlide({ comment_text: commentText.textContent });
        }
    }

    function nextQuestion() {
        if (!state.sessionId || !window.TVApp.socket) return;
        window.TVApp.socket.emit('next-question', state.sessionId);
    }

    function volverAJuegos() {
        window.location.href = '/tv.html';
    }

    // Igual que concluirJuegoYVolver del presentador: avisa al servidor para que los
    // jugadores pasen ya a "Juego concluido". El servidor no confirma (sin ack), así que
    // se da un margen breve para que el mensaje salga antes de recargar la página.
    function concluirYVolver() {
        if (window.TVApp.socket && state.sessionId) {
            window.TVApp.socket.emit('abandon-game', { roomIdOrPin: state.sessionId, reason: 'concluded' });
            setTimeout(volverAJuegos, 300);
            return;
        }
        volverAJuegos();
    }

    function initApp() {
        console.log('=== TV.JS INICIANDO ===');
        window.TVApp.Actions.setup();

        // Asignar parámetros GET a state.pin
        state.pin = window.TVApp.Utils.getURLParameter('pin');
        console.log('PIN desde URL:', state.pin);

        try {
            // 1. Inicializar Socket y Eventos
            window.TVApp.SocketConnection.initSocket();
            window.TVApp.SocketGame.initGameSocket();
            window.TVApp.SocketAnswers.initAnswersSocket();

            if (window.TVApp.TrvSocket) {
                window.TVApp.TrvSocket.initTrivialSocket();
            }

            // 2. Control de Flujo Inicial
            if (!state.pin) {
                console.log('No hay PIN, mostrando selector');
                if (window.TVApp.Lobby) window.TVApp.Lobby.mostrarSelectorPIN();
            } else {
                console.log('PIN detectado, iniciando lobby');
                if (window.TVApp.Lobby) window.TVApp.Lobby.iniciarLobby();
            }
        } catch (e) {
            console.log('ERROR CRITICO en inicio:', e);
            showTvModal('Error', 'ERROR: ' + e.message, 'error');
        }
    }

    // Al cargar el script, arrancar la aplicación
    // Nota: en la versión original había un IIFE inmediato, pero como
    // este script se ejecuta al final (body), es equivalente.
    setTimeout(initApp, 100);

    return {
        empezar: empezar,
        togglePauseTimer: togglePauseTimer,
        assignManualPoints: assignManualPoints,
        nextQuestion: nextQuestion,
        volverAJuegos: volverAJuegos,
        concluirYVolver: concluirYVolver,
        finalizarJuego: finalizarJuego,
        abortarJuego: abortarJuego
    };
})();
