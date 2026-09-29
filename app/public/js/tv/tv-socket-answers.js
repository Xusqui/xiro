window.TVApp = window.TVApp || {};
window.TVApp.SocketAnswers = (function () {
    'use strict';

    const getEl = window.TVApp.Utils.getEl;
    const debounceUpdate = window.TVApp.Utils.debounceUpdate;
    const updatePlayersPanel = window.TVApp.RenderPlayers.updatePlayersPanel;
    const updateAnswerCounter = window.TVApp.RenderPlayers.updateAnswerCounter;
    const stopQuestionAudio = window.TVApp.Audio.stopQuestionAudio;
    const Reveal = window.TVApp.RevealRenderers;

    /** Actualiza las puntuaciones con el ranking del reveal y marca como fallo a quien no respondió. */
    function applyRevealScores(state, data) {
        (data.ranking || []).forEach((player) => {
            if (state.playersData[player.name]) state.playersData[player.name].score = player.pts;
        });
        for (const nick in state.playersData) {
            if (!state.playersData[nick].answered) state.playersData[nick].correct = false;
        }
    }

    function initAnswersSocket() {
        const socket = window.TVApp.socket;
        const state = window.TVApp.State;

        if (!socket) {
            console.error('Socket no inicializado');
            return;
        }

        socket.on('answer-result', function (data) {
            if (!data || !data.nickname) return;
            const nick = data.nickname;
            if (state.playersData[nick]) {
                state.playersData[nick].answered = true;
                state.playersData[nick].correct = data.isCorrect;
                if (typeof data.totalScore === 'number') {
                    state.playersData[nick].score = data.totalScore;
                }
                debounceUpdate(updatePlayersPanel);
                updateAnswerCounter();
            }
        });

        socket.on('answer-result-batch', function (data) {
            if (!data || !data.answers || !Array.isArray(data.answers)) return;
            for (let i = 0; i < data.answers.length; i++) {
                const answer = data.answers[i];
                if (answer.nickname && state.playersData[answer.nickname]) {
                    state.playersData[answer.nickname].answered = true;
                    state.playersData[answer.nickname].correct = answer.isCorrect;
                    if (typeof answer.totalScore === 'number') {
                        state.playersData[answer.nickname].score = answer.totalScore;
                    }
                }
            }
            debounceUpdate(updatePlayersPanel);
            updateAnswerCounter();
        });

        socket.on('ranking-update', function (data) {
            if (data.ranking) {
                for (let i = 0; i < data.ranking.length; i++) {
                    const player = data.ranking[i];
                    if (state.playersData[player.nickname]) {
                        state.playersData[player.nickname].score = player.score;
                    }
                }
                debounceUpdate(updatePlayersPanel);
            }
        });

        socket.on('reveal-answer', function (data) {
            if (data.stopAudio) stopQuestionAudio();
            window.TVApp.RenderSlides.resetTimers(); // Detiene timer

            applyRevealScores(state, data);
            debounceUpdate(updatePlayersPanel);

            const question = state.currentQuestion;
            const type = question && question.question_type;
            if (type === 'numeric_approximation') Reveal.renderNumericReveal(data, question);
            else if (type === 'word_scramble') Reveal.renderWordScrambleReveal(data, question);
            else Reveal.renderOptionsReveal(data);

            const nextBtn = getEl('btn-next');
            if (nextBtn) nextBtn.classList.remove('hidden');
        });
    }

    return {
        initAnswersSocket: initAnswersSocket
    };
})();
