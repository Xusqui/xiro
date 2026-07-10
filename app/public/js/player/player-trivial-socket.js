/**
 * @fileoverview Player - Socket handlers para Trivial
 *
 * Architecture: answers go through the STANDARD pipeline (submit-answer / answer-result).
 * This module only handles board-specific events:
 *   trivial-game-started, trivial-dice-rolled, trivial-player-moved,
 *   trivial-turn-changed, trivial-token-update, trivial-winner, trivial-game-ended, trivial-error
 *
 * The standard new-question handler in player-game-flow.js renders questions as usual.
 */

import { getSocket } from './player-socket-config.js?v=20260710133645';
import { getNickname, getSessionId } from './player-state.js?v=20260710133645';
import {
    showDiceScreen, showMoveSelection,
    showTrivialWaiting, registerTrivialPlayerActions
} from './player-trivial-ui.js?v=20260710133645';
import { showTrivialWinnerScreen } from './player-trivial-winner.js?v=20260710133645';
import {
    initTrivialTeamState, isMeTurnTeamAware, isMyTeamActor, clearTrivialTeamState
} from './player-trivial-team.js?v=20260710133645';
import {
    setTrivialBadgesVisible,
    setTrivialBadgeCategories,
    syncTrivialBadgesFromPayload,
    clearTrivialBadges
} from './player-trivial-badges-ui.js?v=20260710133645';
import { cancelStreakAnimation } from './player-streak-ui.js?v=20260710133645';

function myNickname() { return getNickname(); }

// Timer handle for the delayed showMoveSelection call after dice roll.
// Cleared when trivial-player-moved arrives to avoid overwriting the question UI.
let _pendingMoveSelectionTimer = null;

// Categories received at game start — { category_name, color }[]
// Persisted in sessionStorage to survive iOS Safari page reloads between turns.
const _CATS_KEY = 'xiro_trivial_categories';
let _trivialCategories = (() => {
    try { return JSON.parse(sessionStorage.getItem(_CATS_KEY) || '[]'); } catch { return []; }
})();
function _saveCategories(cats) {
    _trivialCategories = cats;
    try { sessionStorage.setItem(_CATS_KEY, JSON.stringify(cats)); } catch { /* quota */ }
}

