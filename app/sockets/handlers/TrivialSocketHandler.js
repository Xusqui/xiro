/**
 * @fileoverview Trivial game socket handler (orquestador)
 *
 * Mecánica:
 *   1. El tablero es SELECTOR DE PREGUNTAS → pipeline estándar para cada casilla.
 *   2. TODOS los jugadores pueden contestar y obtienen puntos (sin auto-reveal).
 *   3. Si el actor (quien tiró) acierta, vuelve a tirar hasta MAX_CONSECUTIVE veces.
 *
 * Lógica específica separada en ./trivial/:
 *   TrivialMoveHandler.js   – movimiento y disparo de pregunta
 *   TrivialRevealHandler.js – post-reveal, cuñas y siguiente turno
 *   TrivialRollMechanic.js  – contador de tiradas consecutivas
 *
 * Public API: { handleStart, handleRollDice, handleMove, handleNextTurn, handlePostReveal, handleEndGame }
 */

const logger = require('../../config/logger');
const dbService = require('../../services/db');
const trivialState = require('../services/TrivialGameState');
const { buildBoardGraph, getReachablePositions, getCategoryForPosition } = require('../services/TrivialBoardGraph');
const { activeGames } = require('../../state/globalState');
const { SCORING } = require('../../config/game-constants');
const { getRedisClient } = require('../../config/redis');

const createMoveHandler = require('./trivial/TrivialMoveHandler');
const createRevealHandlers = require('./trivial/TrivialRevealHandler');
const createCenterHandler = require('./trivial/TrivialCenterHandler');

function getRoomIdFromPayload(data) {
    return String(data?.roomId || '').trim();
}

function isPresenterSocket(socket, roomId) {
    return socket.rooms.has(roomId + ':presenter');
}

function resolveCurrentActorNickname(state, actorOrTeamName, preferredNickname = '') {
    if (!state?.teamMode) {
        return actorOrTeamName;
    }

    if (preferredNickname && state.players[preferredNickname]?.teamName === actorOrTeamName) {
        return preferredNickname;
    }

    return Object.keys(state.players).find(
        nick => state.players[nick]?.teamName === actorOrTeamName
    ) || null;
}

function buildPlayers(state) {
    const out = {};
    for (const [nick, player] of Object.entries(state.players)) {
        out[nick] = {
            position: player.position,
            token: player.token,
            teamName: player.teamName
        };
    }
    return out;
}

function buildStreakConfig(trivialData) {
    return {
        use_streaks: !!trivialData.use_streaks,
        streak_threshold: trivialData.streak_threshold ?? SCORING.STREAK.DEFAULT_THRESHOLD,
        streak_bonus_percentage: trivialData.streak_bonus_percentage ?? SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE,
        use_double_streaks: !!trivialData.use_double_streaks,
        double_streak_threshold: trivialData.double_streak_threshold ?? SCORING.STREAK.DEFAULT_DOUBLE_THRESHOLD,
        double_streak_bonus_percentage: trivialData.double_streak_bonus_percentage ?? SCORING.STREAK.DEFAULT_DOUBLE_BONUS_PERCENTAGE
    };
}

function buildRandomPointsConfig(trivialData) {
    return {
        use_random_points: !!trivialData.use_random_points,
        random_points_min: trivialData.random_points_min ?? SCORING.RANDOM_POINTS.DEFAULT_MIN,
        random_points_max: trivialData.random_points_max ?? SCORING.RANDOM_POINTS.DEFAULT_MAX
    };
}

function createInitializedState(trivialData, playersInRoom, isTeamMode, teamConfig) {
    const state = trivialState.createTrivialState(trivialData, playersInRoom, isTeamMode, teamConfig);
    const categoryCount = trivialData.categories.length;
    const outerCasillas = trivialData.outer_casillas;
    const cgPositions = Array.from({ length: categoryCount }, (_, k) => Math.floor(k * outerCasillas / categoryCount));

    state.board = {
        N: categoryCount,
        M: outerCasillas,
        graph: buildBoardGraph(categoryCount, outerCasillas),
        cgPositions
    };
    state.consecutiveRolls = {};
    state.streakConfig = buildStreakConfig(trivialData);
    state.randomPointsConfig = buildRandomPointsConfig(trivialData);

    return state;
}

