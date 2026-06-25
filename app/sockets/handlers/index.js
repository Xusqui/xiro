/**
 * @fileoverview Exporta todos los handlers de eventos Socket.IO
 */

const JoinLobbyHandler = require('./JoinLobbyHandler');
const JoinPresenterLobbyHandler = require('./JoinPresenterLobbyHandler');
const StartGameHandler = require('./StartGameHandler');
const DisconnectHandler = require('./DisconnectHandler');
const SubmitAnswerHandler = require('./SubmitAnswerHandler');
const SimpleHandlers = require('./SimpleHandlers');
const ReconnectPlayerHandler = require('./ReconnectPlayerHandler');
const ReconnectPresenterHandler = require('./ReconnectPresenterHandler');
const GetCurrentStateHandler = require('./GetCurrentStateHandler');
const QuestionHandlers = require('./QuestionHandlers');
const EndGameHandler = require('./EndGameHandler');
const AbandonGameHandler = require('./AbandonGameHandler');

module.exports = {
    // Core handlers
    createJoinLobbyHandler: JoinLobbyHandler,
    createJoinPresenterLobbyHandler: JoinPresenterLobbyHandler,
    createStartGameHandler: StartGameHandler,
    createDisconnectHandler: DisconnectHandler,

    // Answer handling
    createSubmitAnswerHandler: SubmitAnswerHandler,

    // Timer controls
    createPauseTimerHandler: SimpleHandlers.createPauseTimerHandler,
    createResumeTimerHandler: SimpleHandlers.createResumeTimerHandler,

    // Team mode
    createSelectTeamHandler: SimpleHandlers.createSelectTeamHandler,

    // Reconnection
    createReconnectPlayerHandler: ReconnectPlayerHandler,
    createReconnectPresenterHandler: ReconnectPresenterHandler,
    createGetCurrentStateHandler: GetCurrentStateHandler,

    // Question flow
    createNextQuestionHandler: QuestionHandlers.createNextQuestionHandler,
    createRevealAnswerHandler: QuestionHandlers.createRevealAnswerHandler,
    createManualPointsHandler: QuestionHandlers.createManualPointsHandler,

    // Game control
    createEndGameHandler: EndGameHandler,
    createAbandonGameHandler: AbandonGameHandler,

    // Validation
    createValidateSessionHandler: SimpleHandlers.createValidateSessionHandler,

    // Misc
    createLeaveLobbyHandler: SimpleHandlers.createLeaveLobbyHandler,
    createErrorHandler: SimpleHandlers.createErrorHandler
};

