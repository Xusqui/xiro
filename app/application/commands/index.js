/**
 * @fileoverview Índice de comandos CQRS
 * @module application/commands
 * 
 * MIGRADO: EndGameCommand y NextQuestionCommand eliminados
 * Usar EndGameUseCase y AdvanceQuestionUseCase directamente
 */

const Command = require('./Command');
const ImprovedStartGameCommand = require('./ImprovedStartGameCommand');
const ImprovedSubmitAnswerCommand = require('./ImprovedSubmitAnswerCommand');
const JoinGameCommand = require('./JoinGameCommand');

// Legacy aliases kept for compatibility with old imports/tests.
const StartGameCommand = ImprovedStartGameCommand;
const SubmitAnswerCommand = ImprovedSubmitAnswerCommand;

module.exports = {
    Command,
    // @deprecated — solo se usan en tests unitarios legacy.
    // En producción se usan ImprovedStartGameCommand e ImprovedSubmitAnswerCommand.
    StartGameCommand,
    SubmitAnswerCommand,
    // EndGameCommand - ELIMINADO (usar EndGameUseCase)
    // NextQuestionCommand - ELIMINADO (usar AdvanceQuestionUseCase)
    ImprovedStartGameCommand,  // ← comando activo en producción
    ImprovedSubmitAnswerCommand, // ← comando activo en producción
    JoinGameCommand
};
