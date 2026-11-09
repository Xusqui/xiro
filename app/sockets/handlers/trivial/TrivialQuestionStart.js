/**
 * @fileoverview Trivial - arranque de la pregunta de una casilla con categoría.
 * Carga la pregunta de la categoría, la prepara según su tipo, actualiza la entrada de activeGames,
 * reinicia el estado de la ronda en Redis y dispara el pipeline estándar (question.revealed → timer).
 */

'use strict';

const logger = require('../../../config/logger');
const dbService = require('../../../services/db');
const EventBus = require('../../../domain/events/EventBus');
const { QuestionRevealedEvent } = require('../../../domain/events/GameEvents');
const { startTimer } = require('../../utils/TimerManager');
const { activeGames } = require('../../../state/globalState');
const { RedisSyncBus } = require('../../sync/RedisSyncBus');
const { getRedisClient } = require('../../../config/redis');
const answerStatsStore = require('../../../services/AnswerStatsStore');
const { shuffle } = require('../../../services/game.logic');
const { generateScrambledLetters, normalizeWord } = require('../../../domain/services/WordScrambleService');
const { prepareWordSearchLogged, prepareFillBlanksLogged } = require('../../utils/QuestionPreparation');
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
        roomId, // ← full session ID para checkAllPlayersAnswered
        isTrivial: true,
        teamMode: !!state?.teamMode,
        questions: [],
        currentIndex: 0,
        scores: Object.fromEntries(Object.keys(state.players).map(n => [n, 0])),
        players: Object.keys(state.players), // ← TODOS los jugadores
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

/**
 * Pide a la base de datos una pregunta al azar de la categoría, sin repetir las 50 últimas.
 * @param {Object} state - Estado Trivial
 * @param {number} catIdx - Categoría de la casilla
 * @param {string} roomId - ID de sesión (para el log)
 * @returns {Promise<Object|null>} Pregunta con opciones, o null si no quedan
 */
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
    if (normalizedQuestion.question_type === 'fill_blanks') {
        return prepareFillBlanksLogged(normalizedQuestion, { roomId, mode: 'trivial' });
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
    const { game, roomId, state, normalizedQuestion, actorNick, catIdx, position } = input;

    const sessionPin = String(roomId).split('-')[0];

    game.roomId = roomId;
    game.players = Object.keys(state.players);
    game.questions = [normalizedQuestion];
    game.currentIndex = 0;
    game.canAnswer = true;
    game.answerStats = {};
    game.revealedQuestions = new Set();
    game.answeredCurrent = new Set();

    answerStatsStore.clearQuestion(roomId, 0).catch(() => {});
    answerStatsStore.clearQuestion(sessionPin, 0).catch(() => {});

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

        EventBus.emit(
            'question.revealed',
            new QuestionRevealedEvent({
                roomId,
                question: normalizedQuestion,
                questionIndex: 0,
                totalQuestions: 1,
                timestamp: Date.now()
            })
        );

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

/**
 * Prepara la pregunta, actualiza la partida en este worker, reinicia la ronda en Redis
 * y programa su revelado.
 * @param {Object} io - Instancia de Socket.IO
 * @param {string} roomId - ID de sesión
 * @param {Object} state - Estado Trivial (ya guardado con currentTrivialMeta)
 * @param {{question: Object, catIdx: number, position: string, actorNick: string}} move - Pregunta y casilla
 * @returns {Promise<void>}
 */
async function startTrivialQuestion(io, roomId, state, { question, catIdx, position, actorNick }) {
    const normalizedQuestion = normalizeQuestion(question, roomId);
    const game = ensureGameEntry(roomId, state);
    updateGameForQuestion({ game, roomId, state, normalizedQuestion, actorNick, catIdx, position });

    logger.debug('trivial handleMove: game entry updated', {
        roomId,
        actorNick,
        epoch: game.trivialQuestionEpoch,
        players: game.players
    });

    await initRedisRoundAndPublish(roomId, game);
    dispatchQuestionPipeline(io, roomId, normalizedQuestion, question, actorNick);
}

module.exports = { fetchTrivialQuestion, startTrivialQuestion };
