/**
 * @fileoverview Use Case - Join Game
 * @module application/use-cases/JoinGameUseCase
 * 
 * Encapsula el flujo completo de unirse a un lobby:
 * - Idempotencia (evita doble-join)
 * - Validación de PIN, nickname y capacidad
 * - Verificación de rate limiting
 * - Registro del jugador
 * - Emisión de eventos de dominio
 * - Manejo de modo individual/equipos
 */

const JoinGameCommand = require('../commands/JoinGameCommand');
const { ValidationHandler, RateLimitHandler, CommandExecutionHandler, ResponseHandler, IdempotencyHandler } = require('../chain');
const logger = require('../../config/logger');
const { validateJoinGameInput } = require('../validators/JoinGameValidator');
const { validateSessionAccessCapacity } = require('../validators/SessionAccessCapacityValidator');
const { getIdempotencyService } = require('../services/idempotency');
const { createRedisRateLimiter } = require('../helpers/SocketRateLimiterFactory');
const { getRedisClient } = require('../../config/redis');

/**
 * Use Case para unirse a una partida
 */
class JoinGameUseCase {
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
        // 1. Idempotencia (evita procesamiento duplicado)
        const idempotencyService = getIdempotencyService();
        const idempotencyHandler = idempotencyService
            ? new IdempotencyHandler(idempotencyService, 'join-game')
            : null;

        // 2. Validación de entrada
        const validationHandler = new ValidationHandler(
            this.validateJoinGameInput.bind(this),
            {
                passFullContext: true,
                requireData: false, // JoinGame recibe datos directamente en context
                requirePlayerId: false // No requiere playerId
            }
        );

        // 3. Rate Limiting — distributed via Redis, local fallback
        const rateLimiter = createRedisRateLimiter({
            getRedisClient,
            windowMs: 10000,
            maxAttempts: 5
        });

        const rateLimitHandler = new RateLimitHandler(rateLimiter, 'join-game');

        // 4. Ejecución del comando
        const commandHandler = new CommandExecutionHandler(
            JoinGameCommand,
            (context) => ({
                pin: context.pin,
                sessionId: context.sessionId,
                nickname: context.nickname,
                sessionSecret: context.sessionSecret,
                socket: context.socket,
                isTeamMode: context.isTeamMode,
                teamConfig: context.teamConfig
            })
        );

        // 5. Respuesta al cliente
        const responseHandler = new ResponseHandler((result, _context) => {
            if (!result.success) {
                return {
                    success: false,
                    error: result.error,
                    reason: result.reason,
                    code: result.code,
                    params: result.params
                };
            }

            // Jugador desconectado que reclamó su nickname con la partida ya
            // en marcha (ver JoinGameCommand._reconnectExistingPlayer): el
            // handler necesita player/game, no los campos de alta de lobby.
            if (result.isReconnect) {
                return {
                    success: true,
                    isReconnect: true,
                    roomId: result.roomId,
                    playerId: result.playerId,
                    player: result.player,
                    game: result.game
                };
            }

            // Devolver todos los datos del comando
            return {
                success: true,
                roomId: result.roomId,
                playerId: result.playerId,
                nickname: result.nickname,
                playersInLobby: result.playersInLobby,
                teamMode: result.teamMode,
                sessionSecret: result.sessionSecret
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
    validateJoinGameInput(context) {
        return validateJoinGameInput(context);
    }

    /**
     * Ejecutar el use case
     * @param {Object} params - Parámetros
     * @param {string} params.pin - PIN del juego
     * @param {string} params.sessionId - ID de sesión (opcional)
     * @param {string} params.nickname - Nickname del jugador
     * @param {string} [params.sessionSecret] - Secreto de sesión (reclaim presentador)
     * @param {Socket} params.socket - Socket del jugador
     * @param {boolean} [params.isTeamMode] - Modo equipos (solo HOST)
     * @param {Object} [params.teamConfig] - Configuración equipos (solo HOST)
     * @returns {Promise<Object>} Resultado de la ejecución
     */
    async execute({ pin, sessionId, nickname, sessionSecret, socket, isTeamMode, teamConfig }) {
        const context = {
            pin,
            sessionId,
            nickname,
            sessionSecret,
            socket,
            isTeamMode,
            teamConfig,
            dependencies: this.dependencies, // ✅ Pasar dependencias al context
            startedAt: Date.now()
        };

        try {
            const sessionAccessCapacity = await validateSessionAccessCapacity({
                pin,
                sessionId,
                nickname,
                dependencies: this.dependencies
            });

            if (!sessionAccessCapacity.valid) {
                return {
                    success: false,
                    error: sessionAccessCapacity.message,
                    reason: sessionAccessCapacity.reason,
                    code: sessionAccessCapacity.code,
                    params: sessionAccessCapacity.params
                };
            }

            const result = await this.chain.handle(context);

            // Logging para monitoreo
            if (result.success) {
                logger.info(`JoinGameUseCase: ${nickname} unido a ${pin || sessionId}`);
            } else {
                logger.warn(`JoinGameUseCase: Error al unir ${nickname} a ${pin || sessionId}`, { error: result.error });
            }

            return result;

        } catch (error) {
            logger.error('JoinGameUseCase: Error crítico', { error: error.message, stack: error.stack });
            return {
                success: false,
                error: error.message,
                code: 'INTERNAL_ERROR',
                timestamp: Date.now()
            };
        }
    }
}

module.exports = JoinGameUseCase;
