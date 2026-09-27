/**
 * @fileoverview Main submit-answer orchestration.
 * @module application/commands/submit-answer/executeSubmitAnswer
 *
 * Preserves legacy behavior while delegating each responsibility to focused modules.
 */

const { validateSubmitAnswerPayload } = require('./validatePayload');
const { resolveGameContext, buildQuestionContext, validateAnswerByType, applyTimerStateToLateWindow } = require('./questionContext');
const { runEarlyChecks } = require('./earlyChecks');
const { handleAutoRevealAfterAnswer } = require('./autoReveal');
const {
    buildValidationFailure,
    validatePlayerIdentity,
    buildAnswerValidationFailure,
    runAnswerPipeline,
    buildSuccessResponse
} = require('./submitAnswerFlow');

/**
 * Execute the full submit-answer command flow.
 *
 * @param {Object} payload - Command payload.
 * @param {Object} dependencies - Runtime dependencies.
 * @returns {Promise<Object>} Command result.
 */
async function executeSubmitAnswer(payload, dependencies) {
    const validation = validateSubmitAnswerPayload(payload);
    if (!validation.valid) {
        return buildValidationFailure(validation);
    }

    const { activeGames, players, teamConfigs, io, syncBus, clearGameTimer, ackManager, presenterNotification } = dependencies;
    const { playerId, socket } = payload;
    const claimedNickname = payload.nickname;
    const { roomId, sPin, game } = resolveGameContext(payload, activeGames);
    if (!game) {
        return { success: false, reason: 'game-not-found' };
    }

    // Security hardening: authoritative identity comes from playerId/server state,
    // not from nickname sent by client payload.
    const identity = validatePlayerIdentity({ players, playerId, claimedNickname, socket, sPin });
    if (!identity.valid) {
        return { success: false, reason: identity.reason };
    }

    const { player, nickname } = identity;

    const flags = await applyTimerStateToLateWindow(buildQuestionContext(game), sPin);
    const answerValidation = validateAnswerByType({ payload, question: flags.currentQuestion, flags });
    if (!answerValidation.valid) {
        return buildAnswerValidationFailure(answerValidation, sPin, game);
    }

    const earlyResult = await runEarlyChecks({
        game,
        player,
        playerId,
        socket,
        currentQuestion: flags.currentQuestion,
        nickname,
        sPin
    });
    if (earlyResult.shouldStop) {
        return earlyResult.result;
    }

    const flowResult = await runAnswerPipeline({
        payload,
        game,
        teamConfigs,
        io,
        ackManager,
        presenterNotification,
        syncBus,
        roomId,
        sPin,
        player,
        playerId,
        socket,
        nickname,
        flags,
        players
    });

    const successResponse = buildSuccessResponse({
        answerResult: flowResult.answerResult,
        scoreContext: flowResult.scoreContext,
        game,
        nickname,
        modeResult: flowResult.modeResult
    });

    const revealResult = await handleAutoRevealAfterAnswer({
        sPin,
        game,
        io,
        players,
        clearGameTimer,
        isTeamMode: flowResult.isTeamMode,
        modeResult: flowResult.modeResult,
        atomicProgress: flowResult.atomicProgress,
        lockMissResponse: successResponse
    });

    return revealResult.shouldReturn ? revealResult.result : successResponse;
}

module.exports = {
    executeSubmitAnswer,
    validateSubmitAnswerPayload
};
