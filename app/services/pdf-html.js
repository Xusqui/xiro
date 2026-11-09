/**
 * @fileoverview Utilidades compartidas por las páginas del PDF de cuestionarios: escape de HTML,
 * resolución segura de rutas de imagen dentro de public/ e incrustación de imágenes en base64.
 */

const path = require('path');
const fs = require('fs');

const PUBLIC_ROOT = '/usr/src/app/public';

const IMAGE_MIME_BY_EXT = { '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

/**
 * Lee una imagen y la devuelve como data URI para incrustarla en el HTML del PDF.
 * El MIME sale de la extensión; cualquier otra se trata como JPEG.
 * @param {string} imagePath - Ruta absoluta, ya validada con resolvePublicPath
 * @returns {string} `data:<mime>;base64,<contenido>`
 * @throws {Error} Si el fichero no se puede leer: cada página decide qué mostrar en su lugar
 */
function readImageAsDataUri(imagePath) {
    const mimeType = IMAGE_MIME_BY_EXT[path.extname(imagePath).toLowerCase()] || 'image/jpeg';
    return `data:${mimeType};base64,${fs.readFileSync(imagePath).toString('base64')}`;
}

/**
 * Ruta absoluta dentro de public/ para una ruta de imagen escrita por un editor,
 * o null si apunta fuera (p. ej. "../../etc/passwd"): evita leer ficheros del
 * servidor e incrustarlos en el PDF.
 */
function resolvePublicPath(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath) return null;
    const abs = path.resolve(PUBLIC_ROOT, relativePath.replace(/^[/\\]+/, ''));
    return abs.startsWith(PUBLIC_ROOT + path.sep) ? abs : null;
}

/**
 * Escapa HTML para evitar inyección
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Envuelve las páginas en el documento HTML completo del PDF, con el tamaño de página y los estilos comunes.
 * @param {string} title - Título del documento (se escapa)
 * @param {string[]} pages - HTML de cada página
 * @returns {string} Documento HTML
 */
function wrapPdfDocument(title, pages) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        @page {
            size: 1280px 1024px;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .page {
            width: 1280px;
            height: 1024px;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px;
            position: relative;
        }
        .page:last-child {
            page-break-after: avoid;
        }
    </style>
</head>
<body>
    ${pages.join('\n')}
</body>
</html>
    `.trim();
}

module.exports = { resolvePublicPath, escapeHtml, readImageAsDataUri, wrapPdfDocument };
