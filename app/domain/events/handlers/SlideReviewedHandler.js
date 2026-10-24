/**
 * @fileoverview Handler para el evento SlideReviewedEvent (juegos personalizados)
 * @module domain/events/handlers/SlideReviewedHandler
 *
 * El presentador revisa una diapositiva ya mostrada:
 * - Presentador (y TV): 'new-question' con `review: true` y, si es una pregunta,
 *   'reveal-answer' con sus resultados y el ranking de ahora.
 * - Jugadores: la diapositiva ('new-question' con `review: true`) o, si es una
 *   pregunta, 'question-review' con la solución y la justificación. Cada jugador
 *   pide después su propio resultado con 'get-review-state'.
 */

const EventHandler = require('./EventHandler');
const { hasTimer } = require('../../services/QuestionScoringPolicy');
const { canGoBack } = require('../../services/SlideNavigationPolicy');
const { buildReviewRevealPayload } = require('../../../sockets/utils/ReviewRevealPayload');
const { buildPlayerRevealPayload } = require('../../../sockets/utils/RevealTypePayloads');
const { sanitizeQuestionForPlayers } = require('../../../services/payload.sanitizer');
const { teamConfigs } = require('../../../state/globalState');

class SlideReviewedHandler extends EventHandler {
    register() {
        this.subscribe('slide.reviewed', this.handleSlideReviewed.bind(this), 8);
        this.log('info', 'SlideReviewedHandler registered');
    }

    async handleSlideReviewed(event) {
        const { roomId, questionIndex, totalQuestions } = event.payload || event;
        const game = this.dependencies.activeGames?.get(roomId);
        const question = game?.questions?.[questionIndex];
        if (!question) {
            this.log('debug', 'Slide reviewed for a game not in this worker', { roomId, questionIndex });
            return;
        }

        const base = { currentIndex: questionIndex, totalQuestions: totalQuestions || game.questions.length };
        const playersRoom = this.io.to(`${roomId}:players`);

        this.io.to(`${roomId}:presenter`).emit('new-question', {
            question,
            ...base,
            review: true,
            canGoBack: canGoBack(game)
        });

        if (!hasTimer(question)) {
            playersRoom.emit('new-question', { question: sanitizeQuestionForPlayers(question), ...base, review: true });
            return;
        }

        const payload = await buildReviewRevealPayload({
            roomId,
            game,
            index: questionIndex,
            teamConfig: teamConfigs.get(roomId)
        });

        if (payload) {
            this.io.to(`${roomId}:presenter`).emit('reveal-answer', payload);
        } else {
            this.log('warn', 'No reveal payload for the reviewed question', { roomId, questionIndex });
        }

        playersRoom.emit('question-review', {
            question: sanitizeQuestionForPlayers(question),
            ...base,
            reveal: payload ? buildPlayerRevealPayload(payload) : null
        });
    }
}

module.exports = SlideReviewedHandler;
