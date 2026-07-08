// Presenter — Trivial socket handlers

import { getSocket } from './presenter-socket-config.js?v=20260708113433';
import { mostrarLobbyMain, showTerminateButton } from './presenter-utils.js?v=20260708113433';
import {
    setTrivialGameState, getTrivialGameState,
    updateTrivialPlayers, updateTrivialTurn, updateTrivialTokens, clearTrivialGameState
} from './presenter-trivial-state.js?v=20260708113433';
import {
    renderBoardBackground, updateBoardTokens, updateBoardTokensTeam,
    updateBoardHighlights, showTurnOrderOverlay
} from './presenter-trivial-board.js?v=20260708113433';
import { updatePlayersPanel } from './presenter-players-panel.js?v=20260708113433';
import { cleanupRevealElements } from './presenter-reveal.js?v=20260708113433';
import { mostrarModalConfirmacion } from '../shared/modal.js?v=20260708113433';
import { showTrivialWinnerOverlay, isWinnerOverlayActive } from './presenter-trivial-winner.js?v=20260708113433';

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
// Uses mostrarLobbyMain() — never touches #players-sidebar or #players-sidebar-list.

function buildTrivialLayout() {
    mostrarLobbyMain(`
        <div id="trv-status" style="flex-shrink:0;background:rgba(15,23,42,0.92);border-radius:12px;
                padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div id="trv-turn" style="color:#fbbf24;font-size:1.05rem;font-weight:900;letter-spacing:.5px"></div>
            <div id="trv-phase" style="color:#94a3b8;font-size:0.8rem;flex:1;padding-left:12px"></div>
        </div>
        <div style="flex:1;min-height:0;display:flex;gap:8px;align-items:stretch">
            <div id="trv-category-legend" style="width:clamp(140px,14vw,320px);flex-shrink:0;display:flex;flex-direction:column;gap:clamp(3px,0.5vh,14px);padding:clamp(4px,0.8vh,16px);background:rgba(15,23,42,0.6);border-radius:10px;overflow-y:auto"></div>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-width:0">
                <div id="trivial-board-svg" style="width:min(calc(100vh - 140px),100%);aspect-ratio:1/1;position:relative"></div>
            </div>
            <div id="trv-player-scores"
                 style="width:170px;flex-shrink:0;display:flex;flex-direction:column;gap:4px;
                        overflow-y:auto;padding:4px;background:rgba(15,23,42,0.6);border-radius:10px"></div>
        </div>`);
    showTerminateButton();
}

function buildCategoryLegend(state) {
    const el = document.getElementById('trv-category-legend');
    if (!el || !state?.categories?.length) return;
    el.innerHTML =
        _tHtml(`<div style="font-size:clamp(9px,0.85vw,18px);color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 4px 4px">Bancos</div>` +
            state.categories.map(c =>
                `<div style="display:flex;align-items:center;gap:clamp(5px,0.65vw,14px);padding:clamp(4px,0.6vh,14px) clamp(5px,0.75vw,16px);background:rgba(30,41,59,0.85);border-radius:8px;border-left:3px solid ${c.color || '#888'}">` +
                `<span style="width:clamp(10px,1.1vw,22px);height:clamp(10px,1.1vw,22px);border-radius:50%;flex-shrink:0;background:${c.color || '#888'};box-shadow:0 0 6px ${c.color || '#888'}aa"></span>` +
                `<span style="font-size:clamp(10px,1vw,20px);color:#fff;font-weight:700;line-height:1.3;word-break:break-word">${c.bank_name || c.category_name}</span></div>`
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
            const active = teamName === currentTurn;
            const bg = active ? 'rgba(234,179,8,0.18)' : 'rgba(51,65,85,0.5)';
            const border = active ? 'rgba(234,179,8,0.5)' : 'transparent';
            // Use state.teamTokens if available; otherwise fall back to the
            // union of individual player tokens (for legacy state shape)
            const rawTokens = state.teamTokens?.[teamName] ||
                (team.players?.[0] && players?.[team.players[0]]?.token) || [];
            const wedges = rawTokens.map((filled, i) => {
                const col = categories[i]?.color || '#888';
                return `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${col};` +
                    `opacity:${filled ? 1 : 0.2};box-shadow:${filled ? `0 0 6px 2px ${col}` : 'none'};` +
                    `border:1.5px solid rgba(255,255,255,${filled ? 0.9 : 0.2});margin:1px"></span>`;
            }).join('');
            const members = (team.players || []).join(', ');
            const pos = turnOrder.indexOf(teamName) + 1 || idx + 1;
            return `<div style="border-radius:8px;padding:5px 7px;background:${bg};border:1px solid ${border}">` +
                `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">` +
                `<span style="width:16px;height:16px;border-radius:50%;background:${color};color:#fff;font-size:9px;font-weight:900;` +
                `display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${pos}</span>` +
                `<span style="color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${teamName}</span></div>` +
                `<div style="display:flex;flex-wrap:wrap;gap:2px">${wedges}</div>` +
                (members ? `<div style="color:#94a3b8;font-size:8px;margin-top:3px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${members}</div>` : '') +
                `</div>`;
        }).join('');
        return;
    }

    // ── Individual mode ───────────────────────────────────────────────────────
    // Iterate in turnOrder so the numbered positions are stable
    const ordered = turnOrder.length ? turnOrder : Object.keys(players || {});
    panel.innerHTML = ordered.map((nick, idx) => {
        const p = players?.[nick];
        if (!p) return '';
        const pos = idx + 1;
        const active = nick === currentTurn;
        const bg = active ? 'rgba(234,179,8,0.18)' : 'rgba(51,65,85,0.5)';
        const border = active ? 'rgba(234,179,8,0.5)' : 'transparent';
        const wedges = (p.token || []).map((filled, i) => {
            const col = categories[i]?.color || '#888';
            return `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${col};` +
                `opacity:${filled ? 1 : 0.2};box-shadow:${filled ? `0 0 6px 2px ${col}` : 'none'};` +
                `border:1.5px solid rgba(255,255,255,${filled ? 0.9 : 0.2});margin:1px"></span>`;
        }).join('');
        return `<div style="border-radius:8px;padding:5px 7px;background:${bg};border:1px solid ${border}">` +
            `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">` +
            `<span style="width:16px;height:16px;border-radius:50%;background:#fbbf24;color:#1e293b;font-size:9px;font-weight:900;` +
            `display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${pos}</span>` +
            `<span style="color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${nick}</span></div>` +
            `<div style="display:flex;flex-wrap:wrap;gap:2px">${wedges}</div></div>`;
    }).join('') || '';
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
        updateBoardHighlights([], null);
    });

    socket.on('trivial-error', ({ message }) => {
        setStatus('', `⚠ ${message}`);
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

