/**
 * @fileoverview Use Cases - Exports
 * @module application/use-cases
 */

const SubmitAnswerUseCase = require('./SubmitAnswerUseCase');
const AdvanceQuestionUseCase = require('./AdvanceQuestionUseCase');
const ReconnectPlayerUseCase = require('./ReconnectPlayerUseCase');
const StartGameUseCase = require('./StartGameUseCase');
const JoinGameUseCase = require('./JoinGameUseCase');
const EndGameUseCase = require('./EndGameUseCase');

module.exports = {
    // Week 11 Use Cases
    SubmitAnswerUseCase,
    AdvanceQuestionUseCase,
    ReconnectPlayerUseCase,
    // Week 12 Use Cases
    StartGameUseCase,
    JoinGameUseCase,
    EndGameUseCase
};
