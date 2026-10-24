/**
 * @fileoverview Estado de navegación de la partida en memoria (juegos personalizados):
 * `maxShownIndex` (diapositiva más avanzada mostrada) y `reviewMode`.
 *
 * Lo aplican igual el worker que navega (QuestionTransitionManager, NavigateSlideUseCase)
 * y los demás al recibir la sincronía (RedisSyncBus). La revisión nunca toca las
 * estadísticas, los contadores de Redis ni los puntos sorteados de la pregunta: solo
 * cambia qué diapositiva se ve y cierra las respuestas.
 */

'use strict';

const { shownFrontier } = require('../../domain/services/SlideNavigationPolicy');

/**
 * Se muestra por primera vez (o se vuelve a jugar) la diapositiva `index`.
 *
 * @param {Object} game - Partida en memoria (activeGames)
 * @param {number} index
 */
function markShown(game, index) {
    if (!game) return;
    game.maxShownIndex = Math.max(shownFrontier(game), index);
    game.reviewMode = false;
}

/**
 * Se pasa a revisar una diapositiva ya mostrada.
 *
 * @param {Object} game - Partida en memoria (activeGames)
 * @param {Object} target
 * @param {number} target.currentIndex - Diapositiva revisada
 * @param {number} [target.maxShownIndex] - Frontera del worker que navega
 */
function enterReview(game, { currentIndex, maxShownIndex }) {
    if (!game) return;
    const incoming = Number.isInteger(maxShownIndex) ? maxShownIndex : 0;
    game.maxShownIndex = Math.max(shownFrontier(game), incoming);
    game.currentIndex = currentIndex;
    game.reviewMode = true;
    game.canAnswer = false;
}

module.exports = { markShown, enterReview };
