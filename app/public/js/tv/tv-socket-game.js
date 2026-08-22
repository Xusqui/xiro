window.TVApp = window.TVApp || {};
window.TVApp.SocketGame = (function () {
    'use strict';

    var getEl = window.TVApp.Utils.getEl;
    var clearCache = window.TVApp.Utils.clearCache;
    var showTvModal = window.TVApp.Utils.showTvModal;
    var debounceUpdate = window.TVApp.Utils.debounceUpdate;
    var updatePlayersPanel = window.TVApp.RenderPlayers.updatePlayersPanel;
    var renderCommentSlide = window.TVApp.RenderSlides.renderCommentSlide;
    var renderInfoSlide = window.TVApp.RenderSlides.renderInfoSlide;
    var renderTextSlide = window.TVApp.RenderSlides.renderTextSlide;
    var renderImageSlide = window.TVApp.RenderSlides.renderImageSlide;
    var renderTextImageSlide = window.TVApp.RenderSlides.renderTextImageSlide;
    var renderPregunta = window.TVApp.RenderQuestion.renderPregunta;
    var updateAnswerCounter = window.TVApp.RenderPlayers.updateAnswerCounter;

    function initGameSocket() {
        var socket = window.TVApp.socket;
        var state = window.TVApp.State;

        if (!socket) {
            console.error('Socket no inicializado');
            return;
        }

        socket.on('game-start-error', function (data) {
            console.log('Error al iniciar juego:', data);
            var msg = data.message || 'No se pudo iniciar el juego';
            showTvModal('Error', msg, 'error');
        });

        socket.on('game-started', function (data, ack) {
            var ctrlPartida = document.getElementById('ctrl-partida');
            if (ctrlPartida) ctrlPartida.style.display = 'block';
            if (!data || !data.firstQuestion) return;
            state.totalQuestions = data.totalQuestions;
            state.currentQuestionIndex = data.currentIndex;

            for (var nick in state.playersData) {
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

        socket.on('new-question', function (data, ack) {
            if (!data || !data.question) return;

            for (var nick in state.playersData) {
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
            var timerEl = getEl('timer');
            if (timerEl) {
                timerEl.style.borderColor = '#eab308';
                timerEl.style.backgroundColor = 'rgba(234,179,8,0.2)';
                timerEl.textContent = _t(state.currentSeconds);
            }
        });

        socket.on('timer-resumed', function (data) {
            state.timerPaused = false;
            state.currentSeconds = Math.ceil(data.remainingTime);
            var timerEl = getEl('timer');
            if (timerEl) {
                timerEl.style.borderColor = '#0891b2';
                timerEl.style.backgroundColor = '';
            }
        });

        socket.on('game-ended', function (ranking, ack) {
            var ctrlPartida = document.getElementById('ctrl-partida');
            if (ctrlPartida) ctrlPartida.style.display = 'none';
            window.TVApp.RenderSlides.resetTimers(); // Detiene timer
            if (window.TVApp.Podio) {
                window.TVApp.Podio.renderPodio(ranking);
            }
            if (typeof ack === 'function') ack();
        });

        socket.on('game-abandoned', function () {
            var ctrlPartida = document.getElementById('ctrl-partida');
            if (ctrlPartida) ctrlPartida.style.display = 'none';
            window.location.href = '/tv.html';
        });

        socket.on('team-update', function (data) {
            if (!state.isTeamMode) return;
            if (data.teams) {
                if (!state.teamConfig) state.teamConfig = {};
                state.teamConfig.teams = data.teams;
            }
            var pList = getEl('p-list');
            if (pList && window.TVApp.Teams) {
                window.TVApp.Teams.renderTeamLobby();
            }
        });
    }

    return {
        initGameSocket: initGameSocket
    };
})();
