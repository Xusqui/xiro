/**
 * @fileoverview Trivial - lógica de movimiento en el tablero
 *
 * Cuando el jugador elige casilla:
 *   - Si no tiene categoría → avanza turno
 *   - Si tiene categoría → carga pregunta, actualiza activeGames y dispara el
 *     pipeline estándar: question.revealed → new-question → submit-answer → reveal
 *
 * Todos los jugadores pueden responder y obtener puntos.
 * El auto-reveal está desactivado para trivial (se controla por timer/presentador).
 */

'use strict';

const logger = require('../../../config/logger');
const dbService = require('../../../services/db');
const trivialState = require('../../services/TrivialGameState');
const { getCategoryForPosition } = require('../../services/TrivialBoardGraph');
const EventBus = require('../../../domain/events/EventBus');
const { QuestionRevealedEvent } = require('../../../domain/events/GameEvents');
const { startTimer } = require('../../utils/TimerManager');
const { activeGames } = require('../../../state/globalState');
const { RedisSyncBus } = require('../../sync/RedisSyncBus');
const { getRedisClient } = require('../../../config/redis');
const answerStatsStore = require('../../../services/AnswerStatsStore');
const { shuffle } = require('../../../services/game.logic');
const { generateScrambledLetters, normalizeWord } = require('../../../domain/services/WordScrambleService');
const { prepareWordSearchLogged } = require('../../utils/QuestionPreparation');
const { assignRandomPointsForCurrentQuestion } = require('../../utils/QuestionTransitionManager');
const { runRandomPointsReveal } = require('../../utils/RandomPointsRevealManager');

/**
 * Construye la entrada de activeGames para un juego trivial.
 * Se invoca tanto si no existe aún (worker distinto al inicial) como para
 * refrescar datos críticos en cada pregunta.
 */
function _buildGameEntry(state, roomId) {
    return {
        pin: roomId,
        roomId,                          // ← full session ID para checkAllPlayersAnswered
        isTrivial: true,
        teamMode: !!state?.teamMode,
        questions: [],
        currentIndex: 0,
        scores: Object.fromEntries(Object.keys(state.players).map(n => [n, 0])),
        players: Object.keys(state.players),   // ← TODOS los jugadores
        canAnswer: false,
        state: 'in-progress',
        startTime: Date.now(),
        answerStats: {},
        revealedQuestions: new Set(),
        answeredCurrent: new Set(),
        trivialMeta: null,
        trivialLastCorrect: null,
        trivialQuestionEpoch: 0
    };
}

function _buildPlayers(state) {
    const out = {};
    for (const [nick, player] of Object.entries(state.players || {})) {
        out[nick] = {
            position: player.position,
            token: player.token,
            teamName: player.teamName
        };
    }
    return out;
}

function _emitTurnChanged(io, roomId, state) {
    const payload = {
        currentTurn: trivialState.getCurrentTurnActor(state),
        phase: 'waiting_roll',
        players: _buildPlayers(state),
        teamTokens: state.teamTokens
    };
    /* Both roles join roomId (shared) — single emit reaches all */
    io.to(roomId).emit('trivial-turn-changed', payload);
}

function applyMoveToPlayers(state, nickname, position) {
    const teamName = state.players[nickname]?.teamName;
    let movedPlayers = [nickname];

    if (state.teamMode && teamName) {
        movedPlayers = Object.keys(state.players)
            .filter(playerNick => state.players[playerNick].teamName === teamName);
        movedPlayers.forEach(playerNick => {
            state.players[playerNick].position = position;
        });
    } else {
        state.players[nickname].position = position;
    }

    return { teamName, movedPlayers };
}

function emitPlayerMoved(io, roomId, payload) {
    /* Both roles join roomId (shared) — single emit reaches all */
    io.to(roomId).emit('trivial-player-moved', payload);
}

async function advanceTurnAndNotify(io, roomId, state) {
    trivialState.advanceTurn(state);
    await trivialState.setTrivialState(roomId, state);
    _emitTurnChanged(io, roomId, state);
}

