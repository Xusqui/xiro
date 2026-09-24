/* global TVApp */
window.TVApp = window.TVApp || {};
window.TVApp.Main = (function () {
    'use strict';

    let delegationInitialized = false;

    const state = window.TVApp.State;
    const initAudio = window.TVApp.Audio.initAudio;
    const playTick = window.TVApp.Audio.playTick;
    const unlockAudioContext = window.TVApp.Audio.unlockAudioContext;
    const showTvModal = window.TVApp.Utils.showTvModal;
    const renderCommentSlide = window.TVApp.RenderSlides.renderCommentSlide;

    function showConfirmModal(title, message, onConfirm) {
        const existing = document.getElementById('xiro-tv-confirm-modal');
        if (existing) existing.parentNode.removeChild(existing);

        const overlay = document.createElement('div');
        overlay.id = 'xiro-tv-confirm-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.75)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '10000';

        const modal = document.createElement('div');
        modal.style.background = '#ffffff';
        modal.style.borderRadius = '14px';
        modal.style.maxWidth = '380px';
        modal.style.width = '90%';
        modal.style.padding = '24px 20px';
        modal.style.fontFamily = 'Arial, sans-serif';
        modal.style.boxShadow = '0 16px 40px rgba(0,0,0,0.4)';

        const titleEl = document.createElement('div');
        titleEl.textContent = _t(title);
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = '800';
        titleEl.style.marginBottom = '10px';

        const msgEl = document.createElement('div');
        msgEl.textContent = _t(message);
        msgEl.style.fontSize = '14px';
        msgEl.style.lineHeight = '1.5';
        msgEl.style.color = '#444';

        const actions = document.createElement('div');
        actions.style.marginTop = '20px';
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = _t('tv.game.cancel', null, 'Cancelar');
        btnCancel.style.padding = '9px 18px';
        btnCancel.style.background = '#e5e7eb';
        btnCancel.style.color = '#333';
        btnCancel.style.border = 'none';
        btnCancel.style.borderRadius = '999px';
        btnCancel.style.fontWeight = '700';
        btnCancel.style.cursor = 'pointer';
        btnCancel.style.fontSize = '13px';
        btnCancel.onclick = function () {
            overlay.parentNode.removeChild(overlay);
        };

        const btnConfirm = document.createElement('button');
        btnConfirm.textContent = _t('tv.game.confirm', null, 'Confirmar');
        btnConfirm.style.marginLeft = '10px';
        btnConfirm.style.padding = '9px 18px';
        btnConfirm.style.background = '#dc2626';
        btnConfirm.style.color = '#ffffff';
        btnConfirm.style.border = 'none';
        btnConfirm.style.borderRadius = '999px';
        btnConfirm.style.fontWeight = '700';
        btnConfirm.style.cursor = 'pointer';
        btnConfirm.style.fontSize = '13px';
        btnConfirm.onclick = function () {
            overlay.parentNode.removeChild(overlay);
            onConfirm();
        };

        actions.appendChild(btnCancel);
        actions.appendChild(btnConfirm);
        modal.appendChild(titleEl);
        modal.appendChild(msgEl);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function finalizarJuego() {
        if (!state.sessionId || !window.TVApp.socket) return;
        showConfirmModal(
            _t('tv.game.end', null, 'Finalizar partida'),
            _t('tv.game.end_msg', null, 'Se enviara el ranking final a todos los jugadores. ¿Continuar?'),
            function () {
                window.TVApp.socket.emit('end-game', { roomIdOrPin: state.sessionId, reason: 'manual' });
            }
        );
    }

    function abortarJuego() {
        if (!state.sessionId || !window.TVApp.socket) return;
        showConfirmModal(
            _t('tv.game.abort', null, 'Abortar partida'),
            _t('tv.game.abort_msg', null, 'Se desconectara a todos los jugadores y volveras al selector de PIN. ¿Continuar?'),
            function () {
                window.TVApp.socket.emit('abandon-game', { roomIdOrPin: state.sessionId, reason: 'abandoned' });
            }
        );
    }

    function findActionElement(target) {
        let el = target;
        while (el && el !== document) {
            if (el.getAttribute && el.getAttribute('data-tv-action')) return el;
            el = el.parentNode;
        }
        return null;
    }

    function setupDelegatedTvActions() {
        if (delegationInitialized) return;
        delegationInitialized = true;

        document.addEventListener('click', function (event) {
            const actionEl = findActionElement(event.target);
            if (!actionEl) return;

            const action = actionEl.getAttribute('data-tv-action') || '';
            const pin = actionEl.getAttribute('data-pin') || '';
            const filter = actionEl.getAttribute('data-filter') || '';
            const nickname = actionEl.getAttribute('data-nickname') || '';
            const points = parseInt(actionEl.getAttribute('data-points') || '0', 10);
            const numTeams = parseInt(actionEl.getAttribute('data-num-teams') || '0', 10);

            switch (action) {
                case 'next-question':
                    nextQuestion();
                    break;
                case 'toggle-pause-timer':
                    togglePauseTimer();
                    break;
                case 'assign-manual-points':
                    if (nickname && Number.isFinite(points)) assignManualPoints(nickname, points);
                    break;
                case 'open-admin':
                    window.location.href = '/admin.html';
                    break;
                case 'retry-pin-selector':
                    if (window.TVApp.Lobby) window.TVApp.Lobby.mostrarSelectorPIN();
                    break;
                case 'change-filter':
                    if (window.TVApp.Lobby && filter) window.TVApp.Lobby.cambiarFiltro(filter);
                    break;
                case 'select-pin':
                    if (window.TVApp.Lobby && pin) window.TVApp.Lobby.seleccionarPIN(pin);
                    break;
                case 'start-game':
                    empezar();
                    break;
                case 'go-tv-home':
                    volverAJuegos();
                    break;
                case 'teams-mode-individual':
                    if (window.TVApp.Teams && pin) window.TVApp.Teams.configurarModoIndividual(pin);
                    break;
                case 'teams-mode-team':
                    if (window.TVApp.Teams && pin) window.TVApp.Teams.mostrarConfiguracionEquipos(pin);
                    break;
                case 'teams-select-num':
                    if (window.TVApp.Teams && pin && Number.isFinite(numTeams) && numTeams > 0) {
                        window.TVApp.Teams.seleccionarNumEquipos(numTeams, pin);
                    }
                    break;
                case 'teams-back-mode':
                    if (window.TVApp.Teams && pin) window.TVApp.Teams.mostrarSeleccionModo(pin);
                    break;
                case 'teams-confirm':
                    if (window.TVApp.Teams && pin && Number.isFinite(numTeams) && numTeams > 0) {
                        window.TVApp.Teams.confirmarEquipos(numTeams, pin);
                    }
                    break;
                case 'teams-back-config':
                    if (window.TVApp.Teams && pin) window.TVApp.Teams.mostrarConfiguracionEquipos(pin);
                    break;
                case 'render-podio':
                    if (window.TVApp.Podio) window.TVApp.Podio.renderPodio(window._tempRanking || []);
                    break;
                case 'finalizar-juego':
                    finalizarJuego();
                    break;
                case 'abortar-juego':
                    abortarJuego();
                    break;
                default:
                    break;
            }
        });
    }

    // Exportar funciones globales necesarias para acciones delegadas en HTML generado
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

    function initApp() {
        console.log('=== TV.JS INICIANDO ===');
        setupDelegatedTvActions();

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
        finalizarJuego: finalizarJuego,
        abortarJuego: abortarJuego
    };
})();
