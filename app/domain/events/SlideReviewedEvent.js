/**
 * @fileoverview Evento: el presentador revisa una diapositiva ya mostrada de un juego
 * personalizado (navegación adelante/atrás). Lo atiende SlideReviewedHandler.
 * @module domain/events/SlideReviewedEvent
 */

const DomainEvent = require('./DomainEvent');

/**
 * Evento de dominio 'slide.reviewed': el presentador vuelve a una diapositiva ya mostrada.
 */
class SlideReviewedEvent extends DomainEvent {
    constructor({ roomId, questionIndex, totalQuestions }) {
        super('slide.reviewed', { roomId, questionIndex, totalQuestions });
    }
}

module.exports = SlideReviewedEvent;