function persistActiveTrivialGame(roomId, playersInRoom, isTeamMode, trivialData) {
    const streakConfig = buildStreakConfig(trivialData);
    const randomPointsConfig = buildRandomPointsConfig(trivialData);

    activeGames.set(roomId, {
        pin: roomId,
        isTrivial: true,
        teamMode: !!isTeamMode,
        questions: [],
        currentIndex: 0,
        scores: {},
        players: playersInRoom,
        canAnswer: false,
        state: 'in-progress',
        startTime: Date.now(),
        gameStartTime: Date.now(),
        answerStats: {},
        revealedQuestions: new Set(),
        trivialMeta: null,
        trivialLastCorrect: null,
        answeredCurrent: new Set(),
        ...streakConfig,
        ...randomPointsConfig,
        currentRandomPoints: null
    });
}

function persistGameStartTimestamp(roomId) {
    Promise.resolve(getRedisClient())
        .then(redisClient => redisClient.set(`game:started:${roomId}`, String(Date.now()), { EX: 86400 }))
        .catch(() => { });
}

function emitTrivialStart(io, roomId, payload) {
    /* Both roles join roomId (shared) + their suffix room — single emit reaches all */
    io.to(roomId).emit('trivial-game-started', payload);
}

function buildTrivialStartPayload(state, categories) {
    return {
        categories,
        outerCasillas: state.board.M,
        players: buildPlayers(state),
        teamTokens: state.teamTokens,
        currentTurn: trivialState.getCurrentTurnActor(state),
        phase: 'waiting_roll',
        turnOrder: state.turnOrder,
        teamMode: !!state.teamMode,
        teamConfig: state.teamConfig || null
    };
}

function findEmptyTeam(isTeamMode, teamConfig) {
    if (!isTeamMode || !teamConfig || !Array.isArray(teamConfig.teams)) {
        return null;
    }

    return teamConfig.teams.find(team => !Array.isArray(team.players) || team.players.length === 0) || null;
}

function createStartHandler({ io, lobbyPlayers }) {
    return async function handleStart(socket, { roomId, isTeamMode, teamConfig }) {
        try {
            const emptyTeam = findEmptyTeam(isTeamMode, teamConfig);
            if (emptyTeam) {
                socket.emit('trivial-error', {
                    message: `El equipo "${emptyTeam.name}" no tiene jugadores`,
                    code: 'TEAM_WITHOUT_PLAYERS'
                });
                return;
            }

            const sessionPin = String(roomId).split('-')[0];
            const trivialData = await dbService.getTrivialGameByPin(sessionPin);

            if (!trivialData) {
                socket.emit('trivial-error', { message: 'Trivial no encontrado', code: 'TRIVIAL_GAME_NOT_FOUND' });
                return;
            }

            const playersInRoom = lobbyPlayers.get(roomId) || [];
            const state = createInitializedState(trivialData, playersInRoom, isTeamMode, teamConfig);

            await trivialState.setTrivialState(roomId, state);
            persistGameStartTimestamp(roomId);
            persistActiveTrivialGame(roomId, playersInRoom, isTeamMode, trivialData);

            const payload = buildTrivialStartPayload(state, trivialData.categories);
            emitTrivialStart(io, roomId, payload);

            logger.info('Trivial started', {
                roomId,
                N: state.board.N,
                M: state.board.M,
                players: Object.keys(state.players)
            });
        } catch (err) {
            logger.error('trivial-start error', { error: err.message, stack: err.stack });
            socket.emit('trivial-error', { message: 'Error iniciando trivial', code: 'TRIVIAL_START_FAILED' });
        }
    };
}

function logRollRequest(roomId, claimedNickname, socketNickname, state) {
    logger.info('trivial-roll-dice received', {
        roomId,
        claimedNickname,
        socketNickname,
        hasState: !!state,
        phase: state?.phase,
        turnOrder: state?.turnOrder,
        players: state ? Object.keys(state.players) : []
    });
}

function validateRollRequest(roomId, socket, state) {
    if (!roomId || !socket.rooms.has(roomId)) {
        return { message: 'No autorizado para esta sala', code: 'TRIVIAL_ROOM_UNAUTHORIZED' };
    }
    if (!state) {
        return {
            message: `Estado no encontrado para sala ${roomId}`,
            code: 'TRIVIAL_STATE_NOT_FOUND',
            params: { roomId }
        };
    }
    if (state.phase !== 'waiting_roll') {
        return {
            message: `Fase incorrecta: ${state.phase}`,
            code: 'TRIVIAL_INVALID_PHASE',
            params: { phase: state.phase }
        };
    }
    return null;
}

