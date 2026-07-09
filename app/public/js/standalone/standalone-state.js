/**
 * @fileoverview Estado compartido del modo Standalone (sin presentador)
 */

'use strict';

globalThis.StandaloneState = (() => {
    const state = {
        pin: null,
        sessionId: null,
        nickname: null,
        presenterPlayerId: null,
        playerPlayerId: null,
        currentIndex: 0,
        totalQuestions: 0,
        currentQuestion: null,
        answered: false,
        lastScore: 0,
        ended: false
    };

    function reset() {
        state.pin = null;
        state.sessionId = null;
        state.presenterPlayerId = null;
        state.playerPlayerId = null;
        state.currentIndex = 0;
        state.totalQuestions = 0;
        state.currentQuestion = null;
        state.answered = false;
        state.lastScore = 0;
        state.ended = false;
    }

    function getNickname() {
        if (state.nickname) return state.nickname;
        try {
            return localStorage.getItem('xiro_standalone_nickname') || null;
        } catch (_) {
            return null;
        }
    }

    function setNickname(nickname) {
        state.nickname = nickname;
        try {
            localStorage.setItem('xiro_standalone_nickname', nickname);
        } catch (_) { /* localStorage no disponible */ }
    }

    return {
        get: () => state,
        reset,
        getNickname,
        setNickname
    };
})();
