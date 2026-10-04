// Presenter — Trivial socket handlers

import { getSocket } from './presenter-socket-config.js?v=20260922172926';
import { mostrarLobbyMain, showTerminateButton } from './presenter-utils.js?v=20260922172926';
import {
    setTrivialGameState, getTrivialGameState,
    updateTrivialPlayers, updateTrivialTurn, updateTrivialTokens, clearTrivialGameState
} from './presenter-trivial-state.js?v=20260922172926';
import {
    renderBoardBackground, updateBoardTokens, updateBoardTokensTeam,
    updateBoardHighlights, showTurnOrderOverlay
} from './presenter-trivial-board.js?v=20260922172926';
import { updatePlayersPanel } from './presenter-players-panel.js?v=20260922172926';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260922172926';
import { mostrarModalConfirmacion, mostrarModalMensaje } from '../shared/modal.js?v=20260922172926';
import { showTrivialWinnerOverlay, isWinnerOverlayActive } from './presenter-trivial-winner.js?v=20260922172926';
import { escapeHtml } from '../core/sanitize.js?v=20260922172926';

function getSession() { return new URLSearchParams(window.location.search).get('session'); }

/** Dispatches to the team-mode or individual board-token renderer. */
function callUpdateBoardTokens(state) {
    if (!state?.players) return;
    // Detect team mode from state.teamMode OR from players having a teamName field
    const isTeamMode = state.teamMode || Object.values(state.players).some(p => p.teamName);
    if (isTeamMode) {
        // Rebuild teamConfig from players if missing
        let teamCfg = state.teamConfig;
        if (!teamCfg?.teams?.length) {
            const teamMap = {};
            Object.entries(state.players).forEach(([nick, p]) => {
                if (!p.teamName) return;
                if (!teamMap[p.teamName]) teamMap[p.teamName] = { name: p.teamName, color: '#888', players: [] };
                teamMap[p.teamName].players.push(nick);
            });
            teamCfg = { teams: Object.values(teamMap) };
        }
        updateBoardTokensTeam(
            state.players, teamCfg, state.outerCasillas,
            state.currentTurn, state.turnOrder
        );
    } else {
        updateBoardTokens(
            state.players, state.categories, state.outerCasillas,
            state.currentTurn, state.turnOrder
        );
    }
}

// ─── Layout ──────────────────────────────────────────────────────────────────
// El tablero va en #lobby-main (mostrarLobbyMain). La clasificación (quesitos)
// va en la columna del escenario, junto a #players-sidebar-list (que no se
// toca: presenter.css la oculta mientras está la clasificación), así sigue
// visible también durante las preguntas, cuando #lobby-main se sustituye.

function ensureSidebarStandings() {
    if (document.getElementById('trv-player-scores')) return;
    const header = document.getElementById('players-sidebar')?.firstElementChild;
    if (header) header.insertAdjacentHTML('afterend', '<div id="trv-player-scores" class="trv-standings"></div>');
}

function removeSidebarStandings() {
    document.getElementById('trv-player-scores')?.remove();
}

function buildTrivialLayout() {
    mostrarLobbyMain(`
        <div id="trv-status" class="trv-status">
            <div id="trv-turn" class="trv-turn"></div>
            <div id="trv-phase" class="trv-phase"></div>
        </div>
        <div style="flex:1;min-height:0;display:flex;gap:8px;align-items:stretch">
            <div id="trv-category-legend" style="width:clamp(140px,14vw,320px);flex-shrink:0;display:flex;flex-direction:column;gap:clamp(3px,0.5vh,14px);padding:clamp(4px,0.8vh,16px);background:rgba(15,23,42,0.6);border-radius:10px;overflow-y:auto"></div>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-width:0">
                <div id="trivial-board-svg" style="width:min(calc(100vh - 140px),100%);aspect-ratio:1/1;position:relative"></div>
            </div>
        </div>`);
    ensureSidebarStandings();
    showTerminateButton();
}

function buildCategoryLegend(state) {
    const el = document.getElementById('trv-category-legend');
    if (!el || !state?.categories?.length) return;
    el.innerHTML =
        _tHtml(`<div style="font-size:clamp(9px,0.85vw,18px);color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 4px 4px">Bancos</div>` +
            state.categories.map(c =>
                `<div style="display:flex;align-items:center;gap:clamp(5px,0.65vw,14px);padding:clamp(4px,0.6vh,14px) clamp(5px,0.75vw,16px);background:rgba(30,41,59,0.85);border-radius:8px;">` +
                `<span style="width:clamp(10px,1.1vw,22px);height:clamp(10px,1.1vw,22px);border-radius:50%;flex-shrink:0;background:${c.color || '#888'};box-shadow:0 0 6px ${c.color || '#888'}aa"></span>` +
                `<span style="font-size:clamp(10px,1vw,20px);color:#fff;font-weight:700;line-height:1.3;word-break:break-word">${escapeHtml(c.bank_name || c.category_name)}</span></div>`
            ).join(''));
}

