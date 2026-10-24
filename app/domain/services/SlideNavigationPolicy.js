/**
 * @fileoverview Navegación adelante/atrás de los juegos personalizados.
 *
 * El presentador puede volver a cualquier diapositiva ya mostrada. Las ya
 * mostradas se ven en modo revisión (la pregunta con sus resultados, sin volver
 * a jugarse) hasta llegar a la primera que nunca se ha mostrado, que se juega
 * con normalidad.
 *
 * ARQUITECTURA: Domain Service (funciones puras, sin I/O).
 *
 * @module domain/services/SlideNavigationPolicy
 */

'use strict';

const { hasTimer } = require('./QuestionScoringPolicy');

const NAVIGABLE_GAME_TYPE = 'custom_game';

/**
 * ¿La partida admite navegar entre diapositivas?
 *
 * @param {Object} game - Juego en memoria (activeGames)
 * @returns {boolean}
 */
function isNavigable(game) {
    if (!game || game.isTrivial || game.ended) return false;
    return game.gameType === NAVIGABLE_GAME_TYPE && Array.isArray(game.questions);
}

/**
 * Índice de la diapositiva más avanzada que se ha mostrado.
 * Las partidas anteriores a la función no traen maxShownIndex: vale la actual.
 *
 * @param {Object} game
 * @returns {number}
 */
function shownFrontier(game) {
    const current = Number.isInteger(game?.currentIndex) ? game.currentIndex : 0;
    const shown = Number.isInteger(game?.maxShownIndex) ? game.maxShownIndex : current;
    return Math.max(shown, current);
}

/**
 * ¿La diapositiva está cerrada? Las que no tienen temporizador siempre; las
 * preguntas, solo tras revelarlas. En otros workers revealedQuestions puede ser
 * un Set con las preguntas como propiedades (RedisSyncBus): se lee igual.
 *
 * @param {Object} game
 * @param {number} index
 * @returns {boolean}
 */
function isSettled(game, index) {
    const question = game?.questions?.[index];
    if (!question) return false;
    if (!hasTimer(question)) return true;
    return Boolean(game.revealedQuestions?.[index]);
}

/**
 * ¿Se puede ir a la diapositiva anterior? Nunca desde la primera ni con una
 * pregunta en juego: se perderían las respuestas ya enviadas.
 *
 * @param {Object} game
 * @returns {boolean}
 */
function canGoBack(game) {
    if (!isNavigable(game)) return false;
    return game.currentIndex > 0 && isSettled(game, game.currentIndex);
}

/**
 * Cómo se avanza: 'review' si la siguiente ya se mostró, 'play' si no.
 *
 * @param {Object} game
 * @returns {'review'|'play'}
 */
function forwardMode(game) {
    if (!isNavigable(game)) return 'play';
    return game.currentIndex + 1 <= shownFrontier(game) ? 'review' : 'play';
}

/**
 * Mientras se revisa una diapositiva ya mostrada no se responde.
 *
 * @param {Object} game
 * @param {boolean} canAnswer - Lo que se permitiría fuera de revisión
 * @returns {boolean}
 */
function closedWhileReviewing(game, canAnswer) {
    return game?.reviewMode ? false : canAnswer;
}

module.exports = {
    isNavigable,
    shownFrontier,
    isSettled,
    canGoBack,
    forwardMode,
    closedWhileReviewing
};
