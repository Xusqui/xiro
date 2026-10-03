/**
 * @fileoverview Trivial - Lógica para la casilla central
 *
 * Cuando un jugador cae en el centro, el presentador elige la categoría
 * de la pregunta. Flujo:
 *   1. handleCenterLanding  → emite trivial-choose-category al presentador
 *   2. Presentador elige    → socket trivial-category-chosen
 *   3. handleCategoryChosen → carga pregunta y dispara el pipeline estándar
 */

'use strict';

const logger = require('../../../config/logger');
const dbService = require('../../../services/db');
const trivialState = require('../../services/TrivialGameState');
const EventBus = require('../../../domain/events/EventBus');
const { QuestionRevealedEvent } = require('../../../domain/events/GameEvents');
const { startTimer } = require('../../utils/TimerManager');
const { activeGames } = require('../../../state/globalState');
const { RedisSyncBus } = require('../../sync/RedisSyncBus');
const { generateScrambledLetters, normalizeWord } = require('../../../domain/services/WordScrambleService');
const { shuffle } = require('../../../services/game.logic');
const { getRedisClient } = require('../../../config/redis');
const { assignRandomPointsForCurrentQuestion } = require('../../utils/QuestionTransitionManager');
const { runRandomPointsReveal } = require('../../utils/RandomPointsRevealManager');

