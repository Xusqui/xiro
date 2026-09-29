/**
 * @fileoverview Redis-backed state for active trivial games (cluster-safe)
 * @module sockets/services/TrivialGameState
 *
 * State is stored in Redis so all PM2 workers share it.
 * `board.graph` (a Map) is not JSON-serializable, so we store only N and M
 * and rebuild the graph on every get. Answer timers stay in local memory.
 */

const { getRedisClient } = require('../../config/redis');
const { buildBoardGraph } = require('./TrivialBoardGraph');

const REDIS_PREFIX = 'trivial:state:';
const REDIS_TTL = 60 * 60 * 4; // 4 hours

// Local map for answer timers only (worker-local, acceptable)
const _answerTimers = new Map();

function _redisKey(roomId) {
    return REDIS_PREFIX + roomId;
}

/**
 * Serialize state for Redis storage.
 * Drops board.graph (rebuilt on load) and answerTimer (worker-local).
 */
function _serialize(state) {
    const { board, ...rest } = state;
    return JSON.stringify({
        ...rest,
        _boardN: board?.N,
        _boardM: board?.M,
        _boardCgPositions: board?.cgPositions,
    });
}

/**
 * Deserialize state from Redis and rebuild board.graph.
 */
function _deserialize(json) {
    if (!json) return null;
    const { _boardN, _boardM, _boardCgPositions, ...rest } = JSON.parse(json);
    if (_boardN !== null && _boardN !== undefined && _boardM !== null && _boardM !== undefined) {
        rest.board = {
            N: _boardN,
            M: _boardM,
            cgPositions: _boardCgPositions || Array.from({ length: _boardN }, (_, k) => Math.floor(k * _boardM / _boardN)),
            graph: buildBoardGraph(_boardN, _boardM),
        };
    }
    return rest;
}

/**
 * @typedef {Object} TrivialState
 * @property {number} trivialId
 * @property {string} pin
 * @property {Array} categories - [{id, category_name, color, bank_id, position}]
 * @property {number} outerCasillas
 * @property {Object} players - {nickname: {position, token: bool[], teamName}}
 * @property {Array} turnOrder - [nickname | teamName]
 * @property {number} currentTurnIndex
 * @property {string} phase - 'waiting_roll'|'waiting_move'|'waiting_answer'|'showing_result'
 * @property {Object|null} currentQuestion
 * @property {number|null} diceValue
 * @property {Array} availablePositions
 * @property {boolean} teamMode
 * @property {Object} teamConfig
 * @property {Object} teamTokens - {teamName: bool[]} (when teamMode)
 * @property {Object} pendingAnswers - {nickname: answer} (majority vote)
 * @property {Object} scores - {nickname|teamName: number}
 */

function createTrivialState(trivialData, lobbyPlayersMap, isTeamMode, teamConfig) {
    const cats = trivialData.categories || [];
    const N = cats.length;

    // Build initial player list
    const players = {};
    const turnOrder = [];

    if (isTeamMode && teamConfig?.teams) {
        // Team mode: turn order is team names
        teamConfig.teams.forEach(team => {
            team.players.forEach(nick => {
                players[nick] = {
                    position: 'center',
                    token: new Array(N).fill(false),
                    teamName: team.name
                };
            });
            turnOrder.push(team.name);
        });
    } else {
        // Individual mode: turn order is player nicknames
        // lobbyPlayersMap is an Array of nickname strings
        for (const nick of lobbyPlayersMap) {
            if (nick === 'HOST') continue;
            players[nick] = {
                position: 'center',
                token: new Array(N).fill(false),
                teamName: null
            };
            turnOrder.push(nick);
        }
    }

    // Shuffle turnOrder (Fisher-Yates) — random first player each game
    for (let i = turnOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }

    const teamTokens = {};
    if (isTeamMode && teamConfig?.teams) {
        teamConfig.teams.forEach(team => {
            teamTokens[team.name] = new Array(N).fill(false);
        });
    }

    return {
        trivialId: trivialData.id,
        pin: trivialData.pin,
        categories: cats,
        outerCasillas: trivialData.outer_casillas,
        players,
        turnOrder,
        currentTurnIndex: 0,
        phase: 'waiting_roll',
        currentQuestion: null,
        diceValue: null,
        availablePositions: [],
        teamMode: isTeamMode,
        teamConfig: teamConfig || null,
        teamTokens,
        pendingAnswers: {},
        scores: {},
        askedQuestionIds: []
    };
}

async function getTrivialState(roomId) {
    try {
        const client = await getRedisClient();
        const json = await client.get(_redisKey(roomId));
        const state = _deserialize(json);
        if (state) state.answerTimer = _answerTimers.get(roomId) || null;
        return state;
    } catch (err) {
        return null;
    }
}

async function setTrivialState(roomId, state) {
    try {
        // Persist timer locally, not in Redis
        if (state.answerTimer !== undefined) {
            if (state.answerTimer) _answerTimers.set(roomId, state.answerTimer);
            else _answerTimers.delete(roomId);
        }
        const client = await getRedisClient();
        await client.setEx(_redisKey(roomId), REDIS_TTL, _serialize(state));
    } catch (err) {
        // ignore
    }
}

async function deleteTrivialState(roomId) {
    try {
        const timer = _answerTimers.get(roomId);
        if (timer) { clearTimeout(timer); _answerTimers.delete(roomId); }
        const client = await getRedisClient();
        await client.del(_redisKey(roomId));
    } catch (err) {
        // ignore
    }
}

async function isTrivialGame(roomId) {
    try {
        const client = await getRedisClient();
        return (await client.exists(_redisKey(roomId))) === 1;
    } catch (err) {
        return false;
    }
}

function getCurrentTurnActor(state) {
    return state.turnOrder[state.currentTurnIndex % state.turnOrder.length];
}

function advanceTurn(state) {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
    state.phase = 'waiting_roll';
    state.currentQuestion = null;
    state.diceValue = null;
    state.availablePositions = [];
    state.pendingAnswers = {};
}

function getPlayerToken(state, nickname) {
    if (state.teamMode) {
        const team = state.players[nickname]?.teamName;
        return team ? state.teamTokens[team] : null;
    }
    return state.players[nickname]?.token || null;
}

function isAllTokensFilled(token) {
    return token && token.every(Boolean);
}

module.exports = {
    createTrivialState,
    getTrivialState,
    setTrivialState,
    deleteTrivialState,
    isTrivialGame,
    getCurrentTurnActor,
    advanceTurn,
    getPlayerToken,
    isAllTokensFilled,
};
