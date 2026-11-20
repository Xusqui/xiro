/**
 * @fileoverview Estado de «Toca la imagen» (hotspot) en el móvil: la imagen de la pregunta en curso
 * y el último toque del jugador (se puede mover antes de enviar). Sin imports: usa los núcleos
 * globales (core/hotspot-area.js).
 */

let _imageUrl = null;
let _tap = null;

/** Nueva pregunta: recuerda su imagen y olvida el toque anterior. */
export function startHotspot(imageUrl) {
    _imageUrl = imageUrl || null;
    _tap = null;
}

/** Guarda el toque si es válido (coordenadas 0-1); si no, conserva el anterior. */
export function setHotspotTap(tap) {
    const normalized = window.XiroHotspot.normalizeTap(tap);
    if (normalized) _tap = normalized;
}

/** @returns {{x: number, y: number}|null} */
export function getHotspotTap() {
    return _tap;
}

/** @returns {string|null} */
export function getHotspotImage() {
    return _imageUrl;
}

export function clearHotspot() {
    _imageUrl = null;
    _tap = null;
}

/**
 * Payload de submit-answer, o null si todavía no ha tocado la imagen.
 * @param {{pin?: string, sessionId?: string}} room
 * @param {string} nickname
 * @param {string} requestId
 * @returns {Object|null}
 */
export function hotspotPayload(room, nickname, requestId) {
    if (!_tap) return null;
    return { ...room, nickname, answerType: 'hotspot', tap: { x: _tap.x, y: _tap.y }, requestId };
}
