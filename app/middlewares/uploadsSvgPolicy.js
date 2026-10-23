/**
 * @fileoverview Los SVG de /uploads/ (subidos o importados en diapositivas libres) se sirven con una CSP
 * de sandbox: aunque alguien abra el fichero directamente, no ejecuta scripts ni carga nada externo.
 * Como <img> o fondo CSS no cambia nada (ahí el navegador ya no ejecuta scripts del SVG).
 * Sustituye la CSP general de Helmet solo para esas respuestas.
 */
'use strict';

const SVG_CSP = 'default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; sandbox';

/** Ruta ya decodificada (%2e, %67...), como la resuelve express.static; null si no se puede decodificar. */
function decodedPath(rawPath) {
    try {
        return decodeURIComponent(rawPath);
    } catch (_err) {
        return null;
    }
}

function uploadsSvgPolicy(req, res, next) {
    const path = decodedPath(req.path || '');
    if (path && path.startsWith('/uploads/') && path.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Security-Policy', SVG_CSP);
    }
    next();
}

module.exports = { uploadsSvgPolicy, SVG_CSP };
