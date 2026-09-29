/**
 * @fileoverview Presenter - Estado del juego Trivial en el frontend
 */

let _trivialState = null;

export function setTrivialGameState(state) {
    _trivialState = state;
}

export function getTrivialGameState() {
    return _trivialState;
}

export function updateTrivialPlayers(players) {
    if (!_trivialState) return;
    _trivialState.players = players;
}

export function updateTrivialTurn(currentTurn, phase) {
    if (!_trivialState) return;
    _trivialState.currentTurn = currentTurn;
    _trivialState.phase = phase;
}

export function updateTrivialTokens(teamTokens, players) {
    if (!_trivialState) return;
    if (teamTokens) _trivialState.teamTokens = teamTokens;
    if (players) _trivialState.players = players;
}

export function clearTrivialGameState() {
    _trivialState = null;
}