function fetchTrivialQuestion(state, catIdx, roomId) {
    const category = state.categories[catIdx];
    logger.debug('trivial handleMove: fetching question', {
        roomId,
        catIdx,
        category: category.category_name
    });

    return dbService.getTrivialCategoryQuestion(
        category.source_type || 'bank',
        category.source_id || category.bank_id,
        state.askedQuestionIds.slice(-50)
    );
}

function normalizeQuestion(question, roomId) {
    const mappedOptions = (question.options || []).map(option => ({
        ...option,
        optionText: option.option_text ?? option.optionText ?? '',
        isCorrect: option.is_correct ?? option.isCorrect ?? false,
        orderIndex: option.order_index ?? option.orderIndex ?? 0
    }));

    const options = question.question_type === 'order' ? mappedOptions : shuffle(mappedOptions);
    if (question.question_type === 'order') {
        logger.debug('trivial handleMove: order question — options NOT shuffled', {
            roomId,
            questionId: question.id
        });
    }

    const normalizedQuestion = { ...question, options };
    if (normalizedQuestion.question_type === 'word_scramble') {
        const word = normalizedQuestion.correct_word || '';
        normalizedQuestion.scrambled_letters = generateScrambledLetters(word);
        normalizedQuestion.word_length = normalizeWord(word).length;
        normalizedQuestion.options = [];
    }
    if (normalizedQuestion.question_type === 'word_search') {
        return prepareWordSearchLogged(normalizedQuestion, { roomId, mode: 'trivial' });
    }

    return normalizedQuestion;
}

function ensureGameEntry(roomId, state) {
    let game = activeGames.get(roomId);
    if (!game) {
        game = _buildGameEntry(state, roomId);
        activeGames.set(roomId, game);
        logger.info('trivial handleMove: created activeGames entry', { roomId });
    }

    if (game.use_random_points === undefined && state.randomPointsConfig) {
        Object.assign(game, state.randomPointsConfig);
    }
    if (game.use_streaks === undefined && state.streakConfig) {
        Object.assign(game, state.streakConfig);
        logger.debug('trivial handleMove: streak config applied from state', {
            roomId,
            use_streaks: game.use_streaks
        });
    }

    return game;
}

function updateGameForQuestion(input) {
    const {
        game,
        roomId,
        state,
        normalizedQuestion,
        actorNick,
        catIdx,
        position
    } = input;

    const sessionPin = String(roomId).split('-')[0];

    game.roomId = roomId;
    game.players = Object.keys(state.players);
    game.questions = [normalizedQuestion];
    game.currentIndex = 0;
    game.canAnswer = true;
    game.answerStats = {};
    game.revealedQuestions = new Set();
    game.answeredCurrent = new Set();

    answerStatsStore.clearQuestion(roomId, 0).catch(() => { });
    answerStatsStore.clearQuestion(sessionPin, 0).catch(() => { });

    game.trivialMeta = { catIdx, position, actorNick };
    game.trivialCategoryName = state.categories[catIdx]?.category_name || null;
    game.trivialLastCorrect = null;
    game.trivialQuestionEpoch = (game.trivialQuestionEpoch || 0) + 1;
    game.questionStartTime = Date.now();
    assignRandomPointsForCurrentQuestion(game, roomId);
}

async function initRedisRoundAndPublish(roomId, game) {
    try {
        const redis = await getRedisClient();
        await Promise.all([
            redis.set(`trivial:lastcorrect:${roomId}`, '0', { EX: 3600 }),
            redis.del(`trivial:roundresults:${roomId}`),
            redis.del(`game:answered:${roomId}:${game.trivialQuestionEpoch - 1}`)
        ]);

        const allStreaks = await redis.hGetAll(`trivial:streaks:${roomId}`);
        if (allStreaks && Object.keys(allStreaks).length > 0) {
            if (!game.playerStreaks) {
                game.playerStreaks = {};
            }
            for (const [nick, value] of Object.entries(allStreaks)) {
                game.playerStreaks[nick] = Number(value);
            }
            logger.debug('trivial handleMove: merged player streaks from Redis', {
                roomId,
                playerStreaks: game.playerStreaks
            });
        }

        await RedisSyncBus.getInstance().publishGameStarted(roomId, game);
    } catch (err) {
        logger.warn('trivial: Redis init or publishGameStarted failed', {
            roomId,
            error: err.message
        });
    }
}

