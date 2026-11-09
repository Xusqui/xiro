/**
 * @fileoverview Shared submit-answer flow helpers.
 * @module application/commands/submit-answer/submitAnswerFlow
 */

const logger = require('../../../config/logger');
const { persistPlayerAnswerState, updateOptionAnswerStats } = require('./playerState');
const { resolveCanonicalQuestionStartTime, evaluateAnswer, buildMultipleChoiceDetails } = require('./answerEvaluation');
const { resolveCanonicalRandomPoints } = require('./randomPointsResolution');
const { computeStreakAndPoints, registerProgressAndPersistStreak } = require('./streakScoring');
const { trackTrivialResults, markCurrentEpochAnswer, attachTypedAnswerDetails } = require('./answerTracking');
const { emitAnswerSubmitted, updateScoreAndEmitPlayerScored } = require('./eventsAndScore');
const { persistPlayerAnswerSnapshot } = require('./playerAnswerArchive');
const { processAnswerByGameMode } = require('./strategyExecution');
const { syncPostAnswerState } = require('./postAnswerSync');
const { recordWordSearchStats } = require('../../../sockets/utils/WordSearchRevealStats');
const { getWordSearchScoringContext } = require('../../../sockets/utils/WordSearchTeam');
const { recordFillBlanksStats } = require('../../../sockets/utils/FillBlanksRevealStats');
const { getFillBlanksScoringContext, emitToTeammates } = require('../../../sockets/utils/FillBlanksTeam');
const { recordSurveyMultipleStats } = require('../../../sockets/utils/SurveyMultipleRevealStats');
const { questionSlot } = require('../../../sockets/utils/QuestionSlot');

/** Completa la frase en equipos: el primer ENVIAR vale para todos; los compañeros envían lo mismo. */
function notifyTeamFirstSubmit({ io, sPin, nickname, shared, words }) {
    if (!shared?.teamToNotify || !io) return;
    emitToTeammates({ io, roomId: sPin, team: shared.teamToNotify, nickname }, 'fill-blanks-team-submitted', {
        by: nickname,
        words: Array.isArray(words) ? words : []
    });
}

/**
 * Respuesta de fallo por payload inválido.
 * @param {{errors: string[]}} validation - Resultado de la validación
 * @returns {{success: false, reason: 'validation-failed', errors: string[]}}
 */
function buildValidationFailure(validation) {
    return {
        success: false,
        reason: 'validation-failed',
        errors: validation.errors
    };
}

/**
 * Comprueba que el playerId existe, está en la sala y coincide con el apodo del payload y del socket. Registra cada
 * rechazo.
 * @param {Object} input
 * @param {Map} input.players - Jugadores del worker
 * @param {string} input.playerId - ID del jugador
 * @param {string} [input.claimedNickname] - Apodo del payload
 * @param {Object} [input.socket] - Socket que envía
 * @param {string} input.sPin - ID de sesión
 * @returns {{valid: boolean, reason?: 'player-not-found'|'player-not-in-room'|'identity-mismatch', player?: Object,
 *   nickname?: string}}
 */
function validatePlayerIdentity({ players, playerId, claimedNickname, socket, sPin }) {
    const player = players.get(playerId);
    if (!player) {
        logger.warn('SubmitAnswer rejected: player not found', {
            roomId: sPin,
            playerId,
            claimedNickname
        });
        return { valid: false, reason: 'player-not-found' };
    }

    if (player.roomId !== sPin) {
        logger.warn('SubmitAnswer rejected: player-room mismatch', {
            roomId: sPin,
            playerId,
            playerRoomId: player.roomId,
            claimedNickname
        });
        return { valid: false, reason: 'player-not-in-room' };
    }

    const nickname = player.nickname;

    if (claimedNickname && claimedNickname !== nickname) {
        logger.warn('SubmitAnswer rejected: payload nickname mismatch', {
            roomId: sPin,
            playerId,
            claimedNickname,
            expectedNickname: nickname
        });
        return { valid: false, reason: 'identity-mismatch' };
    }

    if (socket?.data?.nickname && socket.data.nickname !== nickname) {
        logger.warn('SubmitAnswer rejected: socket nickname mismatch', {
            roomId: sPin,
            playerId,
            socketNickname: socket.data.nickname,
            expectedNickname: nickname
        });
        return { valid: false, reason: 'identity-mismatch' };
    }

    return { valid: true, player, nickname };
}