function resolveRollNickname(socket, roomId, state, claimedNickname) {
    const actor = trivialState.getCurrentTurnActor(state);
    const socketNickname = String(socket.data?.nickname || '').trim();
    const nickname = isPresenterSocket(socket, roomId)
        ? resolveCurrentActorNickname(state, actor, claimedNickname)
        : socketNickname;

    return { actor, nickname };
}

function validateRollActor(state, actor, nickname) {
    if (!nickname || !state.players[nickname]) {
        return 'Actor no autorizado para tirar el dado';
    }

    const teamName = state.players[nickname]?.teamName;
    const isMyTurn = state.teamMode ? teamName === actor : nickname === actor;
    if (!isMyTurn) {
        return `No es tu turno. Turno de: ${actor}`;
    }

    return null;
}

function validateDiceValue(clientValue) {
    if (!Number.isInteger(clientValue) || clientValue < 1 || clientValue > 6) {
        return 'Valor de dado inválido';
    }
    return null;
}

function buildPositionLabels(availablePositions) {
    return availablePositions.map((_, idx) => String.fromCharCode(65 + idx));
}

function applyRollToState(state, nickname, diceValue) {
    state.diceValue = diceValue;
    state.phase = 'waiting_move';

    const rollerPosition = state.players[nickname]?.position || 'center';
    state.availablePositions = getReachablePositions(rollerPosition, state.diceValue, state.board.graph);

    return {
        rollerPosition,
        positionLabels: buildPositionLabels(state.availablePositions)
    };
}

function buildPositionColors(state, roomId) {
    try {
        const { N, M, cgPositions } = state.board;
        return state.availablePositions.map(position => {
            const catIdx = getCategoryForPosition(position, N, M, cgPositions);
            if (catIdx === null || !state.categories[catIdx]) {
                return '#6b7280';
            }
            return state.categories[catIdx].color;
        });
    } catch (colorErr) {
        logger.warn('trivial: could not compute positionColors', { roomId, error: colorErr.message });
        return [];
    }
}

async function refreshBankNames(roomId, state) {
    try {
        const diceRollPin = String(roomId).split('-')[0];
        const freshTrivial = await dbService.getTrivialGameByPin(diceRollPin);

        if (!freshTrivial?.categories) {
            return;
        }

        freshTrivial.categories.forEach((freshCat, idx) => {
            if (state.categories[idx]) {
                state.categories[idx].bank_name = freshCat.bank_name;
            }
        });

        await trivialState.setTrivialState(roomId, state);
    } catch (refreshErr) {
        logger.warn('trivial: could not refresh bank names on dice roll', { roomId, error: refreshErr.message });
    }
}

function mapFreshCategories(state) {
    return state.categories.map(cat => ({
        category_name: cat.bank_name || cat.category_name || cat.name,
        color: cat.color
    }));
}

function emitDiceRoll(io, roomId, payload) {
    /* Both roles join roomId (shared) — single emit reaches all */
    io.to(roomId).emit('trivial-dice-rolled', payload);
}

function createRollDiceHandler({ io }) {
    return async function handleRollDice(socket, data) {
        const roomId = getRoomIdFromPayload(data);
        const claimedNickname = String(data?.nickname || '').trim();
        const socketNickname = String(socket.data?.nickname || '').trim();
        const clientValue = Number(data?.diceValue);
        const state = await trivialState.getTrivialState(roomId);

        logRollRequest(roomId, claimedNickname, socketNickname, state);

        const requestError = validateRollRequest(roomId, socket, state);
        if (requestError) {
            socket.emit('trivial-error', requestError);
            return;
        }

        const { actor, nickname } = resolveRollNickname(socket, roomId, state, claimedNickname);
        const actorError = validateRollActor(state, actor, nickname);
        if (actorError) {
            socket.emit('trivial-error', { message: actorError });
            return;
        }

        const diceError = validateDiceValue(clientValue);
        if (diceError) {
            socket.emit('trivial-error', { message: diceError });
            return;
        }

        const { rollerPosition, positionLabels } = applyRollToState(state, nickname, clientValue);
        await trivialState.setTrivialState(roomId, state);

        const positionColors = buildPositionColors(state, roomId);
        await refreshBankNames(roomId, state);

        emitDiceRoll(io, roomId, {
            nickname,
            diceValue: state.diceValue,
            availablePositions: state.availablePositions,
            positionLabels,
            positionColors,
            rollerPosition,
            categories: mapFreshCategories(state)
        });
    };
}

