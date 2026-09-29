window.TVApp = window.TVApp || {};
window.TVApp.TrvState = (function () {
    'use strict';

    let state = null;

    function setTrivialGameState(data) {
        state = data;
    }

    function getTrivialGameState() {
        return state;
    }

    function clearTrivialGameState() {
        state = null;
    }

    function updateTrivialPlayers(players) {
        if (!state) return;
        state.players = players;
    }

    function updateTrivialTurn(currentTurn, phase) {
        if (!state) return;
        state.currentTurn = currentTurn;
        state.phase = phase;
    }

    function updateTrivialTokens(teamTokens, players) {
        if (!state) return;
        if (teamTokens) state.teamTokens = teamTokens;
        if (players) state.players = players;
    }

    return {
        setTrivialGameState: setTrivialGameState,
        getTrivialGameState: getTrivialGameState,
        clearTrivialGameState: clearTrivialGameState,
        updateTrivialPlayers: updateTrivialPlayers,
        updateTrivialTurn: updateTrivialTurn,
        updateTrivialTokens: updateTrivialTokens
    };
})();