/**
 * Respuesta de fallo por respuesta inválida; registra como error los fallos de datos de la pregunta.
 * @param {{reason: string}} answerValidation - Resultado del validador
 * @param {string} sPin - ID de sesión
 * @param {Object} game - Partida
 * @returns {{success: false, reason: string}}
 */
function buildAnswerValidationFailure(answerValidation, sPin, game) {
    if (answerValidation.reason === 'question-missing' || answerValidation.reason === 'invalid-options') {
        logger.error(`Validation failed: ${answerValidation.reason}`, {
            roomId: sPin,
            currentIndex: game?.currentIndex
        });
    }

    return { success: false, reason: answerValidation.reason };
}

async function loadWordScoringContexts({ flags, game, sPin, nickname, payload, resolvedStartTime }) {
    const currentQuestion = flags.currentQuestion;

    // Sopa de letras: pistas (valen la mitad) y, en equipos, palabras del equipo
    const wordSearchShared = flags.isWordSearchQuestion
        ? await getWordSearchScoringContext(sPin, questionSlot(game), nickname, game)
        : {};

    // Completa la frase: pistas, huecos del equipo y el tiempo del primer envío del equipo
    const fillBlanksShared = flags.isFillBlanksQuestion
        ? await getFillBlanksScoringContext({
            sPin,
            questionIndex: questionSlot(game),
            nickname,
            game,
            totalBlanks: (currentQuestion.fb_words || currentQuestion.options || []).length,
            elapsed: resolvedStartTime ? (Date.now() - Number(resolvedStartTime)) / 1000 : undefined,
            words: payload.words
        })
        : {};

    return { wordSearchShared, fillBlanksShared };
}

async function recordQuestionTypeStats({ flags, game, sPin, io, nickname, payload, answerResult, fillBlanksShared }) {
    // Sopa de letras: cuántos encontraron cada palabra (se muestra al revelar)
    if (flags.isWordSearchQuestion) {
        await recordWordSearchStats(sPin, questionSlot(game), answerResult.details);
    }

    // Completa la frase: cuántos acertaron cada hueco (se muestra al revelar) y aviso al equipo
    if (flags.isFillBlanksQuestion) {
        await recordFillBlanksStats(sPin, questionSlot(game), answerResult.details);
        notifyTeamFirstSubmit({ io, sPin, nickname, shared: fillBlanksShared, words: payload.words });
    }

    // Encuesta de selección múltiple: encuestados y votos por opción (porcentajes al revelar)
    if (flags.isSurveyMultipleQuestion) {
        await recordSurveyMultipleStats(sPin, questionSlot(game), answerResult.selectedIndices);
    }
}

async function evaluateAnswerAndStreak(ctx) {
    const { payload, game, io, roomId, sPin, player, socket, nickname, flags } = ctx;

    const currentQuestion = flags.currentQuestion;
    const questionTimeLimit = flags.questionTimeLimit;

    await persistPlayerAnswerState({ payload, flags, player, socket, game, currentQuestion, questionTimeLimit });

    await updateOptionAnswerStats({ flags, game, sPin, index: payload.index });

    const resolvedStartTime = await resolveCanonicalQuestionStartTime({ game, sPin, nickname, questionTimeLimit });

    const basePoints = await resolveCanonicalRandomPoints({ game, currentQuestion, sPin });

    const { wordSearchShared, fillBlanksShared } = await loadWordScoringContexts({ ...ctx, resolvedStartTime });

    const answerResult = evaluateAnswer({
        flags,
        ...wordSearchShared,
        ...fillBlanksShared,
        payload,
        currentQuestion,
        resolvedStartTime,
        questionTimeLimit,
        game,
        basePoints
    });

    await recordQuestionTypeStats({ ...ctx, answerResult, fillBlanksShared });

    const scoreContext = computeStreakAndPoints({ game, nickname, flags, answerResult, sPin });
    const fullMultipleChoiceDetails = buildMultipleChoiceDetails({ flags, answerResult, currentQuestion });

    const atomicProgress = await registerProgressAndPersistStreak({
        game,
        sPin,
        roomId,
        nickname,
        io,
        enrichedStreakInfo: scoreContext.enrichedStreakInfo
    });

    return {
        currentQuestion,
        answerResult,
        scoreContext,
        fullMultipleChoiceDetails,
        atomicProgress,
        randomPoints: basePoints
    };
}

