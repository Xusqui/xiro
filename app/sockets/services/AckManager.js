/**
 * @fileoverview AckManager - Gestión de acknowledgments con retry automático
 * @module sockets/services/AckManager
 * 
 * Responsabilidades:
 * - Enviar mensajes críticos con acknowledgment
 * - Retry automático si no se recibe ACK en timeout
 * - Tracking de mensajes pendientes
 * - Limpieza de mensajes expirados
 * - Métricas de entrega
 * 
 * Casos de uso:
 * - answer-result: Confirmación de respuesta procesada
 * - game-started: Confirmación de inicio de juego
 * - question-revealed: Confirmación de recepción de pregunta
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');

class AckManager extends EventEmitter {
    /**
     * @param {Object} options - Opciones de configuración
     * @param {number} options.timeout - Timeout para ACK en ms (default: 5000)
     * @param {number} options.maxRetries - Máximo de reintentos (default: 3)
     * @param {number} options.retryDelay - Delay entre reintentos en ms (default: 1000)
     */
    constructor(options = {}) {
        super();

        this.timeout = options.timeout || 5000; // 5 segundos
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 segundo

        // Mapa de mensajes pendientes: messageId -> { socket, event, data, attempts, timeoutId }
        this.pendingMessages = new Map();

        // Estadísticas
        this.stats = {
            sent: 0,
            acknowledged: 0,
            failed: 0,
            retried: 0
        };

        logger.info('AckManager initialized', {
            ...getWorkerContext(),
            timeout: this.timeout,
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay
        });
    }

    /**
     * Envía mensaje con acknowledgment y retry automático
     * @param {Socket} socket - Socket.io socket
     * @param {string} event - Nombre del evento
     * @param {Object} data - Datos a enviar
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<boolean>} true si ACK recibido, false si falló
     */
    emitWithAck(socket, event, data, options = {}) {
        const messageId = this._generateMessageId(socket.id, event);
        const maxRetries = options.maxRetries || this.maxRetries;

        this.stats.sent++;

        logger.debug('Sending message with ACK', {
            messageId,
            event,
            socketId: socket.id
        });

        return new Promise((resolve) => {
            const message = {
                socket,
                event,
                data,
                attempts: 0,
                maxRetries,
                messageId,
                resolve,
                timeoutId: null
            };

            this.pendingMessages.set(messageId, message);
            this._sendMessage(message);
        });
    }

    /**
     * Envía el mensaje y establece timeout
     * @private
     */
    _sendMessage(message) {
        const { socket, event, data, messageId, maxRetries } = message;

        // Verificar si socket aún está conectado
        if (!socket.connected) {
            logger.warn('Socket disconnected, cannot send message', {
                messageId,
                event
            });
            this._handleFailure(message);
            return;
        }

        message.attempts++;

        // Enviar con callback para ACK
        socket.emit(event, data, (ackData) => {
            this._handleAck(messageId, ackData);
        });

        // Establecer timeout
        message.timeoutId = setTimeout(() => {
            this._handleTimeout(messageId);
        }, this.timeout);

        logger.debug('Message sent', {
            messageId,
            event,
            attempt: message.attempts,
            maxRetries
        });
    }

    /**
     * Maneja ACK recibido del cliente
     * @private
     */
    _handleAck(messageId, ackData) {
        const message = this.pendingMessages.get(messageId);

        if (!message) {
            // Ya fue procesado o expiró
            return;
        }

        // Limpiar timeout
        if (message.timeoutId) {
            clearTimeout(message.timeoutId);
        }

        this.pendingMessages.delete(messageId);
        this.stats.acknowledged++;

        logger.debug('ACK received', {
            messageId,
            event: message.event,
            attempts: message.attempts,
            ackData
        });

        // Emitir evento de éxito
        this.emit('message-acknowledged', {
            messageId,
            event: message.event,
            attempts: message.attempts,
            ackData
        });

        // Resolver promesa
        message.resolve(true);
    }

    /**
     * Maneja timeout (no se recibió ACK)
     * @private
     */
    _handleTimeout(messageId) {
        const message = this.pendingMessages.get(messageId);

        if (!message) {
            return;
        }

        logger.warn('ACK timeout', {
            messageId,
            event: message.event,
            attempt: message.attempts,
            maxRetries: message.maxRetries
        });

        // Reintentar si no se superó el máximo
        if (message.attempts < message.maxRetries) {
            this.stats.retried++;

            logger.info('Retrying message', {
                messageId,
                event: message.event,
                attempt: message.attempts + 1,
                maxRetries: message.maxRetries
            });

            // Reintentar después del delay
            setTimeout(() => {
                if (this.pendingMessages.has(messageId)) {
                    this._sendMessage(message);
                }
            }, this.retryDelay);
        } else {
            // Máximo de reintentos alcanzado
            this._handleFailure(message);
        }
    }

    /**
     * Maneja fallo definitivo (máximo de reintentos alcanzado)
     * @private
     */
    _handleFailure(message) {
        const { messageId, event, attempts, maxRetries } = message;

        this.pendingMessages.delete(messageId);
        this.stats.failed++;

        logger.error('Message delivery failed', {
            messageId,
            event,
            attempts,
            maxRetries
        });

        // Emitir evento de fallo
        this.emit('message-failed', {
            messageId,
            event,
            attempts,
            reason: 'max_retries_exceeded'
        });

        // Resolver promesa con false
        message.resolve(false);
    }

    /**
     * Genera ID único para el mensaje
     * @private
     */
    _generateMessageId(socketId, event) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        return `${socketId}-${event}-${timestamp}-${random}`;
    }

    /**
     * Limpia mensajes pendientes de un socket (útil al desconectar)
     * @param {string} socketId - ID del socket
     */
    cleanupSocket(socketId) {
        let cleaned = 0;

        for (const [messageId, message] of this.pendingMessages.entries()) {
            if (message.socket.id === socketId) {
                if (message.timeoutId) {
                    clearTimeout(message.timeoutId);
                }
                this.pendingMessages.delete(messageId);
                message.resolve(false);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info('Cleaned pending messages for disconnected socket', {
                socketId,
                cleaned
            });
        }
    }

    /**
     * Obtiene estadísticas del manager
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            pending: this.pendingMessages.size,
            successRate: this.stats.sent > 0
                ? ((this.stats.acknowledged / this.stats.sent) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Resetea estadísticas (útil para testing)
     */
    resetStats() {
        this.stats = {
            sent: 0,
            acknowledged: 0,
            failed: 0,
            retried: 0
        };
    }

    /**
     * Limpieza completa (para shutdown)
     */
    cleanup() {
        // Limpiar todos los timeouts
        for (const message of this.pendingMessages.values()) {
            if (message.timeoutId) {
                clearTimeout(message.timeoutId);
            }
            message.resolve(false);
        }

        this.pendingMessages.clear();
        this.removeAllListeners();

        logger.info('AckManager cleaned up', {
            messagesCancelled: this.pendingMessages.size
        });
    }
}

module.exports = AckManager;
