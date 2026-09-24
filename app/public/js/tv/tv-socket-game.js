window.TVApp = window.TVApp || {};
window.TVApp.SocketGame = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const clearCache = window.TVApp.Utils.clearCache;
    const showTvModal = window.TVApp.Utils.showTvModal;
    const debounceUpdate = window.TVApp.Utils.debounceUpdate;
    const updatePlayersPanel = window.TVApp.RenderPlayers.updatePlayersPanel;
    const renderCommentSlide = window.TVApp.RenderSlides.renderCommentSlide;
    const renderInfoSlide = window.TVApp.RenderSlides.renderInfoSlide;
    const renderTextSlide = window.TVApp.RenderSlides.renderTextSlide;
    const renderImageSlide = window.TVApp.RenderSlides.renderImageSlide;
    const renderTextImageSlide = window.TVApp.RenderSlides.renderTextImageSlide;
    const renderPregunta = window.TVApp.RenderQuestion.renderPregunta;
    const updateAnswerCounter = window.TVApp.RenderPlayers.updateAnswerCounter;

    function initGameSocket() {
        const socket = window.TVApp.socket;
        const state = window.TVApp.State;

        if (!socket) {
            console.error('Socket no inicializado');
            return;
        }

        socket.on('game-start-error', function (data) {
            console.log('Error al iniciar juego:', data);
            const msg = data.message || 'No se pudo iniciar el juego';
            showTvModal('Error', msg, 'error');
        });

        socket.on('game-started', function (data, ack) {
            const ctrlPartida = document.getElementById('ctrl-partida');
            if (ctrlPartida) ctrlPartida.style.display = 'block';
            if (!data || !data.firstQuestion) return;
            state.totalQuestions = data.totalQuestions;
            state.currentQuestionIndex = data.currentIndex;

            for (const nick in state.playersData) {
                state.playersData[nick].answered = false;
                state.playersData[nick].correct = null;
            }
            debounceUpdate(updatePlayersPanel);

            if (data.firstQuestion.slide_type === 'comment') {
                renderCommentSlide(data.firstQuestion);
            } else if (data.firstQuestion.slide_type === 'info') {
                renderInfoSlide(data.firstQuestion);
            } else if (data.firstQuestion.slide_type === 'text') {
                renderTextSlide(data.firstQuestion);
            } else if (data.firstQuestion.slide_type === 'image') {
                renderImageSlide(data.firstQuestion);
            } else if (data.firstQuestion.slide_type === 'text-image') {
                renderTextImageSlide(data.firstQuestion);
            } else {
                renderPregunta(data.firstQuestion);
            }

            if (typeof ack === 'function') ack();
        });

        socket.on('random-points-reveal', function (payload) {
            // TV no carga el CSS del flip board (solo tv.css): número en texto plano
            window.XiroRandomPointsOverlay && window.XiroRandomPointsOverlay.show(payload, { animate: false });
        });

        socket.on('new-question', function (data, ack) {
            if (!data || !data.question) return;

            // La pregunta ya está aquí: retirar la pantalla de puntuación aleatoria
            window.XiroRandomPointsOverlay && window.XiroRandomPointsOverlay.hide();

            for (const nick in state.playersData) {
                state.playersData[nick].answered = false;
                state.playersData[nick].correct = null;
            }

            debounceUpdate(updatePlayersPanel);
            updateAnswerCounter();

            state.totalQuestions = data.totalQuestions;
            state.currentQuestionIndex = data.currentIndex;

            if (data.question.slide_type === 'comment') {
                renderCommentSlide(data.question);
            } else if (data.question.slide_type === 'info') {
                renderInfoSlide(data.question);
            } else if (data.question.slide_type === 'text') {
                renderTextSlide(data.question);
            } else if (data.question.slide_type === 'image') {
                renderImageSlide(data.question);
            } else if (data.question.slide_type === 'text-image') {
                renderTextImageSlide(data.question);
            } else {
                renderPregunta(data.question);
            }

            if (typeof ack === 'function') ack();
        });

        socket.on('timer-paused', function (data) {
            state.timerPaused = true;
            state.currentSeconds = Math.ceil(data.remainingTime);
            const timerEl = getEl('timer');
            if (timerEl) {
                timerEl.style.borderColor = '#eab308';
                timerEl.style.backgroundColor = 'rgba(234,179,8,0.2)';
                timerEl.textContent = _t(state.currentSeconds);
            }
        });

        socket.on('timer-resumed', function (data) {
            state.timerPaused = false;
            state.currentSeconds = Math.ceil(data.remainingTime);
            const timerEl = getEl('timer');
            if (timerEl) {
                timerEl.style.borderColor = '#0891b2';
                timerEl.style.backgroundColor = '';
            }
        });

        socket.on('game-ended', function (ranking, ack) {
            const ctrlPartida = document.getElementById('ctrl-partida');
            if (ctrlPartida) ctrlPartida.style.display = 'none';
            window.TVApp.RenderSlides.resetTimers(); // Detiene timer
            if (window.TVApp.Podio) {
                window.TVApp.Podio.renderPodio(ranking);
            }
            if (typeof ack === 'function') ack();
        });

        socket.on('game-abandoned', function () {
            const ctrlPartida = document.getElementById('ctrl-partida');
            if (ctrlPartida) ctrlPartida.style.display = 'none';
            window.location.href = '/tv.html';
        });

        socket.on('team-update', function (data) {
            if (!state.isTeamMode) return;
            if (data.teams) {
                if (!state.teamConfig) state.teamConfig = {};
                state.teamConfig.teams = data.teams;
            }
            const pList = getEl('p-list');
            if (pList && window.TVApp.Teams) {
                window.TVApp.Teams.renderTeamLobby();
            }
        });
    }

    return {
        initGameSocket: initGameSocket
    };
})();
