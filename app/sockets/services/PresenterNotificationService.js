/**
 * @fileoverview Servicio de notificaciones al presentador
 * @module sockets/services/PresenterNotificationService
 * 
 * Responsabilidades:
 * - Notificar al presentador cuando un jugador responde (usando AnswerBatchService)
 * - Centralizar toda comunicación con presentador
 * - Usar compresión y batching automático
 * 
 * Arquitectura:
 * - Usa AnswerBatchService para batching de respuestas
 * - Usa BroadcastOptimizer para ranking updates (vía PlayerScoredHandler)
 * - Mantiene modularidad <200 líneas
 */

const logger = require('../../config/logger');
const { roundScore } = require('../../services/game.logic');

class PresenterNotificationService {
    constructor(io, answerBatchService) {
        if (!io) throw new Error('io is required');
        if (!answerBatchService) throw new Error('answerBatchService is required');

        this.io = io;
        this.answerBatchService = answerBatchService;
    }

    /**
     * Notifica al presentador cuando un jugador responde
     * Usa batching automático para múltiples respuestas simultáneas
     * 
     * @param {Object} params
     * @param {string} params.roomId - ID del juego
     * @param {string} params.nickname - Nombre del jugador
     * @param {boolean} params.isCorrect - Respuesta correcta?
     * @param {number} params.pointsEarned - Puntos ganados
     * @param {number} params.totalScore - Score total
     * @param {number} params.questionIndex - Índice de pregunta
     * @param {number} params.answerIndex - Índice de respuesta seleccionada
     * @param {string} [params.teamName] - Nombre del equipo (modo equipos)
     */
    notifyPlayerAnswered(params) {
        const {
            roomId,
            nickname,
            isCorrect,
            pointsEarned,
            totalScore,
            questionIndex,
            answerIndex,
            teamName,
            streakInfo
        } = params;

        // Validar parámetros requeridos
        if (!roomId || !nickname || typeof questionIndex !== 'number') {
            logger.warn('Invalid params for notifyPlayerAnswered', { params });
            return;
        }

        const answerResult = {
            nickname,
            isCorrect: isCorrect ?? null, // null para encuestas
            points: roundScore(pointsEarned || 0),
            totalScore: roundScore(totalScore || 0),
            questionIndex,
            answerIndex,
            timestamp: Date.now()
        };

        // Añadir teamName si es modo equipos
        if (teamName) {
            answerResult.teamName = teamName;
        }

        // Añadir streakInfo si está disponible
        if (streakInfo) {
            answerResult.streakInfo = streakInfo;
        }

        // Usar AnswerBatchService para batching automático
        this.answerBatchService.addAnswer(roomId, answerResult);

        logger.debug('Player answer queued for presenter', {
            roomId,
            nickname,
            batched: true
        });
    }

    /**
     * Notifica al presentador cambio de estado del juego
     * (Usado para eventos que no son respuestas)
     * 
     * @param {string} roomId - ID del juego
     * @param {string} eventType - Tipo de evento
     * @param {Object} payload - Datos del evento
     */
    notifyGameEvent(roomId, eventType, payload) {
        if (!roomId || !eventType) {
            logger.warn('Invalid params for notifyGameEvent', { roomId, eventType });
            return;
        }

        this.io.to(`${roomId}:presenter`).emit(eventType, {
            ...payload,
            timestamp: Date.now()
        });

        logger.debug('Game event sent to presenter', {
            roomId,
            eventType
        });
    }

    /**
     * Fuerza el flush de todas las respuestas pendientes
     * Útil para fin de pregunta o fin de juego
     * 
     * @param {string} [roomId] - ID del juego (opcional, flush all si no se especifica)
     */
    forceFlush(roomId) {
        if (roomId) {
            this.answerBatchService.flush(roomId);
            logger.debug('Forced flush for room', { roomId });
        } else {
            this.answerBatchService.flushAll();
            logger.debug('Forced flush all rooms');
        }
    }

    /**
     * Obtiene estadísticas de batching
     * @returns {Object} Estadísticas
     */
    getStats() {
        return this.answerBatchService.getStats();
    }

    /**
     * Limpieza de recursos
     */
    cleanup() {
        this.answerBatchService.flushAll();
        logger.debug('PresenterNotificationService cleaned up');
    }
}

module.exports = PresenterNotificationService;
