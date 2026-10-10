/**
 * @fileoverview Payload validation for submit-answer command.
 * @module application/commands/submit-answer/validatePayload
 *
 * Purpose:
 * - Keep command boundary validation in one place.
 * - Enforce required identity fields (room, nickname, playerId).
 * - Accept all supported answer shapes used by the current protocol.
 */

/**
 * Validate raw payload coming from the use case/chain layer.
 * This function intentionally mirrors the previous command behavior.
 *
 * @param {Object} payload - Raw command payload.
 * @returns {{valid: boolean, errors: string[]}} Validation result.
 */
const { isValidFoundPayload } = require('../../validators/WordSearchQuestionValidator');

function hasLegacyAnswerShape(payload) {
    return typeof payload.index === 'number' || Array.isArray(payload.order);
}

const typedAnswerValidators = {
    matching: (payload) => Array.isArray(payload.matches),
    numeric: (payload) => Number.isFinite(Number(payload.playerAnswer)),
    word_scramble: (payload) => typeof payload.playerAnswer === 'string',
    multiple_choice: (payload) => Array.isArray(payload.selectedIndices) && payload.selectedIndices.length > 0,
    word_search: (payload) => isValidFoundPayload(payload.found)
};

function hasTypedAnswerShape(payload) {
    const validator = typedAnswerValidators[payload.answerType];
    if (!validator) {
        return false;
    }
    return validator(payload);
}

function hasSupportedAnswerShape(payload) {
    return hasLegacyAnswerShape(payload) || hasTypedAnswerShape(payload);
}

function validateSubmitAnswerPayload(payload = {}) {
    const errors = [];
    const { pin, sessionId, nickname, playerId } = payload;

    if (!pin && !sessionId) errors.push('pin or sessionId is required');
    if (!nickname) errors.push('nickname is required');

    if (!hasSupportedAnswerShape(payload)) {
        errors.push('index, order, matches, numeric playerAnswer, word_scramble, word_search found or multiple_choice selectedIndices is required');
    }

    if (!playerId) errors.push('playerId is required');

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateSubmitAnswerPayload
};
