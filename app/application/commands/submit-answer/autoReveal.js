/**
 * @fileoverview Timer auto-stop and reveal decision logic.
 * @module application/commands/submit-answer/autoReveal
 *
 * Purpose:
 * - Centralize "all answered" checks for trivial/team/individual modes.
 * - Stop question timer and trigger reveal when completion conditions are met.
 * - Keep reveal-lock behavior for clustered individual mode.
 */

const logger = require('../../../config/logger');
const { revealAnswer, endGameIfLastQuestion } = require('../../../sockets/utils/GameEndManager');
const { checkAllPlayersAnswered } = require('../../../sockets/utils/IndividualModeHelper');
const { acquireRevealLock } = require('../../../sockets/utils/AtomicAnswerCounter');
const { checkAllTrivialPlayersAnswered } = require('../../../sockets/handlers/trivial/TrivialAnswerGuard');

async function handleTrivialAutoReveal({ sPin, game, io, clearGameTimer, isTeamMode }) {
    const allAnswered = await checkAllTrivialPlayersAnswered(game, io);

    logger.debug('🔍 Trivial: checkAllTrivialPlayersAnswered result', {
        roomId: sPin,
        allAnswered,
        isTeamMode,
        totalPlayers: (game.players || []).filter((p) => p !== 'HOST').length,
        currentIndex: game.currentIndex
    });

    if (!allAnswered) {
        logger.debug('⏳ Trivial: not all players answered yet', { roomId: sPin });
        return { shouldReturn: false };
    }

    logger.info('🎯 Trivial: all players answered - stopping timer and revealing', {
        roomId: sPin,
        questionIndex: game.currentIndex
    });
    clearGameTimer(sPin);
    await revealAnswer({ roomId: sPin, game, io, timeExpired: false });

    return { shouldReturn: false };
}

async function handleTeamAutoReveal({ sPin, game, io, clearGameTimer, modeResult }) {
    const allTeamsCompleted = modeResult?.allTeamsCompleted || false;

    logger.debug('🔍 Team mode completion check', {
        roomId: sPin,
        allTeamsCompleted,
        currentIndex: game.currentIndex
    });

    if (!allTeamsCompleted) {
        logger.debug('⏳ Not all teams completed yet', { roomId: sPin });
        return { shouldReturn: false };
    }

    logger.info('🎯 All teams completed - stopping timer and revealing results', {
        roomId: sPin,
        questionIndex: game.currentIndex
    });
    clearGameTimer(sPin);
    await revealAnswer({ roomId: sPin, game, io, timeExpired: false });
    await endGameIfLastQuestion({ game, roomId: sPin, io });

    return { shouldReturn: false };
}

function resolveAllAnswered({ atomicProgress, game, players, io }) {
    if (atomicProgress) {
        return atomicProgress.allAnswered;
    }

    return checkAllPlayersAnswered(game, players, io, game.currentIndex);
}

async function handleIndividualAutoReveal({
    sPin,
    game,
    io,
    players,
    clearGameTimer,
    atomicProgress,
    lockMissResponse
}) {
    logger.debug('✅ Conditions met - checking if all players answered', { roomId: sPin });

    const allAnswered = await resolveAllAnswered({ atomicProgress, game, players, io });

    logger.debug('🔍 checkAllPlayersAnswered result', {
        roomId: sPin,
        allAnswered,
        expectedCount: atomicProgress?.expectedCount,
        answeredCount: atomicProgress?.answeredCount,
        totalPlayers: (game.players || []).filter((p) => p !== 'HOST').length,
        currentIndex: game.currentIndex
    });

    if (!allAnswered) {
        logger.debug('⏳ Not all players answered yet', { roomId: sPin });
        return { shouldReturn: false };
    }

    const revealLockAcquired = atomicProgress
        ? await acquireRevealLock({ roomId: sPin, questionIndex: game.currentIndex })
        : true;

    if (!revealLockAcquired) {
        logger.debug('Reveal lock not acquired - another worker is revealing', {
            roomId: sPin,
            questionIndex: game.currentIndex
        });
        return { shouldReturn: true, result: lockMissResponse };
    }

    logger.info('🎯 All players answered - stopping timer and revealing results', {
        roomId: sPin,
        questionIndex: game.currentIndex
    });
    clearGameTimer(sPin);
    await revealAnswer({ roomId: sPin, game, io, timeExpired: false });
    await endGameIfLastQuestion({ game, roomId: sPin, io });

    return { shouldReturn: false };
}

/**
 * Evaluate whether the question should be revealed immediately.
 *
 * @param {Object} ctx - Reveal evaluation context.
 * @returns {Promise<{shouldReturn: boolean, result?: Object}>}
 */
function handleAutoRevealAfterAnswer(ctx) {
    const {
        sPin,
        game,
        io,
        players,
        clearGameTimer,
        isTeamMode,
        modeResult,
        atomicProgress,
        lockMissResponse
    } = ctx;

    logger.debug('🔍 Checking auto-stop timer conditions', {
        roomId: sPin,
        isTeamMode,
        hasClearGameTimer: !!clearGameTimer,
        questionIndex: game.currentIndex,
        modeResult
    });

    if (game.isTrivial && clearGameTimer) {
        return handleTrivialAutoReveal({ sPin, game, io, clearGameTimer, isTeamMode });
    }

    if (isTeamMode && clearGameTimer) {
        return handleTeamAutoReveal({ sPin, game, io, clearGameTimer, modeResult });
    }

    if (!isTeamMode && clearGameTimer) {
        return handleIndividualAutoReveal({
            sPin,
            game,
            io,
            players,
            clearGameTimer,
            atomicProgress,
            lockMissResponse
        });
    }

    logger.debug('❌ Auto-stop conditions not met', {
        roomId: sPin,
        isTeamMode,
        hasClearGameTimer: !!clearGameTimer
    });

    return { shouldReturn: false };
}

module.exports = {
    handleAutoRevealAfterAnswer
};
