/**
 * @fileoverview HTML compartido de «Toca la imagen» (hotspot): la imagen de la pregunta con el área
 * correcta (SVG en coordenadas 0-1 que se estira con la imagen) y los toques encima como marcas
 * posicionadas en %. Lo usan el jugador, el presentador, la TV y el modo individual; estilos en
 * css/hotspot.css. Reglas del área en hotspot-area.js.
 *
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroHotspotView y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    // En el navegador, el global de hotspot-area.js; en Node (tests), el módulo
    let Hotspot = root.XiroHotspot || (typeof module !== 'undefined' && module.require ? module.require('./hotspot-area') : null);
    let BANDS = { in: true, near: true, out: true, own: true };

    function escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Toque relativo 0-1 de un clic sobre la imagen; null si cae fuera o la imagen no tiene tamaño.
     * @param {{left: number, top: number, width: number, height: number}} rect - Caja de la imagen
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{x: number, y: number}|null}
     */
    function pointFromClick(rect, clientX, clientY) {
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
        return Hotspot.normalizeTap({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
    }

    /**
     * SVG del área, o '' si no es válida.
     * @param {*} rawArea
     * @returns {string}
     */
    function areaSvg(rawArea) {
        let area = Hotspot.parseArea(rawArea);
        if (!area) return '';
        let points = area.points.map(function (p) {
            return p.x + ',' + p.y;
        }).join(' ');
        return '<svg class="hs-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">' +
            '<polygon class="hs-area" points="' + points + '"/></svg>';
    }

    function percent(value) {
        return Math.round(value * 10000) / 100 + '%';
    }

    function markerHtml(tap, band) {
        let point = Hotspot.normalizeTap(tap);
        if (!point || !BANDS[band]) return '';
        let count = Number(tap.count) > 1 ? '<span class="hs-pin__count">' + Number(tap.count) + '</span>' : '';
        return '<span class="hs-pin hs-pin--' + band + '" style="left:' + percent(point.x) + ';top:' + percent(point.y) + '">' +
            count + '</span>';
    }

    /**
     * Imagen con el área y las marcas.
     * @param {Object} options
     * @param {string} options.imageUrl - URL de la imagen
     * @param {*} [options.area] - Área (se pinta si es válida)
     * @param {Array<{x: number, y: number, band: string, count?: number}>} [options.taps] - Toques de todos
     * @param {{x: number, y: number}} [options.ownTap] - Toque del propio jugador (va encima)
     * @param {string} [options.id] - id del contenedor (para rellenar el área más tarde)
     * @returns {string}
     */
    function stageHtml(options) {
        let taps = (options.taps || []).map(function (tap) {
            return markerHtml(tap, tap.band);
        }).join('');
        let own = options.ownTap ? markerHtml(options.ownTap, 'own') : '';
        let id = options.id ? ' id="' + escapeAttr(options.id) + '"' : '';
        return '<div class="hs-stage"' + id + '>' +
            '<img class="hs-stage__img" src="' + escapeAttr(options.imageUrl || '') + '" alt="" draggable="false">' +
            areaSvg(options.area) + taps + own + '</div>';
    }

    let api = {
        pointFromClick: pointFromClick,
        areaSvg: areaSvg,
        pinHtml: markerHtml,
        stageHtml: stageHtml
    };

    root.XiroHotspotView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
