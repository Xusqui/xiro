/**
 * @fileoverview Thin command facade for submit-answer flow.
 * @module application/commands/ImprovedSubmitAnswerCommand
 *
 * Purpose:
 * - Preserve external command API used by the use case and tests.
 * - Delegate validation and execution to split, documented modules.
 */

const Command = require('./Command');
const {
    executeSubmitAnswer,
    validateSubmitAnswerPayload
} = require('./submit-answer/executeSubmitAnswer');

class ImprovedSubmitAnswerCommand extends Command {
    /**
     * @param {Object} payload - Submit answer payload.
     */
    constructor(payload) {
        super(payload);
    }

    /**
     * Validate command payload shape.
     *
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate() {
        return validateSubmitAnswerPayload(this.payload);
    }

    /**
     * Execute full submit-answer behavior.
     *
     * @param {Object} dependencies - Runtime dependencies.
     * @returns {Promise<Object>} Command result.
     */
    execute(dependencies) {
        return executeSubmitAnswer(this.payload, dependencies);
    }
}

module.exports = ImprovedSubmitAnswerCommand;
