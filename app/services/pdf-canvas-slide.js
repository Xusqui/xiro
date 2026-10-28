/**
 * @fileoverview Página del PDF para la diapositiva de lienzo del juego personalizado:
 * renderiza el lienzo como una imagen en escala 0.5 dentro de un contenedor fijo.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const SlideFooter = require('../public/js/core/slide-footer.js');
const { collectMediaRefs } = require('../public/js/core/slide-canvas-model');
const { stageHtml } = require('../public/js/core/slide-canvas-render');

const CANVAS_CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'slide-canvas.css'), 'utf8');

/**
 * Reemplaza las referencias de imágenes locales (/uploads/...) por data URIs en el HTML
 * @param {string} html - HTML original
 * @param {Object} canvas - Canvas con elementos
 * @param {Function} resolvePath - Función para resolver rutas relativas a absolutas
 * @returns {string} HTML con imágenes reemplazadas
 */
function inlineLocalImages(html, canvas, resolvePath) {
    const refs = collectMediaRefs(canvas).images;
    let result = html;

    for (let i = 0; i < refs.length; i++) {
        const ref = refs[i];
        // Solo procesar imágenes locales que empiezan con /uploads/
        if (ref.indexOf('/uploads/') !== 0) continue;

        // Resolver la ruta absoluta
        const abs = resolvePath(ref);
        if (!abs || !fs.existsSync(abs)) {
            // Si el archivo no existe, dejar como está
            continue;
        }

        // Leer el archivo y construir data URI
        const buffer = fs.readFileSync(abs);
        const ext = path.extname(abs).toLowerCase();
        let mime = 'image/jpeg';

        if (ext === '.svg') mime = 'image/svg+xml';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.gif') mime = 'image/gif';
        else if (ext === '.webp') mime = 'image/webp';

        const dataUri = 'data:' + mime + ';base64,' + buffer.toString('base64');

        // Reemplazar todas las ocurrencias del ref en el HTML (escapado)
        const escapedRef = SlideFooter.escapeText(ref);
        result = result.split(escapedRef).join(dataUri);
    }

    return result;
}

/**
 * Genera HTML para una diapositiva de lienzo
 * @param {Object} slide - Diapositiva con slide_canvas
 * @param {number} index - Índice de la diapositiva
 * @param {number} total - Total de diapositivas
 * @param {Function} resolvePath - Función para resolver rutas relativas a absolutas
 * @returns {string} HTML de la página del PDF
 */
function generateCanvasSlideHTML(slide, index, total, resolvePath) {
    const canvas = slide.slide_canvas || {};

    // Generar el HTML del escenario usando el modo 'pdf'
    // El PDF se genera en español, como el resto de páginas de pdf.service.js
    let stage = stageHtml(canvas, { mode: 'pdf', labels: { localVideo: 'vídeo local', video: 'vídeo' } });

    // Reemplazar imágenes locales por data URIs
    stage = inlineLocalImages(stage, canvas, resolvePath);

    return (
        '<div class="page" style="background:#0f172a; display:flex; flex-direction:column; align-items:center; justify-content:center;">\n' +
        '    <div style="position: absolute; top: 30px; right: 40px; color: rgba(255,255,255,0.7); font-size: 18px; font-weight: 600;">\n' +
        '        Diapositiva ' +
        index +
        ' de ' +
        total +
        '\n' +
        '    </div>\n' +
        '    <style>' +
        CANVAS_CSS +
        ' .pdf-canvas-frame .xsc-stage{-webkit-transform:scale(0.5);transform:scale(0.5);}</style>\n' +
        '    <div class="pdf-canvas-frame" style="position:relative;width:960px;height:540px;overflow:hidden;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.4);">\n' +
        '        ' +
        stage +
        '\n' +
        '    </div>\n' +
        '</div>'.trim()
    );
}

module.exports = { generateCanvasSlideHTML };
