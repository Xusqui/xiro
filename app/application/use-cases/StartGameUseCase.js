/**
 * @fileoverview Use Case - Start Game
 * @module application/use-cases/StartGameUseCase
 * 
 * Encapsula el flujo completo de iniciar una partida:
 * - Idempotencia (evita inicio duplicado)
 * - Validación de PIN, preguntas y jugadores
 * - Verificación de rate limiting
 * - Ejecución del comando de inicio
 * - Emisión de eventos de dominio
 */

const ImprovedStartGameCommand = require('../commands/ImprovedStartGameCommand');
const { ValidationHandler, RateLimitHandler, CommandExecutionHandler, ResponseHandler, IdempotencyHandler } = require('../chain');
const logger = require('../../config/logger');
const { getIdempotencyService } = require('../services/idempotency');
const { createRedisRateLimiter } = require('../helpers/SocketRateLimiterFactory');
const { getRedisClient } = require('../../config/redis');

/**
 * Use Case para iniciar una partida
 */
class StartGameUseCase {
    /**
     * @param {Object} dependencies - Dependencias inyectadas
     */
    constructor(dependencies = {}) {
        this.dependencies = dependencies;
        this.setupChain();
    }

    /**
     * Configurar Chain of Responsibility
     */
    setupChain() {
        // 1. Idempotencia (evita inicio duplicado)
        const idempotencyService = getIdempotencyService();
        const idempotencyHandler = idempotencyService
            ? new IdempotencyHandler(idempotencyService, 'start-game')
            : null;

        // 2. Validación de entrada
        const validationHandler = new ValidationHandler(
            this.validateStartGameInput.bind(this),
            {
                passFullContext: true,
                requireData: false,
                requirePlayerId: false
            }
        );

        // 3. Rate Limiting — distributed via Redis, local fallback
        const rateLimiter = createRedisRateLimiter({
            getRedisClient,
            windowMs: 10000,
            maxAttempts: 3 // Más restrictivo para start-game
        });

        const rateLimitHandler = new RateLimitHandler(rateLimiter, 'start-game');

        // 4. Ejecución del comando
        const commandHandler = new CommandExecutionHandler(
            ImprovedStartGameCommand,
            (context) => ({
                roomId: context.roomId,
                io: context.io
            })
        );

        // 5. Respuesta al cliente
        const responseHandler = new ResponseHandler((result, context) => {
            if (!result.success) {
                return { success: false, error: result.error, code: result.code, ...(result.params && { params: result.params }) };
            }
            // Devolver todos los datos del comando
            return {
                success: true,
                gameState: result.gameState,
                preparedQuestions: result.preparedQuestions,
                playersInLobby: result.playersInLobby,
                fromCache: context?.fromCache || false
            };
        });

        // Encadenar handlers
        let firstHandler;

        if (idempotencyHandler) {
            // Con idempotencia: Idempotency -> Validation -> RateLimit -> Command -> Response
            idempotencyHandler.setNext(validationHandler);
            validationHandler.setNext(rateLimitHandler);
            rateLimitHandler.setNext(commandHandler);
            commandHandler.setNext(responseHandler);
            firstHandler = idempotencyHandler;
        } else {
            // Sin idempotencia: Validation -> RateLimit -> Command -> Response
            validationHandler.setNext(rateLimitHandler);
            rateLimitHandler.setNext(commandHandler);
            commandHandler.setNext(responseHandler);
            firstHandler = validationHandler;
        }

        this.chain = firstHandler;
    }

    /**
     * Validar entrada del use case
     */
    validateStartGameInput(context) {
        const errors = [];
        const { roomId, socket } = context;

        if (!roomId || typeof roomId !== 'string') {
            errors.push('roomId is required and must be a string');
        }

        if (!socket || typeof socket.emit !== 'function') {
            errors.push('socket is required and must be a Socket.IO instance');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Ejecutar use case
     * @param {Object} params - Parámetros
     * @param {string} params.roomId - ID de la sala (único por partida)
     * @param {Socket} params.socket - Socket del presentador
     * @returns {Promise<Object>} Resultado de la ejecución
     */
    async execute({ roomId, socket }) {
        const context = {
            roomId,
            socket,
            io: this.dependencies.io, // Necesario para ImprovedStartGameCommand
            dependencies: this.dependencies, // Necesario para rate limiting
            startedAt: Date.now()
        };

        try {
            const result = await this.chain.handle(context);

            // Logging para monitoreo
            if (result.success) {
                logger.info(`StartGameUseCase: Partida ${roomId} iniciada exitosamente`);
            } else {
                logger.warn(`StartGameUseCase: Error al iniciar ${roomId}`, { error: result.error });
            }

            return result;

        } catch (error) {
            logger.error('StartGameUseCase: Error crítico', { error: error.message, stack: error.stack });
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}

module.exports = StartGameUseCase;