function dispatchQuestionPipeline(io, roomId, normalizedQuestion, question, actorNick) {
    setTimeout(async () => {
        // Pantalla "JUGÁIS POR XXX PUNTOS" antes de revelar la pregunta del tablero
        const game = activeGames.get(roomId);
        const shouldReveal = await runRandomPointsReveal({
            game,
            question: normalizedQuestion,
            roomId,
            io,
            syncBus: RedisSyncBus.getInstance()
        });

        if (!shouldReveal) return;

        EventBus.emit('question.revealed', new QuestionRevealedEvent({
            roomId,
            question: normalizedQuestion,
            questionIndex: 0,
            totalQuestions: 1,
            timestamp: Date.now()
        }));

        const timeLimit = typeof question.time_limit === 'number' ? question.time_limit : 30;
        if (timeLimit > 0) {
            startTimer(roomId, timeLimit, io);
            logger.debug('trivial handleMove: timer started', { roomId, timeLimit });
        } else {
            logger.debug('trivial handleMove: no timer (timeLimit=0)', { roomId });
        }

        logger.info('trivial handleMove: pipeline dispatched', {
            roomId,
            actorNick,
            questionId: question.id
        });
    }, 700);
}

async function handleMove(io, handleCenterLanding, socket, { roomId, nickname, position }) {
    logger.debug('trivial handleMove: invoked', { roomId, nickname, position });

    const state = await trivialState.getTrivialState(roomId);
    if (!state) {
        logger.warn('trivial handleMove: no state in Redis', { roomId });
        return;
    }

    if (state.phase !== 'waiting_move') {
        logger.warn('trivial handleMove: wrong phase, ignoring move', {
            roomId,
            phase: state.phase,
            nickname
        });
        return;
    }

    if (!state.availablePositions.includes(position)) {
        logger.warn('trivial handleMove: position not in availablePositions', {
            roomId,
            nickname,
            position,
            available: state.availablePositions
        });
        return;
    }

    const movePayload = {
        nickname,
        position,
        ...applyMoveToPlayers(state, nickname, position)
    };
    emitPlayerMoved(io, roomId, movePayload);

    const { N, M, cgPositions } = state.board;
    const catIdx = getCategoryForPosition(position, N, M, cgPositions);
    logger.debug('trivial handleMove: category resolved', { roomId, nickname, position, catIdx });

    if (catIdx === null) {
        if (handleCenterLanding) {
            await handleCenterLanding(roomId, state);
        } else {
            await advanceTurnAndNotify(io, roomId, state);
        }
        return;
    }

    let question;
    try {
        question = await fetchTrivialQuestion(state, catIdx, roomId);
    } catch (err) {
        logger.error('trivial handleMove: error fetching question from DB', {
            roomId,
            error: err.message
        });
        return;
    }

    if (!question) {
        logger.warn('trivial handleMove: no question available, skipping turn', { roomId, catIdx });
        await advanceTurnAndNotify(io, roomId, state);
        return;
    }

    state.askedQuestionIds.push(question.id);
    state.phase = 'waiting_answer';
    const actorNick = trivialState.getCurrentTurnActor(state);
    state.currentTrivialMeta = { catIdx, position, actorNick };
    await trivialState.setTrivialState(roomId, state);

    logger.info('trivial handleMove: question loaded', {
        roomId,
        actorNick,
        position,
        catIdx,
        questionId: question.id,
        questionType: question.question_type
    });

    const normalizedQuestion = normalizeQuestion(question, roomId);
    const game = ensureGameEntry(roomId, state);
    updateGameForQuestion({
        game,
        roomId,
        state,
        normalizedQuestion,
        actorNick,
        catIdx,
        position
    });

    logger.debug('trivial handleMove: game entry updated', {
        roomId,
        actorNick,
        epoch: game.trivialQuestionEpoch,
        players: game.players
    });

    await initRedisRoundAndPublish(roomId, game);
    dispatchQuestionPipeline(io, roomId, normalizedQuestion, question, actorNick);
}

module.exports = function createMoveHandler({ io, handleCenterLanding }) {
    return (socket, payload) => handleMove(io, handleCenterLanding, socket, payload);
};

module.exports.buildPlayers = _buildPlayers;
