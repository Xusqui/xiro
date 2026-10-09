/**
 * @fileoverview Lobby player tracking for presenter remote mode.
 * Mirrors the presenter lobby: "Empezar" stays disabled with "Esperando jugadores..."
 * until at least one player has joined.
 */

const PRESENTER_NICKNAME = 'HOST';

/** Nicknames currently in the lobby (presenter excluded). */
const lobbyNicks = new Set();

function isPlayerNick(nick) {
    return typeof nick === 'string' && nick.length > 0 && nick !== PRESENTER_NICKNAME;
}

function nickOf(data) {
    return typeof data === 'string' ? data : data?.nickname;
}

/**
 * Replaces the tracked lobby with the given nickname list.
 * @param {string[]} players
 */
export function setLobbyPlayers(players) {
    lobbyNicks.clear();
    (Array.isArray(players) ? players : []).filter(isPlayerNick).forEach(nick => lobbyNicks.add(nick));
}

/** Handles `player-joined` / `player-rejoined`: trusts the server list when sent. */
export function applyPlayerJoined(data) {
    if (Array.isArray(data?.players)) setLobbyPlayers(data.players);
    const nick = nickOf(data);
    if (isPlayerNick(nick)) lobbyNicks.add(nick);
}

/** Handles `player-left`: trusts the server list when sent. */
export function applyPlayerLeft(data) {
    if (Array.isArray(data?.players)) setLobbyPlayers(data.players);
    lobbyNicks.delete(nickOf(data));
}

/** @returns {boolean} true when nobody is in the lobby yet */
export function isLobbyEmpty() {
    return lobbyNicks.size === 0;
}

/**
 * Updates the player counter and locks "Empezar" while the lobby is empty.
 * Must run after updatePrimaryButton(), which resets the label.
 * @param {boolean} isLobby
 */
export function syncLobbyStartButton(isLobby) {
    const btn = document.getElementById('btn-remote-primary');
    if (!btn) return;

    const waiting = isLobby && isLobbyEmpty();
    btn.disabled = waiting;
    btn.classList.toggle('is-waiting', waiting);
    if (!isLobby) return;

    const count = document.getElementById('remote-player-count');
    if (count) count.textContent = `${lobbyNicks.size} jugadores`;

    const label = btn.querySelector('span');
    if (waiting && label) label.textContent = _t('presenter.lobby.waiting', null, 'Esperando jugadores...');
}

/**
 * Translates a start error sent by the server (same keys as the presenter).
 * @param {{code?: string, message?: string, params?: Object}} data
 * @returns {string}
 */
export function startErrorMessage(data) {
    const fallback = data?.message || _t('presenter.session.start_error_title', null, 'Error al iniciar el juego');
    return data?.code
        ? _t(`presenter.session.start_error.${data.code}`, data.params || null, fallback)
        : fallback;
}
