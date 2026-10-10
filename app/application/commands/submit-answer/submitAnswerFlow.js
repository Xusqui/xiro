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

function buildValidationFailure(validation) {
    return {
        success: false,
        reason: 'validation-failed',
        errors: validation.errors
    };
}

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

function buildAnswerValidationFailure(answerValidation, sPin, game) {
    if (answerValidation.reason === 'question-missing' || answerValidation.reason === 'invalid-options') {
        logger.error(`Validation failed: ${answerValidation.reason}`, {
            roomId: sPin,
            currentIndex: game?.currentIndex
        });
    }

    return { success: false, reason: answerValidation.reason };
}

async function evaluateAnswerAndStreak(ctx) {
    const {
        payload,
        game,
        io,
        roomId,
        sPin,
        player,
        socket,
        nickname,
        flags
    } = ctx;

    const currentQuestion = flags.currentQuestion;
    const questionTimeLimit = flags.questionTimeLimit;

    await persistPlayerAnswerState({
        payload,
        flags,
        player,
        socket,
        game,
        currentQuestion,
        questionTimeLimit
    });

    await updateOptionAnswerStats({ flags, game, sPin, index: payload.index });

    const resolvedStartTime = await resolveCanonicalQuestionStartTime({
        game,
        sPin,
        nickname,
        questionTimeLimit
    });

    const basePoints = await resolveCanonicalRandomPoints({ game, currentQuestion, sPin });

    // Sopa de letras: pistas (valen la mitad) y, en equipos, palabras del equipo
    const wordSearchShared = flags.isWordSearchQuestion
        ? await getWordSearchScoringContext(sPin, game.currentIndex, nickname, game)
        : {};

    const answerResult = evaluateAnswer({
        flags,
        ...wordSearchShared,
        payload,
        currentQuestion,
        resolvedStartTime,
        questionTimeLimit,
        game,
        basePoints
    });

    // Sopa de letras: cuántos encontraron cada palabra (se muestra al revelar)
    if (flags.isWordSearchQuestion) {
        await recordWordSearchStats(sPin, game.currentIndex, answerResult.details);
    }

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

async function persistAndResolveMode(ctx) {
    const {
        payload,
        game,
        teamConfigs,
        io,
        ackManager,
        presenterNotification,
        syncBus,
        sPin,
        player,
        playerId,
        socket,
        nickname,
        flags,
        currentQuestion,
        answerResult,
        scoreContext,
        fullMultipleChoiceDetails,
        randomPoints,
        players
    } = ctx;

    await updateScoreAndEmitPlayerScored({
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

    persistPlayerAnswerSnapshot({
        game,
        sPin,
        nickname,
        currentQuestion,
        payload,
        flags,
        answerResult,
        finalPointsEarned: scoreContext.finalPointsEarned,
        isCorrect: scoreContext.isCorrect,
        randomPoints,
        socket
    });

    const { modeResult, isTeamMode } = await processAnswerByGameMode({
        game,
        teamConfigs,
        sPin,
        io,
        ackManager,
        presenterNotification,
        nickname,
        playerId,
        payload,
        currentQuestion,
        flags,
        isCorrect: scoreContext.isCorrect,
        finalPointsEarned: scoreContext.finalPointsEarned,
        answerResult,
        fullMultipleChoiceDetails,
        enrichedStreakInfo: scoreContext.enrichedStreakInfo,
        players
    });

    await syncPostAnswerState({ sPin, nickname, game, syncBus, logger });

    return { modeResult, isTeamMode };
}

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
    buildValidationFailure,
    validatePlayerIdentity,
    buildAnswerValidationFailure,
    runAnswerPipeline,
    buildSuccessResponse
};
