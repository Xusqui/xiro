/**
 * @fileoverview Página del PDF para la diapositiva de vídeo del juego personalizado:
 * el PDF no reproduce vídeo, así que muestra el servicio y la URL.
 */

'use strict';

const SlideFooter = require('../public/js/core/slide-footer.js');
const { parseVideoSource } = require('../public/js/core/video-source');
const { generateSlideFooterHTML } = require('./pdf-slide-footer');

const PROVIDER_LABELS = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    dailymotion: 'Dailymotion',
    file: 'Archivo de vídeo'
};

/**
 * Etiqueta del proveedor de video para una URL
 * @param {string} url - URL del video
 * @returns {string} Etiqueta del proveedor o 'Vídeo' si no se reconoce
 */
function providerLabel(url) {
    const source = parseVideoSource(url);
    return source ? PROVIDER_LABELS[source.kind] : 'Vídeo';
}

/**
 * Genera HTML para una diapositiva de video
 * @param {Object} slide - Diapositiva con slide_video
 * @param {number} index - Índice de la diapositiva
 * @param {number} total - Total de diapositivas
 * @returns {string} HTML de la página del PDF
 */
function generateVideoSlideHTML(slide, index, total) {
    const url = typeof slide.slide_video === 'string' ? slide.slide_video : '';
    const escapedUrl = SlideFooter.escapeText(url);
    return `<div class="page" style="background: linear-gradient(135deg, #0f172a 0%, #7f1d1d 100%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">
        Vídeo ${index} de ${total}
    </div>
    <div style="font-size: 96px; margin-bottom: 24px;">🎬</div>
    <div style="color: white; font-size: 40px; font-weight: 800; margin-bottom: 18px;">${providerLabel(url)}</div>
    <div style="max-width: 80%; padding: 14px 28px; border-radius: 14px; background: rgba(0,0,0,0.35); color: rgba(255,255,255,0.9); font-size: 20px; font-family: monospace; overflow-wrap: anywhere; text-align: center;">${escapedUrl}</div>
    ${generateSlideFooterHTML(slide)}
</div>`.trim();
}

module.exports = { generateVideoSlideHTML, providerLabel };
