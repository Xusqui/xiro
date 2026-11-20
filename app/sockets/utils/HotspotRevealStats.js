/**
 * @fileoverview «Toca la imagen» (hotspot): toques de todos los jugadores para el revelado.
 *
 * Se guardan en Redis con AnswerStatsStore (compartido entre workers) en una clave propia por
 * pregunta (`<índice>:hs`). Cada campo es un toque y su franja, y el valor cuántos jugadores lo
 * dieron igual (los toques van redondeados a 4 decimales):
 *   "0.3125,0.4410,in" → 2
 * Franjas: in (dentro del área), near (fuera pero con puntos), out (sin puntos). Sin nombres:
 * el presentador y la TV los pintan anónimos.
 */

'use strict';

const answerStatsStore = require('../../services/AnswerStatsStore');
const Hotspot = require('../../public/js/core/hotspot-area');

const BANDS = ['in', 'near', 'out'];

function statsSlot(questionIndex) {
    return `${questionIndex}:hs`;
}

function bandOf(details, pointsEarned) {
    if (details.inside) return 'in';
    return pointsEarned > 0 ? 'near' : 'out';
}

/**
 * Cuenta el toque de un jugador.
 * @param {string} sPin - Sala
 * @param {string|number} questionIndex - Índice de la pregunta (QuestionSlot)
 * @param {{tap: ?{x: number, y: number}, inside: boolean}} details - Detalle de HotspotAnswerService
 * @param {number} pointsEarned - Puntos del toque (decide la franja fuera del área)
 * @returns {Promise<void>}
 */
async function recordHotspotTap(sPin, questionIndex, details, pointsEarned) {
    const tap = Hotspot.normalizeTap(details?.tap);
    if (!tap) return;
    await answerStatsStore.increment(sPin, statsSlot(questionIndex), `${tap.x},${tap.y},${bandOf(details, pointsEarned)}`);
}

function parseTapField(field, value) {
    const [x, y, band] = field.split(',');
    const tap = Hotspot.normalizeTap({ x: Number(x), y: Number(y) });
    const count = Number(value);
    if (!tap || !BANDS.includes(band) || !Number.isInteger(count) || count < 1) return null;
    return { x: tap.x, y: tap.y, band, count };
}

/**
 * Datos del revelado: área, crédito de la imagen y toques agrupados.
 * @param {string} roomId - Sala
 * @param {string|number} slot - Índice de la pregunta (QuestionSlot)
 * @param {Object} question - Pregunta con hotspot_area e image_credit
 * @returns {Promise<{area: ?Object, imageCredit: ?string, respondents: number, insideCount: number,
 *   taps: Array<{x: number, y: number, band: string, count: number}>}>}
 */
async function buildHotspotReveal(roomId, slot, question) {
    const stats = (await answerStatsStore.getStats(roomId, statsSlot(slot))) || {};
    const taps = Object.entries(stats)
        .map(([field, value]) => parseTapField(field, value))
        .filter(Boolean);
    const total = (band) => taps.filter((tap) => !band || tap.band === band).reduce((sum, tap) => sum + tap.count, 0);
    return {
        area: Hotspot.parseArea(question.hotspot_area),
        imageCredit: question.image_credit || null,
        respondents: total(),
        insideCount: total('in'),
        taps
    };
}

module.exports = { recordHotspotTap, buildHotspotReveal };
