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

    function _setFullscreen(on) {
        document.querySelector('.standalone-shell')?.classList.toggle('is-fullscreen', on);
    }

    function _showErrorAndReturn(message) {
        StandaloneQuestionCommon.clearQuestionTimer();
        _setFullscreen(false);
        _mainContainer().innerHTML = `
            <div class="standalone-error standalone-card">
                <i class="fas fa-triangle-exclamation"></i>
                <p>${StandaloneQuestionCommon.escapeHtml(message)}</p>
                <a href="/standalone.html" class="btn-primary">${window.XiroI18n?.t('standalone.game.back_to_lobby') || 'Volver a la lista'}</a>
            </div>
        `;
    }

    function _renderCurrentQuestion() {
        revealedForCurrentQuestion = false;
        _setFullscreen(true);
        const container = _mainContainer();
        const question = StandaloneState.get().currentQuestion;

        StandaloneQuestionRouter.render(container, question, {
            onSubmitted: () => {
                /* el jugador real tampoco muestra aviso: solo espera */
            },
            onContinue: () => StandaloneSocket.nextQuestion()
        });

        // Las slides (comment/info/text/image) no tienen tiempo límite en el
        // servidor (ver AdvanceQuestionUseCase.NO_TIMER_SLIDE_TYPES) — no
        // mostrar reloj para ellas.
        if (!StandaloneQuestionRouter.isSlide(question) && typeof question.time_limit === 'number') {
            StandaloneQuestionCommon.startQuestionTimer(container, question.time_limit);
        }
    }

    function _showReveal(kind, data) {
        if (revealedForCurrentQuestion) return;
        revealedForCurrentQuestion = true;
        StandaloneQuestionCommon.clearQuestionTimer();
        _setFullscreen(true);

        const container = _mainContainer();
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

    function _handleRandomPointsReveal(payload) {
        window.XiroRandomPointsOverlay &&
            window.XiroRandomPointsOverlay.show(payload, {
                currentStreak: StandaloneState.get().streakInfo?.current || 0
            });
    }

    function _handleNewQuestion(data) {
        window.XiroRandomPointsOverlay && window.XiroRandomPointsOverlay.hide();
        const state = StandaloneState.get();
        state.totalQuestions = data.totalQuestions || state.totalQuestions;
        state.currentIndex = data.currentIndex ?? state.currentIndex;
        state.currentQuestion = data.question;
        _renderCurrentQuestion();
    }

    function _handleMaxScore(data) {
        StandaloneState.get().maxPossibleScore = data?.maxPossibleScore ?? null;
    }

    function _handleGameEnded(ranking) {
        StandaloneQuestionCommon.clearQuestionTimer();
        StandaloneState.get().ended = true;
        _setFullscreen(false);
        StandaloneResults.render(_mainContainer(), ranking);
    }

    function _handleError(type, data) {
        console.error('Standalone error:', type, data);
    }

    function _handleDisconnected(role, reason) {
        if (StandaloneState.get().ended) return;
        console.warn(`Standalone: socket ${role} desconectado (${reason})`);
    }

    async function _closeGame() {
        const button = document.getElementById('standalone-close-game');
        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            const icon = button.querySelector('i');
            if (icon) icon.className = 'fas fa-spinner fa-spin';
        }
        StandaloneQuestionCommon.clearQuestionTimer();
        await StandaloneSocket.closeSession();
        window.location.href = '/standalone.html';
    }

    // Solo visible en partida (CSS: .standalone-shell.is-fullscreen); pide confirmación.
    function _confirmCloseGame() {
        const t = (key, fallback) => window.XiroI18n?.t(key) || fallback;
        if (typeof window.mostrarModalConfirmacion !== 'function') {
            return _closeGame();
        }
        window.mostrarModalConfirmacion(
            t('standalone.game.close_confirm_title', '¿Cerrar la partida?'),
            t(
                'standalone.game.close_confirm_message',
                'Perderás el progreso de esta partida y volverás a la lista de juegos.'
            ),
            _closeGame,
            null,
            t('standalone.game.close', 'Cerrar partida')
        );
    }

    return {
        init: function () {
            document.getElementById('standalone-close-game')?.addEventListener('click', _confirmCloseGame);
        },

        startGame: async function (pin) {
            const nickname =
                StandaloneState.getNickname() || window.XiroI18n?.t('standalone.lobby.default_nickname') || 'Jugador';

            StandaloneState.reset();
            const state = StandaloneState.get();
            state.pin = pin;
            state.nickname = nickname;

            _setFullscreen(false);
            _mainContainer().innerHTML = `
                <div class="standalone-loading standalone-card">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${window.XiroI18n?.t('standalone.game.starting') || 'Preparando tu partida...'}</p>
                </div>
            `;

            try {
                await StandaloneSocket.startSession(
                    { pin, nickname },
                    {
                        onGameStarted: _handleGameStarted,
                        onNewQuestion: _handleNewQuestion,
                        onRandomPointsReveal: _handleRandomPointsReveal,
                        onAnswerResult: data => _showReveal('answer-result', data),
                        onRevealAnswer: data => _showReveal('reveal-answer', data),
                        onMaxScore: _handleMaxScore,
                        onGameEnded: _handleGameEnded,
                        onError: _handleError,
                        onDisconnected: _handleDisconnected
                    }
                );
            } catch (err) {
                StandaloneSocket.abandonAndDisconnect();
                _showErrorAndReturn(
                    err?.message || window.XiroI18n?.t('standalone.game.join_error') || 'No se pudo iniciar la partida.'
                );
            }
        }
    };
})();