export function registerTrivialPlayerSocketHandlers() {
    registerTrivialPlayerActions();
    const socket = getSocket();

    socket.on('trivial-game-started', (data) => {
        _saveCategories(data.categories || []);
        setTrivialBadgeCategories(data.categories || []);
        syncTrivialBadgesFromPayload(data);
        initTrivialTeamState(data, myNickname());
        const isMe = isMeTurnTeamAware(data.currentTurn, myNickname());
        showDiceScreen(data.currentTurn, isMe);
    });

    socket.on('trivial-dice-rolled', ({ nickname, diceValue, availablePositions, positionLabels, positionColors, categories }) => {
        setTrivialBadgesVisible(true);
        const isMe = nickname === myNickname();
        // Si el servidor envía categorías frescas, actualizar las locales
        if (categories && categories.length > 0) {
            _saveCategories(categories);
            setTrivialBadgeCategories(categories);
        }
        // La cara del dado ya está visible en la pantalla del que lanzó
        // (la animación completa ANTES de emitir). Mostramos las casillas
        // disponibles tras una breve pausa para que el jugador aprecie el resultado.
        // We store the timer so it can be cancelled if the move happens before it fires
        // (race condition: presenter clicks board before 700ms → question shown → timer fires → question destroyed).
        if (_pendingMoveSelectionTimer) clearTimeout(_pendingMoveSelectionTimer);
        _pendingMoveSelectionTimer = setTimeout(() => {
            _pendingMoveSelectionTimer = null;
            showMoveSelection(availablePositions, positionLabels || [], isMe, positionColors || [], _trivialCategories);
        }, 700);
    });

    socket.on('trivial-player-moved', ({ nickname, position, movedPlayers }) => {
        setTrivialBadgesVisible(true);
        // Cancel any pending showMoveSelection timer – the move already happened and the
        // question will arrive soon; firing showMoveSelection now would destroy that UI.
        if (_pendingMoveSelectionTimer) {
            clearTimeout(_pendingMoveSelectionTimer);
            _pendingMoveSelectionTimer = null;
        }
        const displayName = movedPlayers?.length > 1 ? 'El equipo' : nickname;
        if (nickname === myNickname() || movedPlayers?.includes(myNickname())) {
            showTrivialWaiting('Moviendo... Preparando pregunta.');
        } else {
            showTrivialWaiting(`${displayName} se movió. Esperando pregunta...`);
        }
    });

    socket.on('trivial-choose-category', ({ categories, actorNick }) => {
        setTrivialBadgesVisible(true);
        if (isMyTeamActor(actorNick, myNickname())) {
            // Soy el actor — muestro los botones para elegir categoría
            const btns = (categories || []).map(c =>
                `<button data-player-action="trivial-category" data-category-index="${c.index}"
                    style="background:${c.color};color:#fff;border:none;border-radius:12px;
                           padding:12px 18px;font-weight:900;font-size:1rem;cursor:pointer;
                           text-transform:uppercase;width:100%;box-shadow:0 4px 12px ${c.color}66">
                    ${c.name}
                </button>`
            ).join('');
            const root = document.getElementById('game-area') || document.getElementById('jugador-content') || document.getElementById('main-container') || document.body;
            root.innerHTML = _tHtml(`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:100%;gap:12px;padding:20px;background:#0f172a">
                <p style="color:#fbbf24;font-size:1.2rem;font-weight:900;text-align:center;margin-bottom:8px">🎯 ¡Casilla central!</p>
                <p style="color:#fff;font-size:1rem;text-align:center;margin-bottom:4px">Elige una categoría:</p>
                <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:300px">${btns}</div>
            </div>`);
        } else {
            showTrivialWaiting(`🎯 Casilla central — ${actorNick} está eligiendo categoría...`);
        }
    });

    window.trivialChooseCategoryPlayer = (categoryIndex) => {
        const s = getSocket();
        s.emit('trivial-category-chosen', { roomId: getSessionId(), categoryIndex });
        showTrivialWaiting('Categoría elegida. Preparando pregunta...');
    };

    // trivial-question is no longer sent. Standard new-question handles question display.
    // trivial-answer-result is no longer sent. Standard answer-result handles it.

    socket.on('trivial-winner', () => {
        clearTrivialBadges();
        showTrivialWinnerScreen();
    });

    // trivial-token-update: wedge earned — nothing visible for the player beyond the waiting screen
    socket.on('trivial-token-update', (data) => {
        syncTrivialBadgesFromPayload(data);
    });

    // Cancel token: prevents a delayed showDiceScreen from a stale turn-changed
    // event from overwriting a newer one that arrived immediately after.
    let _turnChangeTimer = null;

    socket.on('trivial-turn-changed', ({ currentTurn, rollAgain, players, teamTokens }) => {
        // Always cancel any pending deferred screen transition first
        if (_turnChangeTimer) { clearTimeout(_turnChangeTimer); _turnChangeTimer = null; }

        // Cancel any pending streak animation render. If the presenter advances before
        // the 2000ms streak overlay finishes, the deferred _render() inside
        // applyStreakToResult would overwrite the dice screen with the green result HTML.
        // Setting _animationCancelled = true (markAsCancelled=true) prevents that render.
        cancelStreakAnimation(true);

        if (players || teamTokens) {
            syncTrivialBadgesFromPayload({ players, teamTokens });
        } else {
            setTrivialBadgesVisible(true);
        }

        const isMe = isMeTurnTeamAware(currentTurn, myNickname());
        if (rollAgain && isMe) {
            // Correct answer — show dice screen immediately with a congratulation title
            showDiceScreen(currentTurn, true, `¡Acertaste, ${currentTurn}! Lanza\uD83C\uDFAF`);
        } else if (rollAgain) {
            showTrivialWaiting(`¡${currentTurn} acierta!`, {
                icon: '🎯',
                subtitle: 'Vuelve a tirar…',
                color: '#fbbf24'
            });
        } else if (!isMe) {
            showTrivialWaiting('¡Cambio de turno!', {
                icon: '🔄',
                subtitle: `Turno de ${currentTurn}`,
                color: '#34d399',
                noDots: true
            });
            _turnChangeTimer = setTimeout(() => { _turnChangeTimer = null; showDiceScreen(currentTurn, false); }, 1200);
        } else {
            showDiceScreen(currentTurn, true);
        }
    });

    socket.on('trivial-game-ended', () => {
        clearTrivialTeamState();
        _saveCategories([]);
        clearTrivialBadges();
        showTrivialWaiting(_t('player.results.game_ended', null, 'La partida ha terminado.'));
    });

    socket.on('trivial-error', ({ message }) => {
        showTrivialWaiting(`⚠ ${message}`);
    });

}