function setStatus(turn, phase) {
    const t = document.getElementById('trv-turn');
    const p = document.getElementById('trv-phase');
    if (t) t.textContent = turn ? _t('presenter.trivial.turn_label', { turn }, `🎲 Turno: ${turn}`) : '';
    if (p) p.textContent = _t(phase || '');
}

function refreshPlayerScores(state) {
    const panel = document.getElementById('trv-player-scores');
    if (!panel || !state) return;
    const { categories, players, currentTurn, turnOrder = [] } = state;

    // ── Team mode: one row per team ──────────────────────────────────────────
    // Detect team mode from state.teamMode OR from players having a teamName field
    // (the latter is a fallback if the server payload predates the teamMode field)
    const isTeamMode = state.teamMode || Object.values(players || {}).some(p => p.teamName);
    if (isTeamMode) {
        // Build teamConfig from players data if the payload didn't include it
        // (fallback for servers that haven't restarted after the teamConfig payload fix)
        let teamCfg = state.teamConfig;
        if (!teamCfg?.teams?.length && players) {
            const teamMap = {};
            Object.entries(players).forEach(([nick, p]) => {
                if (!p.teamName) return;
                if (!teamMap[p.teamName]) teamMap[p.teamName] = { name: p.teamName, color: '#888', players: [] };
                teamMap[p.teamName].players.push(nick);
            });
            teamCfg = { teams: Object.values(teamMap) };
        }
        if (!teamCfg?.teams?.length) return; // nothing to show yet

        panel.innerHTML = teamCfg.teams.map((team, idx) => {
            const teamName = team.name;
            const color = team.color || '#888';
            // Use state.teamTokens if available; otherwise fall back to the
            // union of individual player tokens (for legacy state shape)
            const rawTokens = state.teamTokens?.[teamName] ||
                (team.players?.[0] && players?.[team.players[0]]?.token) || [];
            const members = (team.players || []).map(member => escapeHtml(member)).join(', ');
            const pos = turnOrder.indexOf(teamName) + 1 || idx + 1;
            return standingRowHtml({
                pos, posColor: color, name: teamName, isTurn: teamName === currentTurn,
                wedges: wedgesHtml(rawTokens, categories), members
            });
        }).join('');
        return;
    }

    // ── Individual mode ───────────────────────────────────────────────────────
    // Iterate in turnOrder so the numbered positions are stable
    const ordered = turnOrder.length ? turnOrder : Object.keys(players || {});
    panel.innerHTML = ordered.map((nick, idx) => {
        const p = players?.[nick];
        if (!p) return '';
        return standingRowHtml({
            pos: idx + 1, name: nick, isTurn: nick === currentTurn,
            wedges: wedgesHtml(p.token, categories)
        });
    }).join('') || '';
}

/** Quesitos: uno por categoría, con su color; apagados hasta conseguirlos. */
function wedgesHtml(tokens, categories) {
    return (tokens || []).map((filled, i) => {
        const col = categories[i]?.color || '#888';
        return `<span class="trv-wedge${filled ? ' is-filled' : ''}" style="background:${col};color:${col}"></span>`;
    }).join('');
}

/** Fila de la clasificación (jugador o equipo) en la columna del escenario. */
function standingRowHtml({ pos, posColor, name, isTurn, wedges, members }) {
    const posStyle = posColor ? ` style="background:${posColor};color:#fff"` : '';
    return `<div class="trv-standing${isTurn ? ' is-turn' : ''}">` +
        `<div class="trv-standing-head"><span class="trv-standing-pos"${posStyle}>${pos}</span>` +
        `<span class="trv-standing-name">${escapeHtml(name)}</span></div>` +
        `<div class="trv-wedges">${wedges}</div>` +
        (members ? `<div class="trv-standing-members">${members}</div>` : '') +
        `</div>`;
}

