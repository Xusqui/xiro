/**
 * @fileoverview Handler para el evento QuestionRevealedEvent
 * @module domain/events/handlers/QuestionRevealedHandler
 * 
 * Responsabilidades:
 * - Emitir pregunta a jugadores (con/sin respuestas según configuración)
 * - Emitir pregunta completa al presentador
 * - Iniciar timer de pregunta
 * - Reset de estado de respuestas
 */

const EventHandler = require('./EventHandler');

class QuestionRevealedHandler extends EventHandler {
    constructor(eventBus, io, dependencies = {}) {
        super(eventBus, io, dependencies);
    }

    register() {
        this.subscribe('question.revealed', this.handleQuestionRevealed.bind(this), 8);
        this.log('info', 'QuestionRevealedHandler registered');
    }

    async handleQuestionRevealed(event) {
        const { roomId, gameId, question, questionIndex, showAnswersToPlayers: _showAnswersToPlayers, timeLimit, totalQuestions } = event.payload || event;
        const actualRoomId = roomId || gameId;

        try {
            this.log('info', 'Processing question revealed event', {
                roomId: actualRoomId,
                questionIndex,
                questionType: question?.question_type || question?.slide_type,
                timeLimit: question?.time_limit,
                hasQuestion: !!question
            });

            // Validación: asegurar que question existe
            if (!question) {
                this.log('error', 'Question is undefined in event', { event });
                throw new Error('Question is required in QuestionRevealedEvent');
            }

            // Obtener totalQuestions del activeGame si no viene en el evento
            const activeGames = this.dependencies.activeGames;
            const game = activeGames?.get(actualRoomId);
            const total = totalQuestions || game?.questions?.length || 0;

            // 1. Emitir a jugadores (payload compatible con frontend actual)
            await this.notifyPlayers(actualRoomId, question, questionIndex, total);

            // 2. Emitir a presentador (payload compatible con frontend actual)
            await this.notifyPresenter(actualRoomId, question, questionIndex, total);

            // 3. Emitir evento de timer iniciado
            const actualTimeLimit = timeLimit || question.time_limit;
            if (actualTimeLimit) {
                this.eventBus.emit('timer.started', {
                    roomId: actualRoomId,
                    duration: actualTimeLimit,
                    questionIndex,
                    questionType: question?.question_type || question?.slide_type,
                    startedAt: Date.now()
                });
            }

            this.log('info', 'Question revealed event processed', {
                roomId: actualRoomId,
                questionIndex,
                questionType: question?.question_type || question?.slide_type,
                timeLimit: question?.time_limit,
                totalQuestions: total
            });

        } catch (error) {
            this.log('error', 'Error processing question revealed event', {
                roomId: actualRoomId,
                questionIndex,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Notificar a jugadores (formato compatible con frontend actual)
     * Frontend espera: { question: {...}, currentIndex: N, totalQuestions: N }
     */
    notifyPlayers(roomId, question, questionIndex, totalQuestions) {
        const playersRoom = `${roomId}:players`;

        // Sanitizar pregunta para jugadores (sin respuestas correctas)
        const { sanitizeQuestionForPlayers } = require('../../../services/payload.sanitizer');
        const sanitizedQuestion = sanitizeQuestionForPlayers(question);

        const payload = {
            question: sanitizedQuestion,
            currentIndex: questionIndex,
            totalQuestions
        };

        // Broadcast via Redis Adapter (multi-worker compatible)
        this.io.to(playersRoom).emit('new-question', payload);

        this.log('debug', 'Notified players of new question', {
            roomId,
            questionIndex,
            totalQuestions
        });
    }

    /**
     * Notificar al presentador (formato compatible con frontend actual)
     * Frontend espera: { question: {...}, currentIndex: N, totalQuestions: N }
     */
    notifyPresenter(roomId, question, questionIndex, totalQuestions) {
        const presenterRoom = `${roomId}:presenter`;

        const payload = {
            question,
            currentIndex: questionIndex,
            totalQuestions
        };

        // Broadcast via Redis Adapter (multi-worker compatible)
        this.io.to(presenterRoom).emit('new-question', payload);

        this.log('debug', 'Notified presenter of new question', {
            roomId,
            questionIndex,
            totalQuestions
        });
    }
}

module.exports = QuestionRevealedHandler;
