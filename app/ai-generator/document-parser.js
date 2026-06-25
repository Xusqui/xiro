/**
 * @fileoverview Extracción de texto de documentos PDF, DOCX y TXT
 * Reutiliza: patrón de manejo de archivos con multer memoryStorage
 * Dependencias: pdf-parse, mammoth (añadir a package.json)
 */

/**
 * Extrae texto plano de un fichero subido con multer (memoryStorage).
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @returns {Promise<string>} Texto plano limpio
 * @throws {Error} Si el tipo no está soportado o la extracción falla
 */
function extractText(file) {
    const { buffer, mimetype, originalname } = file;

    if (!buffer || buffer.length === 0) {
        throw new Error('El archivo está vacío');
    }

    const ext = (originalname || '').split('.').pop().toLowerCase();

    // TXT: decodificación directa
    if (mimetype === 'text/plain' || ext === 'txt') {
        return cleanText(buffer.toString('utf-8'));
    }

    // PDF
    if (mimetype === 'application/pdf' || ext === 'pdf') {
        return extractFromPdf(buffer);
    }

    // DOCX
    if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        ext === 'docx' ||
        ext === 'doc'
    ) {
        return extractFromDocx(buffer);
    }

    throw new Error(`Tipo de archivo no soportado: ${mimetype || ext}. Use PDF, DOCX o TXT.`);
}

async function extractFromPdf(buffer) {
    // Usar la ruta interna evita que pdf-parse ejecute código de tests al require()
    let pdfParse;
    try {
        pdfParse = require('pdf-parse/lib/pdf-parse');
    } catch {
        try {
            pdfParse = require('pdf-parse');
        } catch {
            throw new Error('Módulo pdf-parse no instalado. Ejecuta: npm install pdf-parse');
        }
    }
    try {
        const data = await pdfParse(buffer, { normalizeWhitespace: false });
        return cleanText(data.text);
    } catch (err) {
        // pdfjs-dist lanza este error en PDFs con codificaciones especiales de fuentes
        if (err.message && (err.message.includes('pattern') || err.message.includes('encoding'))) {
            throw new Error('No se pudo leer este PDF (encoding no soportado). Prueba a exportarlo como TXT o DOCX.');
        }
        throw err;
    }
}

async function extractFromDocx(buffer) {
    // mammoth debe estar instalado: npm install mammoth
    let mammoth;
    try {
        mammoth = require('mammoth');
    } catch {
        throw new Error('Módulo mammoth no instalado. Ejecuta: npm install mammoth');
    }
    const result = await mammoth.extractRawText({ buffer });
    return cleanText(result.value);
}

/**
 * Limpia el texto: normaliza espacios y elimina líneas vacías repetidas.
 * @param {string} raw
 * @returns {string}
 */
function cleanText(raw) {
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')          // normalizar espacios
        .replace(/\n{3,}/g, '\n\n')       // máx 2 saltos seguidos
        .trim();
}

/**
 * Intenta priorizar la sección "Conclusiones" o el resumen final
 * si el documento excede el límite de la IA y va a ser truncado.
 * @param {string} text - Texto limpio completo
 * @param {number} limit - Límite de caracteres
 * @returns {string} Texto priorizado o truncado normalmente
 */
function prioritizeConclusionsAndTruncate(text, limit = 20000) {
    if (text.length <= limit) return text;

    // Buscar encabezados típicos de conclusiones en múltiples idiomas (español, inglés, francés, italiano, portugués, alemán)
    const conclusionRegex = /\n\s*(?:[0-9]+[.-]\s*)?(?:Conclusiones?|Conclusions?|Resumen|Summary|Consideraciones finales|Concluding remarks|Conclusioni|Conclusões|Zusammenfassung|Résumé)\b[:\s]*/i;
    const match = text.search(conclusionRegex);

    if (match !== -1) {
        const conclusionsText = text.slice(match);
        const remainingSpace = limit - conclusionsText.length;

        // Si las conclusiones son enormes (raro), truncamos las propias conclusiones
        if (remainingSpace <= 0) {
            return conclusionsText.slice(0, limit);
        }

        // Si hay espacio, devolvemos el inicio del documento + un separador + las conclusiones enteras
        return text.slice(0, Math.floor(remainingSpace * 0.95)) +
            '\n\n[... TEXTO OMITIDO POR EXCESO DE LONGITUD ...]\n\n' +
            conclusionsText;
    }

    // Si no hay sección de conclusiones evidente, quedarse con el principio orgánicamente
    return text.slice(0, limit);
}

module.exports = { extractText, prioritizeConclusionsAndTruncate };
