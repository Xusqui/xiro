/**
 * @fileoverview Extrae del PDF los fragmentos de texto con su posición y tamaño
 * de letra. pdf.js (vía pdf-parse, ya instalado) solo decodifica las fuentes;
 * la reconstrucción del documento es propia (pdf-lines + pdf-blocks).
 */

'use strict';

const MAX_PAGES = 400;

function loadPdfParse() {
    try {
        // La ruta interna evita que pdf-parse ejecute su código de pruebas al require()
        return require('pdf-parse/lib/pdf-parse');
    } catch {
        try {
            return require('pdf-parse');
        } catch {
            throw new Error('Módulo pdf-parse no instalado. Ejecuta: npm install pdf-parse');
        }
    }
}

function toItem(raw) {
    if (!raw.str || !raw.str.trim()) return null;
    const [, , c, d, x, y] = raw.transform;
    const size = Math.hypot(c, d) || raw.height || 10;
    return {
        str: raw.str,
        x,
        y,
        size: Math.round(size * 10) / 10,
        width: raw.width || raw.str.length * size * 0.5
    };
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ number: number, height: number, items: Array }>>}
 */
async function extractPdfPages(buffer) {
    const pdfParse = loadPdfParse();
    const pages = [];
    const pagerender = page =>
        page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false }).then(content => {
            const view = page.view || [0, 0, 0, 792];
            pages.push({
                number: page.pageNumber || pages.length + 1,
                height: view[3] - view[1],
                items: content.items.map(toItem).filter(Boolean)
            });
            return '';
        });

    try {
        // Copia en un Uint8Array propio: pdf.js lee el ArrayBuffer entero e ignora el
        // byteOffset, y los Buffer pequeños de Node comparten pool («bad XRef entry»)
        await pdfParse(new Uint8Array(buffer), { pagerender, max: MAX_PAGES });
    } catch (err) {
        const msg = (err && err.message) || String(err);
        if (/password/i.test(msg)) throw new Error('El PDF está protegido con contraseña');
        if (/pattern|encoding/i.test(msg)) {
            throw new Error('No se pudo leer este PDF (encoding no soportado). Prueba a exportarlo como TXT o DOCX.');
        }
        throw new Error(`No se pudo leer el PDF: ${msg}`);
    }
    return pages.sort((a, b) => a.number - b.number);
}

module.exports = { extractPdfPages };
