/**
 * @fileoverview Player – Team-mode helpers for Trivial
 *
 * Stores the current player's team membership so that player-trivial-socket.js
 * can correctly determine turn and actor ownership when `currentTurn` or
 * `actorNick` is a team name rather than a player nickname.
 *
 * All exported functions are no-ops / fallback-safe when team mode is off.
 */

let _teamMode = false;
let _myTeamName = null;

/**
 * Called once when `trivial-game-started` is received.
 * Extracts team mode flag and the current player's team name from the payload.
 *
 * @param {Object} data        – trivial-game-started payload
 * @param {string} myNickname  – the local player's nickname
 */
export function initTrivialTeamState(data, myNickname) {
    _teamMode = !!data.teamMode;
    _myTeamName = _teamMode ? (data.players?.[myNickname]?.teamName ?? null) : null;
}

/** Returns true when the current game is in team mode. */
export function isTeamMode() { return _teamMode; }

/** Returns the local player's team name, or null in individual mode. */
export function getMyTeamName() { return _myTeamName; }

/**
 * Returns true when it is the local player's turn to act.
 *
 * – Individual mode: `currentTurn === myNickname`
 * – Team mode:       `currentTurn === myTeamName`
 *
 * @param {string} currentTurn – value from the socket event
 * @param {string} myNickname
 */
export function isMeTurnTeamAware(currentTurn, myNickname) {
    if (!_teamMode) return currentTurn === myNickname;
    return _myTeamName !== null && currentTurn === _myTeamName;
}

/**
 * Returns true when the local player should be the one acting
 * (rolling dice, choosing category on center tile).
 *
 * – Individual mode: `actorNick === myNickname`
 * – Team mode:       any member of the active team qualifies,
 *                    i.e. `actorNick === myTeamName`
 *
 * @param {string} actorNick  – actor identifier sent in the event
 * @param {string} myNickname
 */
export function isMyTeamActor(actorNick, myNickname) {
    if (!_teamMode) return actorNick === myNickname;
    return _myTeamName !== null && actorNick === _myTeamName;
}

/** Resets stored team state (call on game-ended / cleanup). */
export function clearTrivialTeamState() {
    _teamMode = false;
    _myTeamName = null;
}