function trackAndEmitAnswerEffects({
    payload,
    game,
    teamConfigs,
    roomId,
    sPin,
    player,
    playerId,
    socket,
    nickname,
    flags,
    answerResult,
    scoreContext,
    fullMultipleChoiceDetails
}) {
    trackTrivialResults({
        game,
        teamConfigs,
        roomId,
        nickname,
        isCorrect: scoreContext.isCorrect,
        sPin
    });

    markCurrentEpochAnswer(socket, game);

    attachTypedAnswerDetails({
        flags,
        game,
        player,
        socket,
        answerResult,
        isCorrect: scoreContext.isCorrect,
        finalPointsEarned: scoreContext.finalPointsEarned,
        fullMultipleChoiceDetails
    });

    emitAnswerSubmitted({
        sPin,
        playerId,
        nickname,
        game,
        payload,
        flags,
        answerResult,
        isCorrect: scoreContext.isCorrect
    });
}

function updateScoreFromContext(ctx) {
    const { game, sPin, playerId, nickname, player, socket, answerResult, scoreContext } = ctx;
    return updateScoreAndEmitPlayerScored({
        game,
        sPin,
        playerId,
        nickname,
        player,
        socket,
        isCorrect: scoreContext.isCorrect,
        answerResult,
        finalPointsEarned: scoreContext.finalPointsEarned,
        streakBonus: scoreContext.streakBonus
    });
}

function persistSnapshotFromContext(ctx) {
    const { scoreContext } = ctx;
    persistPlayerAnswerSnapshot({
        game: ctx.game,
        sPin: ctx.sPin,
        nickname: ctx.nickname,
        currentQuestion: ctx.currentQuestion,
        payload: ctx.payload,
        flags: ctx.flags,
        answerResult: ctx.answerResult,
        finalPointsEarned: scoreContext.finalPointsEarned,
        isCorrect: scoreContext.isCorrect,
        randomPoints: ctx.randomPoints,
        socket: ctx.socket
    });
}

function processGameModeFromContext(ctx) {
    const { scoreContext } = ctx;
    return processAnswerByGameMode({
        game: ctx.game,
        teamConfigs: ctx.teamConfigs,
        sPin: ctx.sPin,
        io: ctx.io,
        ackManager: ctx.ackManager,
        presenterNotification: ctx.presenterNotification,
        nickname: ctx.nickname,
        playerId: ctx.playerId,
        payload: ctx.payload,
        currentQuestion: ctx.currentQuestion,
        flags: ctx.flags,
        isCorrect: scoreContext.isCorrect,
        finalPointsEarned: scoreContext.finalPointsEarned,
        answerResult: ctx.answerResult,
        fullMultipleChoiceDetails: ctx.fullMultipleChoiceDetails,
        enrichedStreakInfo: scoreContext.enrichedStreakInfo,
        players: ctx.players
    });
}

async function persistAndResolveMode(ctx) {
    const { sPin, nickname, game, syncBus } = ctx;

    await updateScoreFromContext(ctx);
    persistSnapshotFromContext(ctx);
    const { modeResult, isTeamMode } = await processGameModeFromContext(ctx);
    await syncPostAnswerState({ sPin, nickname, game, syncBus, logger });

    return { modeResult, isTeamMode };
}

/**
 * Evalúa la respuesta (con racha), emite sus efectos y la guarda según el modo de juego.
 * @param {Object} ctx - Contexto de la respuesta ya validada
 * @returns {Promise<Object>} Resultado de la evaluación y del guardado
 */
async function runAnswerPipeline(ctx) {
    const evaluationResult = await evaluateAnswerAndStreak(ctx);

    trackAndEmitAnswerEffects({
        ...ctx,
        ...evaluationResult
    });

    const finalResult = await persistAndResolveMode({
        ...ctx,
        ...evaluationResult
    });

    return {
        ...evaluationResult,
        ...finalResult
    };
}

/**
 * Respuesta de éxito para el jugador. En encuestas no hay acierto ni puntos.
 * @param {Object} input - answerResult, scoreContext, game, nickname, modeResult
 * @returns {{success: true, isCorrect: boolean|null, pointsEarned: number, totalScore: number, waitingForTeams:
 *   boolean}}
 */
function buildSuccessResponse({ answerResult, scoreContext, game, nickname, modeResult }) {
    return {
        success: true,
        isCorrect: answerResult.isSurvey ? null : scoreContext.isCorrect,
        pointsEarned: answerResult.isSurvey ? 0 : scoreContext.pointsEarned,
        totalScore: game.scores[nickname] || 0,
        waitingForTeams: modeResult?.waitingForTeams || false
    };
}

module.exports = {
    notifyTeamFirstSubmit,
    buildValidationFailure,
    validatePlayerIdentity,
    buildAnswerValidationFailure,
    runAnswerPipeline,
    buildSuccessResponse
};
