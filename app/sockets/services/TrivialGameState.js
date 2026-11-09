/**
 * @fileoverview Redis-backed state for active trivial games (cluster-safe)
 * @module sockets/services/TrivialGameState
 *
 * State is stored in Redis so all PM2 workers share it.
 * `board.graph` (a Map) is not JSON-serializable, so we store only N and M
 * and rebuild the graph on every get. Answer timers stay in local memory.
 */

const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');
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
        _boardCgPositions: board?.cgPositions
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
            cgPositions:
                _boardCgPositions || Array.from({ length: _boardN }, (_, k) => Math.floor((k * _boardM) / _boardN)),
            graph: buildBoardGraph(_boardN, _boardM)
        };
    }
    return rest;
}

function _newPlayer(teamName, categoryCount) {
    return { position: 'center', token: new Array(categoryCount).fill(false), teamName };
}

// Team mode: turn order is team names
function _buildTeamRoster(teams, categoryCount) {
    const players = {};
    const turnOrder = [];
    teams.forEach(team => {
        team.players.forEach(nick => {
            players[nick] = _newPlayer(team.name, categoryCount);
        });
        turnOrder.push(team.name);
    });
    return { players, turnOrder };
}

// Individual mode: turn order is player nicknames (lobbyPlayersMap is an Array of nickname strings)
function _buildIndividualRoster(lobbyPlayersMap, categoryCount) {
    const players = {};
    const turnOrder = [];
    for (const nick of lobbyPlayersMap) {
        if (nick === 'HOST') continue;
        players[nick] = _newPlayer(null, categoryCount);
        turnOrder.push(nick);
    }
    return { players, turnOrder };
}

// Fisher-Yates
function _shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
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
    const teams = isTeamMode && teamConfig?.teams ? teamConfig.teams : null;

    const { players, turnOrder } = teams ? _buildTeamRoster(teams, N) : _buildIndividualRoster(lobbyPlayersMap, N);
    _shuffleInPlace(turnOrder); // random first player each game

    const teamTokens = {};
    (teams || []).forEach(team => {
        teamTokens[team.name] = new Array(N).fill(false);
    });

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

/**
 * Lee el estado Trivial de Redis y le añade el temporizador de respuesta local del worker. Si Redis falla o el JSON
 * guardado está corrupto lo registra y devuelve null.
 * @param {string} roomId - ID de sesión
 * @returns {Promise<Object|null>} Estado, o null si no hay o falla Redis
 */
async function getTrivialState(roomId) {
    try {
        const client = await getRedisClient();
        const json = await client.get(_redisKey(roomId));
        const state = _deserialize(json);
        if (state) state.answerTimer = _answerTimers.get(roomId) || null;
        return state;
    } catch (err) {
        logger.error('TrivialGameState: no se pudo leer el estado', { roomId, error: err.message });
        return null;
    }
}

/**
 * Guarda el estado Trivial en Redis (TTL de sesión); el temporizador de respuesta se queda en el worker. Si Redis falla
 * lo registra y no lanza.
 * @param {string} roomId - ID de sesión
 * @param {Object} state - Estado Trivial
 * @returns {Promise<void>}
 */
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
        logger.error('TrivialGameState: no se pudo guardar el estado', { roomId, error: err.message });
    }
}

/**
 * Borra el estado Trivial y cancela su temporizador de respuesta. Si Redis falla lo registra y no lanza.
 * @param {string} roomId - ID de sesión
 * @returns {Promise<void>}
 */
async function deleteTrivialState(roomId) {
    try {
        const timer = _answerTimers.get(roomId);
        if (timer) {
            clearTimeout(timer);
            _answerTimers.delete(roomId);
        }
        const client = await getRedisClient();
        await client.del(_redisKey(roomId));
    } catch (err) {
        logger.warn('TrivialGameState: no se pudo borrar el estado', { roomId, error: err.message });
    }
}

/**
 * Indica si la sala tiene estado Trivial en Redis.
 * @param {string} roomId - ID de sesión
 * @returns {Promise<boolean>} false también si falla Redis (lo registra)
 */
async function isTrivialGame(roomId) {
    try {
        const client = await getRedisClient();
        return (await client.exists(_redisKey(roomId))) === 1;
    } catch (err) {
        logger.warn('TrivialGameState: no se pudo comprobar el estado', { roomId, error: err.message });
        return false;
    }
}

/**
 * Jugador (o equipo, en modo equipos) al que le toca.
 * @param {Object} state - Estado Trivial
 * @returns {string} Apodo o nombre de equipo
 */
function getCurrentTurnActor(state) {
    return state.turnOrder[state.currentTurnIndex % state.turnOrder.length];
}

/**
 * Pasa el turno al siguiente y deja el estado esperando la tirada (borra dado, casillas, pregunta y respuestas
 * pendientes).
 * @param {Object} state - Estado Trivial (se modifica)
 * @returns {void}
 */
function advanceTurn(state) {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
    state.phase = 'waiting_roll';
    state.currentQuestion = null;
    state.diceValue = null;
    state.availablePositions = [];
    state.pendingAnswers = {};
}

/**
 * Ficha de quesitos del jugador; en modo equipos, la de su equipo.
 * @param {Object} state - Estado Trivial
 * @param {string} nickname - Apodo
 * @returns {boolean[]|null} Un booleano por categoría, o null
 */
function getPlayerToken(state, nickname) {
    if (state.teamMode) {
        const team = state.players[nickname]?.teamName;
        return team ? state.teamTokens[team] : null;
    }
    return state.players[nickname]?.token || null;
}

/**
 * Indica si la ficha tiene todos los quesitos.
 * @param {boolean[]|null} token - Ficha
 * @returns {boolean} Falsy si no hay ficha
 */
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
    isAllTokensFilled
};
