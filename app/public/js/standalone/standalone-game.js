/**
 * @fileoverview Orquestador del modo Standalone.
 * Coordina StandaloneSocket (dos conexiones: presentador oculto + jugador real),
 * el enrutador de preguntas y las pantallas de reveal/resultados.
 */

'use strict';

const StandaloneGame = (() => {
    let revealedForCurrentQuestion = false;

    function _mainContainer() {
        return document.getElementById('main-container');
    }

    function _renderShell(currentIndex, totalQuestions) {
        const percent = totalQuestions > 0 ? Math.round((currentIndex / totalQuestions) * 100) : 0;
        _mainContainer().innerHTML = `
            <div class="standalone-game standalone-card">
                <div class="progress-bar"><div class="progress" style="width:${percent}%"></div></div>
                <div class="standalone-meta">
                    <span class="question-counter">${(window.XiroI18n?.t('standalone.game.question_counter') || 'Pregunta {current} de {total}').replace('{current}', currentIndex + 1).replace('{total}', totalQuestions)}</span>
                    <span class="question-timer" id="standalone-timer"></span>
                </div>
                <div id="question-container"></div>
            </div>
        `;
        return document.getElementById('question-container');
    }

    function _showErrorAndReturn(message) {
        StandaloneQuestionCommon.stopCountdown();
        _mainContainer().innerHTML = `
            <div class="standalone-error standalone-card">
                <i class="fas fa-triangle-exclamation"></i>
                <p>${StandaloneQuestionCommon.escapeHtml(message)}</p>
                <a href="/standalone.html" class="btn-primary">${window.XiroI18n?.t('standalone.game.back_to_lobby') || 'Volver a la lista'}</a>
            </div>
        `;
    }

    function _renderCurrentQuestion() {
        const state = StandaloneState.get();
        revealedForCurrentQuestion = false;
        const container = _renderShell(state.currentIndex, state.totalQuestions);
        const question = state.currentQuestion;

        StandaloneQuestionCommon.stopCountdown();
        const isSlide = StandaloneQuestionRouter.isSlide(question);
        if (!isSlide && typeof question.time_limit === 'number' && question.time_limit > 0) {
            StandaloneQuestionCommon.startCountdown(question.time_limit, {
                onTick: (remaining) => {
                    const el = document.getElementById('standalone-timer');
                    if (el) el.textContent = `⏱ ${remaining}s`;
                }
            });
        }

        StandaloneQuestionRouter.render(container, question, {
            onSubmitted: () => {
                if (revealedForCurrentQuestion) return;
                const waiting = document.createElement('p');
                waiting.className = 'waiting-result';
                waiting.textContent = window.XiroI18n?.t('standalone.game.waiting_result') || 'Comprobando tu respuesta...';
                container.appendChild(waiting);
            },
            onContinue: () => StandaloneSocket.nextQuestion()
        });
    }

    function _showReveal(kind, data) {
        if (revealedForCurrentQuestion) return;
        revealedForCurrentQuestion = true;
        StandaloneQuestionCommon.stopCountdown();

        const container = document.getElementById('question-container') || _mainContainer();
        const onNext = () => StandaloneSocket.nextQuestion();

        if (kind === 'answer-result') {
            StandaloneReveal.showAnswerResult(container, data, { onNext });
        } else {
            StandaloneReveal.showRevealOnly(container, data, { onNext });
        }
    }

    function _handleGameStarted(data) {
        const state = StandaloneState.get();
        state.totalQuestions = data.totalQuestions || 0;
        state.currentIndex = data.currentIndex || 0;
        state.currentQuestion = data.firstQuestion;
        _renderCurrentQuestion();
    }

    function _handleNewQuestion(data) {
        const state = StandaloneState.get();
        state.totalQuestions = data.totalQuestions || state.totalQuestions;
        state.currentIndex = data.currentIndex ?? state.currentIndex;
        state.currentQuestion = data.question;
        _renderCurrentQuestion();
    }

    function _handleGameEnded(ranking) {
        StandaloneState.get().ended = true;
        StandaloneQuestionCommon.stopCountdown();
        StandaloneResults.render(_mainContainer(), ranking);
    }

    function _handleError(type, data) {
        console.error('Standalone error:', type, data);
    }

    function _handleDisconnected(role, reason) {
        if (StandaloneState.get().ended) return;
        console.warn(`Standalone: socket ${role} desconectado (${reason})`);
    }

    return {
        init: function () { /* sin acción: la lógica arranca desde startGame() */ },

        startGame: async function (pin) {
            const nickname = StandaloneState.getNickname() ||
                (window.XiroI18n?.t('standalone.lobby.default_nickname') || 'Jugador');

            StandaloneState.reset();
            const state = StandaloneState.get();
            state.pin = pin;
            state.nickname = nickname;

            _mainContainer().innerHTML = `
                <div class="standalone-loading standalone-card">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${window.XiroI18n?.t('standalone.game.starting') || 'Preparando tu partida...'}</p>
                </div>
            `;

            try {
                await StandaloneSocket.startSession({ pin, nickname }, {
                    onGameStarted: _handleGameStarted,
                    onNewQuestion: _handleNewQuestion,
                    onAnswerResult: (data) => _showReveal('answer-result', data),
                    onRevealAnswer: (data) => _showReveal('reveal-answer', data),
                    onGameEnded: _handleGameEnded,
                    onError: _handleError,
                    onDisconnected: _handleDisconnected
                });
            } catch (err) {
                StandaloneSocket.abandonAndDisconnect();
                _showErrorAndReturn(err?.message || (window.XiroI18n?.t('standalone.game.join_error') || 'No se pudo iniciar la partida.'));
            }
        }
    };
})();
