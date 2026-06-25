/**
 * @fileoverview Answer Batch Service - Agrupa respuestas simultáneas
 * @module sockets/services/AnswerBatchService
 * 
 * Responsabilidades:
 * - Agrupar answer-result de múltiples jugadores
 * - Enviar en un solo broadcast cuando sea beneficioso
 * - Auto-flush después de timeout o cuando batch está lleno
 */

const logger = require('../../config/logger');

class AnswerBatchService {
    constructor(io) {
        this.io = io;
        this.batches = new Map(); // roomId → {answers: [], timeout}
        this.BATCH_TIMEOUT_MS = 100; // Esperar 100ms para agrupar
        this.MAX_BATCH_SIZE = 10; // Flush automático si >10 respuestas
        this.stats = {
            totalAnswers: 0,
            totalBatches: 0,
            answersSaved: 0
        };
    }

    /**
     * Agregar respuesta al batch
     * 
     * @param {string} roomId - ID de la sala
     * @param {Object} answerResult - Resultado de la respuesta
     */
    addAnswer(roomId, answerResult) {
        this.stats.totalAnswers++;

        logger.debug('➕ Adding answer to batch', {
            roomId,
            nickname: answerResult.nickname,
            isCorrect: answerResult.isCorrect,
            currentBatchSize: this.batches.get(roomId)?.answers.length || 0
        });

        // Crear batch si no existe
        if (!this.batches.has(roomId)) {
            this.batches.set(roomId, {
                answers: [],
                timeout: null,
                firstAnswerTime: Date.now()
            });
        }

        const batch = this.batches.get(roomId);
        batch.answers.push(answerResult);

        // Cancelar timeout anterior
        if (batch.timeout) {
            clearTimeout(batch.timeout);
        }

        // Smart flush: si batch está lleno, enviar inmediatamente
        if (batch.answers.length >= this.MAX_BATCH_SIZE) {
            this.flush(roomId);
            return;
        }

        const elapsed = Date.now() - batch.firstAnswerTime;
        const maxRemaining = 250 - elapsed;

        if (maxRemaining <= 0) {
            this.flush(roomId);
            return;
        }

        const actualDelay = Math.min(this.BATCH_TIMEOUT_MS, maxRemaining);

        // Programar flush después de timeout
        batch.timeout = setTimeout(() => {
            this.flush(roomId);
        }, actualDelay);
    }

    /**
     * Enviar batch de respuestas
     * 
     * @param {string} roomId - ID de la sala
     */
    flush(roomId) {
        const batch = this.batches.get(roomId);

        if (!batch || batch.answers.length === 0) {
            return;
        }

        // Cancelar timeout
        if (batch.timeout) {
            clearTimeout(batch.timeout);
            batch.timeout = null;
        }

        // Enviar batch
        if (batch.answers.length === 1) {
            // Si solo hay 1, enviar individual (sin overhead de batch)
            logger.debug('📤 Sending answer-result to presenter (individual)', {
                roomId,
                nickname: batch.answers[0].nickname,
                isCorrect: batch.answers[0].isCorrect
            });
            this.io.to(`${roomId}:presenter`).emit('answer-result', batch.answers[0]);
        } else {
            // Enviar batch
            logger.debug('📦 Sending answer-result-batch to presenter', {
                roomId,
                count: batch.answers.length,
                players: batch.answers.map(a => a.nickname)
            });
            const batchPayload = { answers: batch.answers, count: batch.answers.length, timestamp: Date.now() };
            logger.debug('📦 answer-result-batch emit', {
                roomId,
                count: batch.answers.length
            });
            this.io.to(`${roomId}:presenter`).emit('answer-result-batch', batchPayload);

            this.stats.answersSaved += (batch.answers.length - 1);
        }

        this.stats.totalBatches++;

        // Limpiar batch
        this.batches.delete(roomId);
    }

    /**
     * Flush todos los batches pendientes (al finalizar pregunta)
     */
    flushAll() {
        for (const roomId of this.batches.keys()) {
            this.flush(roomId);
        }
    }

    /**
     * Limpiar batch de una sala (al finalizar juego)
     * 
     * @param {string} roomId - ID de la sala
     */
    clear(roomId) {
        const batch = this.batches.get(roomId);
        if (batch && batch.timeout) {
            clearTimeout(batch.timeout);
        }
        this.batches.delete(roomId);
    }

    /**
     * Limpiar todos los batches
     */
    clearAll() {
        for (const batch of this.batches.values()) {
            if (batch.timeout) {
                clearTimeout(batch.timeout);
            }
        }
        this.batches.clear();
    }

    /**
     * Obtener estadísticas
     */
    getStats() {
        const savePercent = this.stats.totalAnswers > 0
            ? ((this.stats.answersSaved / this.stats.totalAnswers) * 100).toFixed(1)
            : 0;

        return {
            totalAnswers: this.stats.totalAnswers,
            totalBatches: this.stats.totalBatches,
            answersSaved: this.stats.answersSaved,
            savePercent: parseFloat(savePercent),
            avgBatchSize: this.stats.totalBatches > 0
                ? (this.stats.totalAnswers / this.stats.totalBatches).toFixed(1)
                : 0
        };
    }

    /**
     * Reset estadísticas
     */
    resetStats() {
        this.stats = {
            totalAnswers: 0,
            totalBatches: 0,
            answersSaved: 0
        };
    }

    /**
     * Obtener estado actual de batches
     */
    getStatus() {
        const batches = [];
        for (const [roomId, batch] of this.batches.entries()) {
            batches.push({
                roomId,
                pendingAnswers: batch.answers.length,
                hasTimeout: batch.timeout !== null
            });
        }
        return batches;
    }
}

module.exports = AnswerBatchService;