export function registerTrivialSocketHandlers() {
    const socket = getSocket();

    socket.on('trivial-game-started', (data) => {
        window.isTrivialGame = true;
        setTrivialGameState({ ...data });
        buildTrivialLayout();
        updatePlayersPanel();
        const boardEl = document.getElementById('trivial-board-svg');
        if (boardEl) {
            renderBoardBackground(boardEl, data);
            callUpdateBoardTokens(getTrivialGameState());
            showTurnOrderOverlay(boardEl, data.turnOrder);
        }
        const stateAfterStart = getTrivialGameState();
        refreshPlayerScores(stateAfterStart);
        buildCategoryLegend(stateAfterStart);
        setStatus(data.currentTurn, _t('presenter.trivial.waiting_dice', null, 'Esperando que tire el dado'));
    });

    socket.on('trivial-dice-rolled', ({ nickname, diceValue, availablePositions, positionLabels }) => {
        setStatus(nickname, _t('presenter.trivial.rolled', { diceValue }, `Sacó ${diceValue} — toca una casilla brillante en el tablero`));
        const state = getTrivialGameState();
        updateBoardHighlights(availablePositions, (pos) => {
            updateBoardHighlights([], null);
            socket.emit('trivial-move', {
                roomId: getSession(),
                nickname: state?.currentTurn,
                position: pos
            });
        }, positionLabels || []);
    });

    socket.on('trivial-player-moved', ({ nickname, position, movedPlayers }) => {
        const state = getTrivialGameState();
        // Update all players that moved (in team mode, movedPlayers contains all team members)
        if (movedPlayers && Array.isArray(movedPlayers)) {
            movedPlayers.forEach(nick => {
                if (state?.players?.[nick]) state.players[nick].position = position;
            });
        } else if (state?.players?.[nickname]) {
            // Fallback for backward compatibility
            state.players[nickname].position = position;
        }
        callUpdateBoardTokens(state);
        setStatus(state?.currentTurn, _t('presenter.trivial.moved', { nickname, position }, `${nickname} movió → ${position}. Preparando pregunta...`));
    });

    socket.on('trivial-choose-category', ({ actorNick }) => {
        setStatus(actorNick, _t('presenter.trivial.choosing_category', { actorNick }, `🎯 Casilla central — ${actorNick} está eligiendo categoría...`));
    });

    socket.on('trivial-winner', ({ ranking }) => {
        window.isTrivialGame = false;
        clearTrivialGameState();
        removeSidebarStandings();
        updateBoardHighlights([], null);
        showTrivialWinnerOverlay(ranking);
    });

    // trivial-token-update: wedges earned mid-game — refresh the scores panel
    socket.on('trivial-token-update', (data) => {
        if (data.players) updateTrivialPlayers(data.players);
        if (data.teamTokens || data.players) updateTrivialTokens(data.teamTokens, data.players);
        const state = getTrivialGameState();
        callUpdateBoardTokens(state);
        refreshPlayerScores(state);
    });

    socket.on('trivial-turn-changed', (data) => {
        // Ignore turn events once the winner overlay is active
        if (isWinnerOverlayActive()) return;

        cleanupRevealElements();
        if (data.players) updateTrivialPlayers(data.players);
        updateTrivialTurn(data.currentTurn, data.phase);
        // Rebuild the board layout — the standard question pipeline may have replaced #lobby-main
        buildTrivialLayout();
        const boardEl = document.getElementById('trivial-board-svg');
        const state = getTrivialGameState();
        if (boardEl && state?.outerCasillas) {
            renderBoardBackground(boardEl, state);
        }
        callUpdateBoardTokens(state);
        refreshPlayerScores(state);
        buildCategoryLegend(state);
        updateBoardHighlights([], null);
        if (data.rollAgain) {
            setStatus(data.currentTurn, _t('presenter.trivial.roll_again', { nick: data.currentTurn }, `¡${data.currentTurn} acierta! Vuelve a tirar...`));
        } else {
            setStatus(data.currentTurn, _t('presenter.trivial.waiting_dice', null, 'Esperando que tire el dado'));
        }
    });

    socket.on('trivial-game-ended', () => {
        // NOTE: no longer emitted by the backend on normal game end (endTrivialGame uses
        // game-ended instead). Only kept for edge-cases (e.g. abort from admin).
        // Do NOT clear #lobby-main here – the game-ended handler renders the podium
        // and clearing the DOM would destroy it.
        window.isTrivialGame = false;
        clearTrivialGameState();
        removeSidebarStandings();
        updateBoardHighlights([], null);
    });

    socket.on('trivial-error', ({ message }) => {
        // Antes de que arranque la partida, el tablero (#trv-turn) aún no existe
        // -> mostrar modal en vez de escribir en un status invisible.
        if (document.getElementById('trv-turn')) {
            setStatus('', `⚠ ${message}`);
        } else {
            mostrarModalMensaje(_t('presenter.trivial.start_error_title', null, 'Error al iniciar el juego'), message, 'error');
        }
    });

    window.trivialEndGame = () => {
        mostrarModalConfirmacion(
            _t('presenter.trivial.end_confirm_title', null, '¿Terminar partida?'),
            _t('presenter.trivial.end_confirm_msg', null, 'Si confirmas, se finalizará el juego y se mostrará el podio con la clasificación actual.'),
            () => getSocket().emit('trivial-end-game', { roomId: getSession() }),
            null,
            _t('presenter.trivial.end_confirm_yes', null, 'Sí, terminar'),
            _t('presenter.trivial.cancel', null, 'Cancelar'),
            'warning'
        );
    };
}

