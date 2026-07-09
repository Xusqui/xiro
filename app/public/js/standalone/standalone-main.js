/**
 * @fileoverview Inicializador del modo Standalone sin scripts inline (compatible CSP)
 */

'use strict';

document.addEventListener('DOMContentLoaded', function () {
    if (typeof StandaloneGame !== 'undefined' && typeof StandaloneGame.init === 'function') {
        StandaloneGame.init();
    }

    if (typeof StandaloneLobby !== 'undefined' && typeof StandaloneLobby.init === 'function') {
        StandaloneLobby.init();
    }
});

window.addEventListener('beforeunload', function () {
    const state = typeof StandaloneState !== 'undefined' ? StandaloneState.get() : null;
    if (state && state.sessionId && !state.ended) {
        StandaloneSocket.abandonAndDisconnect();
    }
});