function buildPlayers(state) {
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

function buildCategoryPayload(state) {
    return (state.categories || []).map((category, idx) => ({
        index: idx,
        name: category.bank_name || category.category_name || category.name || `Categoría ${idx + 1}`,
        color: category.color || '#888'
    }));
}

function emitTurnChanged(io, roomId, state) {
    const payload = {
        currentTurn: trivialState.getCurrentTurnActor(state),
        phase: 'waiting_roll',
        players: buildPlayers(state),
        teamTokens: state.teamTokens
    };

    /* Both roles join roomId (shared) — single emit reaches all */
    io.to(roomId).emit('trivial-turn-changed', payload);
}

async function refreshCenterBankNames(state, roomId) {
    try {
        const freshTrivial = await dbService.getTrivialGameByPin(state.pin);
        if (!freshTrivial?.categories) {
            return;
        }

        freshTrivial.categories.forEach((freshCat, idx) => {
            if (state.categories[idx]) {
                state.categories[idx].bank_name = freshCat.bank_name;
            }
        });
    } catch (err) {
        logger.warn('trivial handleCenterLanding: could not refresh bank names from DB', {
            roomId,
            error: err.message
        });
    }
}

async function fetchCategoryQuestion(state, catIdx, roomId, socket) {
    const category = state.categories[catIdx];
    logger.debug('trivial handleCategoryChosen: fetching question', {
        roomId,
        catIdx,
        category: category.category_name
    });

    try {
        return await dbService.getTrivialCategoryQuestion(
            category.source_type || 'bank',
            category.source_id || category.bank_id,
            state.askedQuestionIds.slice(-50)
        );
    } catch (err) {
        logger.error('trivial handleCategoryChosen: error fetching question from DB', {
            roomId,
            error: err.message
        });
        socket.emit('trivial-error', { message: 'Error al cargar la pregunta', code: 'TRIVIAL_QUESTION_LOAD_FAILED' });
        return null;
    }
}

function buildNormalizedQuestion(question, roomId) {
    const mappedOptions = (question.options || []).map(option => ({
        ...option,
        optionText: option.option_text ?? option.optionText ?? '',
        isCorrect: option.is_correct ?? option.isCorrect ?? false,
        orderIndex: option.order_index ?? option.orderIndex ?? 0
    }));

    const options = question.question_type === 'order' ? mappedOptions : shuffle(mappedOptions);
    if (question.question_type === 'order') {
        logger.debug('trivial handleCategoryChosen: order question — options NOT shuffled', {
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

    return normalizedQuestion;
}

function ensureTrivialGameEntry(roomId, state) {
    let game = activeGames.get(roomId);
    if (!game) {
        game = {
            pin: roomId,
            roomId,
            isTrivial: true,
            questions: [],
            currentIndex: 0,
            scores: Object.fromEntries(Object.keys(state.players).map(nickname => [nickname, 0])),
            players: Object.keys(state.players),
            canAnswer: false,
            state: 'in-progress',
            startTime: Date.now(),
            answerStats: {},
            revealedQuestions: new Set(),
            trivialMeta: null,
            trivialLastCorrect: null,
            trivialQuestionEpoch: 0
        };
        activeGames.set(roomId, game);
    }

    if (game.use_random_points === undefined && state.randomPointsConfig) {
        Object.assign(game, state.randomPointsConfig);
    }
    if (game.use_streaks === undefined && state.streakConfig) {
        Object.assign(game, state.streakConfig);
    }

    return game;
}

function updateGameForCenterQuestion(input) {
    const {
        game,
        roomId,
        state,
        normalizedQuestion,
        actorNick,
        catIdx
    } = input;

    game.roomId = roomId;
    game.players = Object.keys(state.players);
    game.questions = [normalizedQuestion];
    game.currentIndex = 0;
    game.canAnswer = true;
    game.answerStats = {};
    game.revealedQuestions = new Set();
    game.answeredCurrent = new Set();
    game.trivialMeta = { catIdx, position: 'center', actorNick };
    game.trivialCategoryName = state.categories[catIdx]?.category_name || null;
    game.trivialLastCorrect = null;
    game.trivialQuestionEpoch = (game.trivialQuestionEpoch || 0) + 1;
    game.questionStartTime = Date.now();
    assignRandomPointsForCurrentQuestion(game, roomId);
}

async function resetRoundRedisState(roomId, game) {
    try {
        const redis = await getRedisClient();
        await Promise.all([
            redis.set(`trivial:lastcorrect:${roomId}`, '0', { EX: 3600 }),
            redis.del(`trivial:roundresults:${roomId}`)
        ]);

        const allStreaks = await redis.hGetAll(`trivial:streaks:${roomId}`);
        if (!allStreaks || Object.keys(allStreaks).length === 0) {
            return;
        }

        if (!game.playerStreaks) {
            game.playerStreaks = {};
        }

        for (const [nick, value] of Object.entries(allStreaks)) {
            game.playerStreaks[nick] = Number(value);
        }
        logger.debug('trivial handleCategoryChosen: merged player streaks from Redis', {
            roomId,
            playerStreaks: game.playerStreaks
        });
    } catch (err) {
        logger.warn('trivial handleCategoryChosen: Redis cleanup failed (non-critical)', {
            roomId,
            error: err.message
        });
    }
}

function clearAnswerStats(roomId) {
    const answerStatsStore = require('../../../services/AnswerStatsStore');
    const sessionPin = String(roomId).split('-')[0];
    answerStatsStore.clearQuestion(roomId, 0).catch(() => { });
    answerStatsStore.clearQuestion(sessionPin, 0).catch(() => { });
}

async function dispatchCenterPipeline(input) {
    const {
        io,
        roomId,
        game,
        normalizedQuestion,
        question,
        actorNick
    } = input;

    RedisSyncBus.getInstance().publishGameStarted(roomId, game).catch(err => {
        logger.warn('trivial: publishGameStarted failed (center)', { error: err.message });
    });

    // Pantalla "JUGÁIS POR XXX PUNTOS" antes de revelar la pregunta del centro
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
        logger.debug('trivial handleCategoryChosen: timer started', { roomId, timeLimit });
    } else {
        logger.debug('trivial handleCategoryChosen: no timer (timeLimit=0)', { roomId });
    }

    logger.info('trivial handleCategoryChosen: pipeline dispatched', {
        roomId,
        actorNick,
        questionId: question.id
    });
}

async function handleCenterLanding(io, roomId, state) {
    logger.debug('trivial handleCenterLanding: invoked', { roomId });
    state.phase = 'choosing_category';

    await refreshCenterBankNames(state, roomId);
    await trivialState.setTrivialState(roomId, state);

    const actorNick = trivialState.getCurrentTurnActor(state);
    const categories = buildCategoryPayload(state);
    io.to(roomId + ':players').emit('trivial-choose-category', { categories, actorNick });
    io.to(roomId + ':presenter').emit('trivial-choose-category', { categories: [], actorNick });

    logger.info('trivial: center landing — actor choosing category', {
        roomId,
        actorNick,
        categoryCount: categories.length
    });
    logger.debug('trivial handleCenterLanding: categories offered', { roomId, categories });
}

async function skipTurnAfterMissingQuestion(io, roomId, state) {
    trivialState.advanceTurn(state);
    state.phase = 'waiting_roll';
    await trivialState.setTrivialState(roomId, state);
    emitTurnChanged(io, roomId, state);
}

async function handleCategoryChosen(io, socket, { roomId, categoryIndex }) {
    logger.debug('trivial handleCategoryChosen: invoked', { roomId, categoryIndex });

    const state = await trivialState.getTrivialState(roomId);
    if (!state) {
        logger.error('trivial handleCategoryChosen: no state in Redis', { roomId });
        socket.emit('trivial-error', { message: 'Estado no encontrado', code: 'TRIVIAL_STATE_NOT_FOUND' });
        return;
    }

    if (state.phase !== 'choosing_category') {
        logger.warn('trivial handleCategoryChosen: wrong phase', { roomId, phase: state.phase, categoryIndex });
        socket.emit('trivial-error', {
            message: `Fase incorrecta: ${state.phase}`,
            code: 'TRIVIAL_INVALID_PHASE',
            params: { phase: state.phase }
        });
        return;
    }

    // Solo números o texto numérico: Number(null), Number('') y Number(true) darían 0 o 1
    const isNumericInput = typeof categoryIndex === 'number'
        || (typeof categoryIndex === 'string' && categoryIndex.trim() !== '');
    const catIdx = isNumericInput ? Number(categoryIndex) : NaN;
    const invalidCategory = !Number.isInteger(catIdx) || catIdx < 0 || catIdx >= state.categories.length;
    if (invalidCategory) {
        logger.warn('trivial handleCategoryChosen: invalid category index', {
            roomId,
            categoryIndex,
            totalCategories: state.categories.length
        });
        socket.emit('trivial-error', { message: 'Categoría inválida', code: 'TRIVIAL_CATEGORY_INVALID' });
        return;
    }

    const question = await fetchCategoryQuestion(state, catIdx, roomId, socket);
    if (!question) {
        logger.warn('trivial handleCategoryChosen: no question available, skipping turn', { roomId, catIdx });
        await skipTurnAfterMissingQuestion(io, roomId, state);
        return;
    }

    state.askedQuestionIds.push(question.id);
    state.phase = 'waiting_answer';
    const actorNick = trivialState.getCurrentTurnActor(state);
    state.currentTrivialMeta = { catIdx, position: 'center', actorNick };
    await trivialState.setTrivialState(roomId, state);

    logger.info('trivial handleCategoryChosen: question loaded for center', {
        roomId,
        actorNick,
        catIdx,
        questionId: question.id,
        questionType: question.question_type
    });

    const normalizedQuestion = buildNormalizedQuestion(question, roomId);
    const game = ensureTrivialGameEntry(roomId, state);
    updateGameForCenterQuestion({
        game,
        roomId,
        state,
        normalizedQuestion,
        actorNick,
        catIdx
    });

    logger.debug('trivial handleCategoryChosen: game entry updated', {
        roomId,
        actorNick,
        epoch: game.trivialQuestionEpoch,
        players: game.players
    });

    await resetRoundRedisState(roomId, game);
    clearAnswerStats(roomId);
    await dispatchCenterPipeline({
        io,
        roomId,
        game,
        normalizedQuestion,
        question,
        actorNick
    });
}

module.exports = function createCenterHandler({ io }) {
    return {
        handleCenterLanding: (roomId, state) => handleCenterLanding(io, roomId, state),
        handleCategoryChosen: (socket, payload) => handleCategoryChosen(io, socket, payload)
    };
};
