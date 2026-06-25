/**
 * @fileoverview Submit Answer Use Case - Flujo completo de envío de respuesta
 * @module application/use-cases/SubmitAnswerUseCase
 * 
 * Encapsula todo el flujo de negocio para enviar una respuesta:
 * 1. Rate limiting
 * 2. Validación
 * 3. Ejecución del comando
 * 4. Respuesta al cliente
 * 
 * Usa Chain of Responsibility pattern para pipeline modular.
 */

const {
    ValidationHandler,
    RateLimitHandler,
    CommandExecutionHandler,
    ResponseHandler,
    IdempotencyHandler
} = require('../chain');
const ImprovedSubmitAnswerCommand = require('../commands/ImprovedSubmitAnswerCommand');
const { validateSocket, schemas } = require('../../validation');
const { createRedisRateLimiter } = require('../helpers/SocketRateLimiterFactory');
const { getRedisClient } = require('../../config/redis');
const { getIdempotencyService } = require('../services/idempotency');
const logger = require('../../config/logger');

function hasRoom(data) {
    return !!(data.pin || data.sessionId);
}

function hasNickname(data) {
    return typeof data.nickname === 'string' && data.nickname.trim().length > 0;
}

function validateNumericPayload(data) {
    const numericValue = Number(data.playerAnswer);
    if (!hasRoom(data) || !hasNickname(data) || !Number.isFinite(numericValue)) {
        return {
            valid: false,
            errors: ['invalid numeric payload']
        };
    }

    return {
        valid: true,
        value: {
            ...data,
            playerAnswer: numericValue
        }
    };
}

function validateWordScramblePayload(data) {
    const hasPlayerAnswer = typeof data.playerAnswer === 'string' && data.playerAnswer.trim().length > 0;
    if (!hasRoom(data) || !hasNickname(data) || !hasPlayerAnswer) {
        return { valid: false, errors: ['invalid word_scramble payload'] };
    }
    return { valid: true, value: { ...data } };
}

function validateMultipleChoicePayload(data) {
    const hasSelectedIndices = Array.isArray(data.selectedIndices)
        && data.selectedIndices.length > 0
        && data.selectedIndices.length <= 6;

    if (!hasRoom(data) || !hasNickname(data) || !hasSelectedIndices) {
        return { valid: false, errors: ['invalid multiple_choice payload'] };
    }
    return { valid: true, value: { ...data } };
}

function validateMatchingPayload(data) {
    const hasMatches = Array.isArray(data.matches) && data.matches.length > 0;
    if (!hasRoom(data) || !hasNickname(data) || !hasMatches) {
        return { valid: false, errors: ['invalid matching payload'] };
    }
    return { valid: true, value: { ...data } };
}

const ANSWER_VALIDATORS = {
    numeric: validateNumericPayload,
    word_scramble: validateWordScramblePayload,
    multiple_choice: validateMultipleChoicePayload,
    matching: validateMatchingPayload
};

function validateSubmitAnswerPayload(data) {
    const validator = ANSWER_VALIDATORS[data?.answerType];
    if (validator) {
        return validator(data);
    }
    return validateSocket(schemas.submitAnswer, data);
}

function mapSubmitAnswerCommandContext(context) {
    return {
        pin: context.validatedData.pin,
        sessionId: context.validatedData.sessionId,
        nickname: context.validatedData.nickname,
        index: context.validatedData.index,
        order: context.validatedData.order,
        matches: context.validatedData.matches,
        answerType: context.validatedData.answerType,
        playerAnswer: context.validatedData.playerAnswer,
        selectedIndices: context.validatedData.selectedIndices,
        playerId: context.playerId,
        socket: context.socket,
        requestId: context.data.requestId
    };
}

function mapSubmitAnswerResponse(result, context) {
    if (!result.success) {
        return { ok: false, success: false, reason: result.reason };
    }
    if (result.duplicate) {
        return { ok: true, success: true, duplicate: true };
    }
    if (result.late) {
        return { ok: true, success: true, late: true };
    }
    if (context?.fromCache) {
        return { ok: true, success: true, fromCache: true };
    }
    if (result.waitingForTeams) {
        return { ok: true, success: true, waitingForTeams: true };
    }
    return { ok: true, success: true };
}

function chainHandlers({ idempotencyHandler, rateLimitHandler, validationHandler, commandHandler, responseHandler }) {
    rateLimitHandler.setNext(validationHandler);
    validationHandler.setNext(commandHandler);
    commandHandler.setNext(responseHandler);

    if (!idempotencyHandler) {
        return rateLimitHandler;
    }

    idempotencyHandler.setNext(rateLimitHandler);
    return idempotencyHandler;
}

class SubmitAnswerUseCase {
    constructor() {
        this.pipeline = this.buildPipeline();
    }

    /**
     * Construir el pipeline de procesamiento
     * @returns {Handler} Primera handler del pipeline
     */
    buildPipeline() {
        // 1. Idempotencia
        const idempotencyService = getIdempotencyService();
        const idempotencyHandler = idempotencyService
            ? new IdempotencyHandler(idempotencyService, 'submit-answer')
            : null;

        // 2. Rate Limiting
        const rateLimiter = createRedisRateLimiter({
            getRedisClient,
            windowMs: 1000,
            maxAttempts: 5
        });
        const rateLimitHandler = new RateLimitHandler(rateLimiter, 'submit-answer');

        // 3. Validación
        const validationHandler = new ValidationHandler(validateSubmitAnswerPayload);

        // 4. Ejecución del comando
        const commandHandler = new CommandExecutionHandler(
            ImprovedSubmitAnswerCommand,
            mapSubmitAnswerCommandContext
        );

        // 5. Respuesta
        const responseHandler = new ResponseHandler(mapSubmitAnswerResponse);

        return chainHandlers({
            idempotencyHandler,
            rateLimitHandler,
            validationHandler,
            commandHandler,
            responseHandler
        });
    }

    /**
     * Ejecutar el use case
     * @param {Object} context - Contexto de la request
     * @param {Object} context.socket - Socket del jugador
     * @param {Object} context.data - Datos de la respuesta
     * @param {Function} context.callback - Callback para acknowledgment
     * @param {Object} context.dependencies - Dependencias (activeGames, players, etc.)
     * @param {string} context.playerId - ID del jugador
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    async execute(context) {
        try {
            logger.debug('SubmitAnswerUseCase starting', {
                answerType: context?.data?.answerType,
                hasSelectedIndices: Array.isArray(context?.data?.selectedIndices),
                playerId: context?.playerId,
                nickname: context?.data?.nickname
            });

            const result = await this.pipeline.handle(context);

            logger.debug('SubmitAnswerUseCase pipeline result', {
                success: result?.success,
                reason: result?.reason,
                answerType: context?.data?.answerType
            });

            if (context?.callback && typeof context.callback === 'function' && result?.success === false) {
                const reasonMap = {
                    'validation-failed': 'invalid-payload',
                    'rate-limited': 'rate-limited'
                };
                context.callback({ ok: false, reason: reasonMap[result.reason] || result.reason || 'invalid-payload' });
            }

            return result;
        } catch (error) {
            logger.error('Error in SubmitAnswerUseCase', {
                error: error.message,
                stack: error.stack
            });

            if (context?.callback && typeof context.callback === 'function') {
                context.callback({ ok: false, reason: 'server-error' });
            }

            return {
                success: false,
                reason: 'server-error',
                message: 'Error al procesar respuesta',
                code: 'SUBMIT_ANSWER_SERVER_ERROR'
            };
        }
    }
}

module.exports = SubmitAnswerUseCase;
