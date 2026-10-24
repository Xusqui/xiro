/**
 * @fileoverview Navigate Slide Use Case - Revisar diapositivas ya mostradas
 * @module application/use-cases/NavigateSlideUseCase
 *
 * Juegos personalizados: el presentador vuelve a una diapositiva anterior o, ya en
 * revisión, avanza a la siguiente ya mostrada. La revisión nunca vuelve a jugar una
 * pregunta: no toca contadores de Redis, temporizador, puntos sorteados ni
 * puntuaciones; solo cambia la diapositiva visible y cierra las respuestas.
 *
 * 1. Validación y reglas (SlideNavigationPolicy)
 * 2. Estado en memoria (SlideReviewState) y sincronía con los demás workers
 * 3. Evento de dominio (SlideReviewedHandler emite a presentador y jugadores)
 */

const EventBus = require('../../domain/events/EventBus');
const SlideReviewedEvent = require('../../domain/events/SlideReviewedEvent');
const { canGoBack, forwardMode, shownFrontier } = require('../../domain/services/SlideNavigationPolicy');
const { enterReview } = require('../../sockets/utils/SlideReviewState');
const { validateSocket, schemas } = require('../../validation');
const logger = require('../../config/logger');

// Diapositiva destino según la dirección, o null si no se puede navegar
const TARGETS = {
    back: game => (canGoBack(game) ? game.currentIndex - 1 : null),
    forward: game => (forwardMode(game) === 'review' ? game.currentIndex + 1 : null)
};

const REFUSALS = {
    back: { success: false, reason: 'cannot-go-back', code: 'SLIDE_NAVIGATION_NOT_ALLOWED' },
    forward: { success: false, reason: 'not-in-review' }
};

async function publishReview(syncBus, roomId, game) {
    try {
        await syncBus?.publishSlideReview(roomId, {
            currentIndex: game.currentIndex,
            maxShownIndex: game.maxShownIndex
        });
    } catch (err) {
        logger.warn('slide-review sync failed', { roomId, error: err.message });
    }
}

class NavigateSlideUseCase {
    /**
     * @param {Object} context
     * @param {Object} context.data - { roomIdOrPin, direction: 'back' | 'forward' }
     * @param {Object} context.dependencies - { activeGames, syncBus, clearGameTimer }
     * @returns {Promise<Object>} { success, questionIndex? , reason?, code? }
     */
    async execute({ data, dependencies }) {
        try {
            const { roomIdOrPin, direction } = data;
            const { activeGames, syncBus, clearGameTimer } = dependencies;

            const validation = validateSocket(schemas.nextQuestion, { roomIdOrPin });
            if (!validation.valid) {
                return { success: false, reason: 'validation-error', errors: validation.errors };
            }

            const roomId = String(roomIdOrPin);
            const game = activeGames.get(roomId);
            if (!game) {
                return { success: false, reason: 'game-not-found' };
            }

            if (!Object.prototype.hasOwnProperty.call(TARGETS, direction)) {
                return { success: false, reason: 'invalid-direction' };
            }

            const target = TARGETS[direction](game);
            if (target === null) {
                return { ...REFUSALS[direction] };
            }

            if (typeof clearGameTimer === 'function') {
                clearGameTimer(roomId);
            }
            enterReview(game, { currentIndex: target, maxShownIndex: shownFrontier(game) });
            await publishReview(syncBus, roomId, game);

            EventBus.emit(
                'slide.reviewed',
                new SlideReviewedEvent({ roomId, questionIndex: target, totalQuestions: game.questions.length })
            );

            return { success: true, questionIndex: target };
        } catch (error) {
            logger.error('Error in NavigateSlideUseCase', { error: error.message, stack: error.stack });
            return {
                success: false,
                reason: 'server-error',
                message: 'Error al cambiar de diapositiva',
                code: 'NAVIGATE_SLIDE_FAILED'
            };
        }
    }
}

module.exports = NavigateSlideUseCase;
