/**
 * @fileoverview Post-evaluation tracking for trivial mode and answer snapshots.
 * @module application/commands/submit-answer/answerTracking
 *
 * Purpose:
 * - Persist trivial round correctness signals used by reveal handlers.
 * - Mark sockets as answered for the current trivial epoch.
 * - Attach type-specific answer details back to player/socket state.
 */

const { getRedisClient } = require('../../../config/redis');
const { markAnsweredCurrentEpoch } = require('../../../sockets/handlers/trivial/TrivialAnswerGuard');

function runWithRedisClient(action) {
    Promise.resolve()
        .then(() => getRedisClient())
        .then(action)
        .catch(() => { });
}

/**
 * Persist trivial-specific correctness keys consumed during reveal.
 *
 * @param {Object} ctx - Trivial tracking context.
 * @returns {void}
 */
function trackTrivialResults(ctx) {
    const {
        game,
        teamConfigs,
        roomId,
        nickname,
        isCorrect,
        sPin
    } = ctx;

    if (!game.isTrivial) {
        return;
    }

    if (game.trivialMeta) {
        const actorNick = game.trivialMeta.actorNick;
        const teamConf = teamConfigs.get(sPin);
        const playerTeam = teamConf?.teams?.find((team) => team.players?.includes(nickname));
        const isActiveActor = actorNick === nickname;
        const isActiveTeamMember = playerTeam && playerTeam.name === actorNick;

        if (isActiveActor) {
            runWithRedisClient((client) => (
                client.set(`trivial:lastcorrect:${roomId}`, isCorrect ? '1' : '0', { EX: 3600 })
            ));
        } else if (isActiveTeamMember && isCorrect) {
            runWithRedisClient((client) => (
                client.set(`trivial:lastcorrect:${roomId}`, '1', { EX: 3600 })
            ));
        }
    }

    runWithRedisClient((client) => {
        const key = `trivial:roundresults:${roomId}`;
        return client.multi().hSet(key, nickname, isCorrect ? '1' : '0').expire(key, 3600).exec();
    });
}

/**
 * Mark this socket as answered in the current trivial epoch.
 *
 * @param {Object} socket - Player socket.
 * @param {Object} game - Active game.
 * @returns {void}
 */
function markCurrentEpochAnswer(socket, game) {
    markAnsweredCurrentEpoch(socket, game);
}

function getTypedDetailConfig(flags, answerResult, fullMultipleChoiceDetails) {
    if (flags.isOrderQuestion) {
        return { field: 'orderDetails', value: answerResult.details };
    }

    if (flags.isMatchingQuestion) {
        return { field: 'matchingDetails', value: answerResult.details };
    }

    if (flags.isNumericQuestion) {
        return { field: 'numericDetails', value: answerResult.details };
    }

    if (flags.isWordScrambleQuestion) {
        return { field: 'wordScrambleDetails', value: answerResult.details };
    }

    if (flags.isWordSearchQuestion) {
        return { field: 'wordSearchDetails', value: answerResult.details };
    }

    if (flags.isMultipleChoiceQuestion) {
        return { field: 'multipleChoiceDetails', value: fullMultipleChoiceDetails };
    }

    return null;
}

function applyTypedAnswerDetails(answerState, detailConfig, applyAnswerOutcome) {
    if (!answerState || !detailConfig) {
        return;
    }

    answerState[detailConfig.field] = detailConfig.value;
    applyAnswerOutcome(answerState);
}

/**
 * Attach question-type specific details to answer snapshots.
 *
 * @param {Object} ctx - Detail context.
 * @returns {void}
 */
function attachTypedAnswerDetails(ctx) {
    const {
        flags,
        game,
        player,
        socket,
        answerResult,
        isCorrect,
        finalPointsEarned,
        fullMultipleChoiceDetails
    } = ctx;

    const playerAnswer = player?.answers?.[game.currentIndex];
    const socketAnswer = socket?.data?.answers?.[game.currentIndex];

    const applyAnswerOutcome = (answerState) => {
        if (!answerState) {
            return;
        }

        answerState.isCorrect = isCorrect;
        answerState.pointsEarned = finalPointsEarned;
    };

    const detailConfig = getTypedDetailConfig(flags, answerResult, fullMultipleChoiceDetails);
    if (!detailConfig) {
        return;
    }

    applyTypedAnswerDetails(playerAnswer, detailConfig, applyAnswerOutcome);
    applyTypedAnswerDetails(socketAnswer, detailConfig, applyAnswerOutcome);
}

module.exports = {
    trackTrivialResults,
    markCurrentEpochAnswer,
    attachTypedAnswerDetails
};
