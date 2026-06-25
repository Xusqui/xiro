/**
 * @fileoverview Presenter - Renderizador SVG del tablero Trivial
 *
 * Thin re-exports that delegate to window.TrivialShared (loaded via classic
 * <script> tags in presentador.html before this module executes).
 *
 * Three SVG layers managed by the shared code:
 *   #board-bg     – static background (circles, spokes, center). Rebuilt only on game start.
 *   #board-hilight – pulsing rings for available positions (clickable).
 *   #board-tokens  – player pieces that animate via CSS transition on transform.
 */

export function renderBoardBackground(container, state) {
    return TrivialShared.renderBoardBackground(container, state);
}

export function updateBoardTokens(players, categories, M, currentTurnNick, turnOrder) {
    return TrivialShared.updateBoardTokens(players, categories, M, currentTurnNick, turnOrder);
}

export function updateBoardTokensTeam(players, teamConfig, M, currentTurn, turnOrder) {
    return TrivialShared.updateBoardTokensTeam(players, teamConfig, M, currentTurn, turnOrder);
}

export function updateBoardHighlights(positions, onSelect, labels) {
    return TrivialShared.updateBoardHighlights(positions, onSelect, labels);
}

export function showTurnOrderOverlay(boardContainer, turnOrder) {
    return TrivialShared.showTurnOrderOverlay(boardContainer, turnOrder);
}

export function renderTrivialScoreboard() { } // kept for import compat

