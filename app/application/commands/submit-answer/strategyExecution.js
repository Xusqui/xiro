/**
 * @fileoverview Game-mode strategy execution and side-effects.
 * @module application/commands/submit-answer/strategyExecution
 *
 * Purpose:
 * - Delegate answer processing to Individual/Team strategies.
 * - Execute team-mode socket side effects returned as intentions.
 * - Return mode result and team-mode flag for downstream reveal logic.
 */

const GameModeFactory = require('../../../domain/strategies/GameModeFactory');
const {
    checkTeamCompleted,
    revealToSingleTeam,
    isTeamRevealedAnywhere,
    revealToLatePlayer
} = require('../../../sockets/utils/TeamRevealHelper');
const { checkAllTeamsCompleted, notifyTeamWaiting } = require('../../../sockets/utils/TeamManager');

/**
 * Process answer using the active game strategy and apply side effects.
 *
 * @param {Object} ctx - Mode execution context.
 * @returns {Promise<{modeResult: Object, isTeamMode: boolean}>}
 */
async function processAnswerByGameMode(ctx) {
    const {
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
        isCorrect,
        finalPointsEarned,
        answerResult,
        fullMultipleChoiceDetails,
        enrichedStreakInfo,
        players
    } = ctx;

    const teamConfig = teamConfigs.get(sPin);
    const isTeamMode = GameModeFactory.determineTeamMode({ teamConfig, game });
    const gameStrategy = GameModeFactory.createStrategy(isTeamMode);

    const modeResult = await gameStrategy.processAnswer({
        player: { nickname, socketId: payload.socket.id, playerId },
        answer: {
            isCorrect,
            pointsEarned: finalPointsEarned,
            isSurvey: answerResult.isSurvey,
            answerIndex: (flags.isOrderQuestion
                || flags.isMatchingQuestion
                || flags.isNumericQuestion
                || flags.isMultipleChoiceQuestion
                || flags.isWordSearchQuestion)
                ? null
                : payload.index,
            order: payload.order,
            matches: payload.matches,
            orderDetails: flags.isOrderQuestion ? answerResult.details : null,
            matchingDetails: flags.isMatchingQuestion ? answerResult.details : null,
            wordSearchDetails: flags.isWordSearchQuestion ? answerResult.details : null,
            multipleChoiceDetails: fullMultipleChoiceDetails,
            streakInfo: enrichedStreakInfo
        },
        game,
        question: currentQuestion,
        io,
        teamConfigs,
        ackManager,
        presenterNotification,
        checkTeamCompletedFn: checkTeamCompleted,
        checkAllTeamsCompletedFn: checkAllTeamsCompleted,
        players
    });

    // Equipo ya revelado (p. ej. por tiempo agotado): la respuesta llega tarde, como el
    // envío automático de ordenar/emparejar, y su resultado va directo al jugador.
    const playerTeam = modeResult.teamToReveal || modeResult.teamToNotifyWaiting;
    if (playerTeam && await isTeamRevealedAnywhere(game, sPin, playerTeam.name)) {
        await revealToLatePlayer({
            team: playerTeam,
            game,
            question: currentQuestion,
            io,
            roomId: sPin,
            nickname,
            socket: payload.socket
        });
    } else if (modeResult.teamToReveal) {
        await revealToSingleTeam({
            team: modeResult.teamToReveal,
            game,
            question: currentQuestion,
            io,
            roomId: sPin,
            players
        });
    } else if (modeResult.teamToNotifyWaiting) {
        await notifyTeamWaiting(modeResult.teamToNotifyWaiting, game, io, sPin, players);
    }

    return { modeResult, isTeamMode };
}

module.exports = {
    processAnswerByGameMode
};