function createMoveBoundHandler({ handleMove }) {
    return async function handleMoveBound(socket, data) {
        const roomId = getRoomIdFromPayload(data);
        const claimedNickname = String(data?.nickname || '').trim();
        const socketNickname = String(socket.data?.nickname || '').trim();
        const position = data?.position;

        if (!roomId || !socket.rooms.has(roomId)) {
            socket.emit('trivial-error', { message: 'No autorizado para esta sala', code: 'TRIVIAL_ROOM_UNAUTHORIZED' });
            return;
        }

        const state = await trivialState.getTrivialState(roomId);
        if (!state) {
            socket.emit('trivial-error', {
                message: `Estado no encontrado para sala ${roomId}`,
                code: 'TRIVIAL_STATE_NOT_FOUND',
                params: { roomId }
            });
            return;
        }

        const actor = trivialState.getCurrentTurnActor(state);
        const nickname = isPresenterSocket(socket, roomId)
            ? resolveCurrentActorNickname(state, actor, claimedNickname)
            : socketNickname;

        if (!nickname || !state.players[nickname]) {
            socket.emit('trivial-error', { message: 'Actor no autorizado para mover', code: 'TRIVIAL_ACTOR_UNAUTHORIZED_MOVE' });
            return;
        }

        await handleMove(socket, { roomId, nickname, position });
    };
}

function createCategoryChosenBoundHandler({ handleCategoryChosen }) {
    return async function handleCategoryChosenBound(socket, data) {
        const roomId = getRoomIdFromPayload(data);
        const categoryIndex = data?.categoryIndex;

        if (!roomId || !socket.rooms.has(roomId)) {
            socket.emit('trivial-error', { message: 'No autorizado para esta sala', code: 'TRIVIAL_ROOM_UNAUTHORIZED' });
            return;
        }

        const state = await trivialState.getTrivialState(roomId);
        if (!state) {
            socket.emit('trivial-error', { message: 'Estado no encontrado', code: 'TRIVIAL_STATE_NOT_FOUND' });
            return;
        }

        if (state.phase !== 'choosing_category') {
            socket.emit('trivial-error', {
                message: `Fase incorrecta: ${state.phase}`,
                code: 'TRIVIAL_INVALID_PHASE',
                params: { phase: state.phase }
            });
            return;
        }

        if (!isPresenterSocket(socket, roomId)) {
            const socketNickname = String(socket.data?.nickname || '').trim();
            const actor = trivialState.getCurrentTurnActor(state);
            const teamName = state.players[socketNickname]?.teamName;
            const isActor = state.teamMode ? teamName === actor : socketNickname === actor;

            if (!isActor) {
                socket.emit('trivial-error', { message: 'No autorizado para elegir categoría', code: 'TRIVIAL_CATEGORY_UNAUTHORIZED' });
                return;
            }
        }

        await handleCategoryChosen(socket, { roomId, categoryIndex });
    };
}

module.exports = function createTrivialHandler({ io, lobbyPlayers }) {
    const { handleCenterLanding, handleCategoryChosen } = createCenterHandler({ io });
    const handleMove = createMoveHandler({ io, handleCenterLanding });
    const { handleNextTurn, handlePostReveal } = createRevealHandlers({ io });
    const handleStart = createStartHandler({ io, lobbyPlayers });
    const handleRollDice = createRollDiceHandler({ io });
    const handleMoveBound = createMoveBoundHandler({ handleMove });
    const handleCategoryChosenBound = createCategoryChosenBoundHandler({ handleCategoryChosen });

    async function handleEndGame(socket, { roomId }) {
        const { endTrivialGame } = require('../services/TrivialEndGameService');
        await endTrivialGame({ roomId, io });
    }

    return {
        handleStart,
        handleRollDice,
        handleMove: handleMoveBound,
        handleNextTurn,
        handlePostReveal,
        handleEndGame,
        handleCategoryChosen: handleCategoryChosenBound
    };
};
