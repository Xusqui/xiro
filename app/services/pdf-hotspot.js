/**
 * @fileoverview Página de respuesta de «Toca la imagen» (hotspot) en el PDF de cuestionarios: la
 * imagen de la pregunta con el área correcta dibujada encima en un SVG de coordenadas 0-1, que se
 * estira con la imagen como en el presentador.
 */

'use strict';

const fs = require('fs');
const logger = require('../config/logger');
const Hotspot = require('../public/js/core/hotspot-area');
const { resolvePublicPath, readImageAsDataUri } = require('./pdf-html');

const NO_IMAGE_HTML = `
        <div style="background: white; padding: 30px; border-radius: 20px; text-align: center; font-size: 26px; font-weight: 700; color: #991b1b;">
            📍 Zona marcada en la imagen
        </div>`;

function imageDataUri(urlRecurso) {
    const imagePath = resolvePublicPath(urlRecurso);
    try {
        return imagePath && fs.existsSync(imagePath) ? readImageAsDataUri(imagePath) : null;
    } catch (err) {
        logger.error('PDF: no se pudo leer la imagen de Toca la imagen:', err.message);
        return null;
    }
}

function areaSvg(area) {
    if (!area) return '';
    const points = area.points.map((p) => `${p.x},${p.y}`).join(' ');
    return `<svg viewBox="0 0 1 1" preserveAspectRatio="none" style="position: absolute; inset: 0; width: 100%; height: 100%;">
                <polygon points="${points}" style="fill: rgba(220,38,38,0.35); stroke: #dc2626; stroke-width: 3px; vector-effect: non-scaling-stroke;"/>
            </svg>`;
}

/**
 * HTML de la solución: imagen con el área, o un texto si la imagen no está.
 * @param {Object} question - Pregunta con url_recurso y hotspot_area
 * @returns {string}
 */
function generateHotspotSolutionHTML(question) {
    const dataUri = imageDataUri(question.url_recurso);
    if (!dataUri) return NO_IMAGE_HTML;
    return `
        <div style="display: flex; justify-content: center;">
            <div style="position: relative; display: inline-block; line-height: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <img src="${dataUri}" style="display: block; max-width: 900px; max-height: 480px;" />
                ${areaSvg(Hotspot.parseArea(question.hotspot_area))}
            </div>
        </div>`;
}

module.exports = { generateHotspotSolutionHTML };
