/**
 * @fileoverview Trivial board-phase reconnection UI
 *
 * Handles the specific case where a player reconnects while the
 * Trivial board is being shown on the presenter screen
 * (dice roll / cell selection / "otro jugador está tirando" screen).
 *
 * In a normal quiz, hasAnswered=true means "wait for results".
 * In Trivial, hasAnswered=true means "we are in board-navigation phase",
 * so we must show the appropriate board UI instead of the
 * "Ya has contestado esta pregunta" overlay.
 */

import { showDiceScreen, showTrivialWaiting, registerTrivialPlayerActions } from './player-trivial-ui.js?v=20260709205314';
import { getNickname } from './player-state.js?v=20260709205314';

/**
 * Restores the correct UI when the server snapshot signals that
 * the Trivial game is in board-navigation phase (between questions).
 *
 * - If it is the reconnecting player's turn → show dice screen
 * - Otherwise → show "waiting for actor" message
 *
 * @param {Object} snapshot - reconnected-success payload from server
 */
export function handleTrivialBoardPhaseReconnect(snapshot) {
    const actorNick = (snapshot.gameState?.trivialActorNick || '').toUpperCase();
    const myNick = (getNickname() || snapshot.nickname || '').toUpperCase();
    const isMyTurn = actorNick !== '' && actorNick === myNick;

    // Ensure global dice/move handlers are available (idempotent)
    registerTrivialPlayerActions();

    if (isMyTurn) {
        // The player is the actor — show the dice so they can roll
        showDiceScreen(myNick, true);
    } else {
        // Another player is the actor — show waiting message
        const msg = actorNick
            ? `${actorNick} está eligiendo casilla...`
            : 'Esperando turno en el tablero...';
        showTrivialWaiting(msg);
    }
}
