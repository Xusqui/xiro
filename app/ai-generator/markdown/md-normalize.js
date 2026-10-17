/**
 * @fileoverview Pasada final común a todos los formatos: limpia el Markdown de
 * todo lo que gasta tokens sin aportar contenido para generar preguntas.
 *  - caracteres invisibles, espacios repetidos y líneas duplicadas consecutivas
 *  - líneas de índice («Introducción ........ 3»)
 *  - secciones finales de bibliografía/referencias e índices con encabezado
 */

'use strict';

// Los caracteres de control son justo lo que se quiere eliminar
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad\u200b-\u200d\u2060\ufeff]/g;
const TOC_LINE = /^(?:[-*]\s+)?.{2,}?(?:\.{4,}|…{2,}|(?:\s?\.){4,}|_{4,})\s*\d{1,4}\s*$/;
const BACK_MATTER = /^(?:\d+[.\s-]*)?(?:bibliograf[íi]a|referencias(?: bibliogr[áa]ficas)?|references|bibliography|webgraf[íi]a|works cited|[íi]ndice(?: general)?|table of contents|contents|sumario|tabla de contenidos?)\s*:?$/i;
const HEADING = /^(#{1,6})\s+(.*)$/;

function cleanLine(line) {
    const indent = (line.match(/^ */) || [''])[0];
    const body = line.replace(INVISIBLE, '').replace(/[\t\u00a0 ]+/g, ' ').trim();
    // La sangría solo importa en listas anidadas
    return /^([-*]|\d+\.)\s/.test(body) ? indent + body : body;
}

/**
 * Quita una sección de bibliografía o índice: desde su encabezado hasta el
 * siguiente encabezado del mismo nivel o superior. Una línea suelta sin «#»
 * solo cuenta en el último 30 % del documento (bibliografías finales).
 */
function dropBackMatter(lines) {
    const out = [];
    let skipLevel = 0;
    lines.forEach((line, i) => {
        const h = line.match(HEADING);
        if (skipLevel) {
            if (!h || h[1].length > skipLevel) return;
            skipLevel = 0;
        }
        if (h && BACK_MATTER.test(h[2].trim())) {
            skipLevel = h[1].length;
            return;
        }
        if (!h && BACK_MATTER.test(line) && i > lines.length * 0.7) {
            skipLevel = 7; // hasta el siguiente encabezado de cualquier nivel
            return;
        }
        out.push(line);
    });
    return out;
}

function dropRepeats(lines) {
    return lines.filter((line, i) => !line || line !== lines[i - 1]);
}

/**
 * @param {string} markdown
 * @param {{ dropBackMatter?: boolean, stats?: Object }} [options]
 *        stats: si se pasa, recibe cuántas líneas quitó cada paso (para el log)
 * @returns {string}
 */
function normalizeMarkdown(markdown, { dropBackMatter: dropBack = true, stats = {} } = {}) {
    const cleaned = String(markdown || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(cleanLine);
    let lines = cleaned.filter(line => !TOC_LINE.test(line) && !/^#{1,6}$/.test(line));
    stats.tocLines = cleaned.length - lines.length;

    const beforeBack = lines.length;
    if (dropBack) lines = dropBackMatter(lines);
    stats.backMatterLines = beforeBack - lines.length;

    const beforeRepeats = lines.length;
    lines = dropRepeats(lines);
    stats.repeatedLines = beforeRepeats - lines.length;

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { normalizeMarkdown };
