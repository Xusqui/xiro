/**
 * @fileoverview Puntuación de «Toca la imagen» (hotspot), como la numérica: dentro del área se
 * gana el máximo más el bonus de perfección; fuera, los puntos bajan en línea recta con la
 * distancia al área y son 0 a la tolerancia (% del ancho de la imagen). Sin bonus de velocidad.
 * Geometría y reglas del área: public/js/core/hotspot-area.js.
 * @module domain/services/HotspotAnswerService
 */

'use strict';

const Hotspot = require('../../public/js/core/hotspot-area');

const STRATEGY = 'hotspot';

function noPoints(details, playerAnswer = null) {
    return { isCorrect: false, pointsEarned: 0, timeBonus: 0, playerAnswer, isSurvey: false, details };
}

function pointsFor(distance, inside, question) {
    const maxPoints = Number(question.max_points ?? Hotspot.LIMITS.DEFAULT_MAX_POINTS);
    if (inside) return Math.round(maxPoints + Hotspot.LIMITS.INSIDE_BONUS);
    const tolerance = Hotspot.normalizeTolerance(question.hotspot_tolerance) / 100;
    if (distance >= tolerance) return 0;
    return Math.max(0, Math.round(maxPoints * (1 - distance / tolerance)));
}

/**
 * Puntúa un toque sobre la imagen.
 * @param {Object} input
 * @param {Object} input.question - Pregunta con hotspot_area, max_points y hotspot_tolerance
 * @param {*} input.playerAnswer - Toque { x, y } relativo a la imagen (0-1)
 * @returns {{isCorrect: boolean, pointsEarned: number, timeBonus: number, playerAnswer: Object|null,
 *   isSurvey: boolean, details: Object}} isCorrect = dentro del área. Un área no válida da 0 puntos y
 *   details.error = 'invalid_area'.
 */
function processHotspotAnswer({ question, playerAnswer }) {
    const area = question ? Hotspot.parseArea(question.hotspot_area) : null;
    if (!area) return noPoints({ strategy: STRATEGY, error: 'invalid_area' });
    const tap = Hotspot.normalizeTap(playerAnswer);
    if (!tap) return noPoints({ strategy: STRATEGY, inside: false, distancePercent: null, tap: null });
    const distance = Hotspot.distanceToArea(tap, area);
    const inside = distance === 0;
    return {
        isCorrect: inside,
        pointsEarned: pointsFor(distance, inside, question),
        timeBonus: 0,
        playerAnswer: tap,
        isSurvey: false,
        details: { strategy: STRATEGY, inside, distancePercent: Math.round(distance * 1000) / 10, tap }
    };
}

module.exports = { processHotspotAnswer };
