/**
 * @fileoverview Agregación de «Nube de palabras». El recuento vive en un hash de Redis cuyos
 * campos son `clave<TAB>texto` y cuyo valor son las veces escrita esa variante. Aquí se agrupan
 * las variantes de una misma palabra, se elige la más escrita para mostrarla y se descartan las
 * que el presentador ha ocultado. Sin I/O: se prueba con objetos planos.
 */

const SEPARATOR = '\t';

/**
 * Campo del hash de Redis para una variante escrita de una palabra.
 * @param {string} text - Texto tal como lo escribió el jugador.
 * @param {string} key - Clave de agrupado (sin mayúsculas, tildes ni signos).
 * @returns {string}
 */
function fieldFor(text, key) {
    return `${key}${SEPARATOR}${text}`;
}

/**
 * Descompone un campo del hash. Devuelve null si está mal formado o su recuento no vale.
 * @param {string} field
 * @param {*} rawCount
 * @returns {{key: string, text: string, count: number}|null}
 */
function parseEntry(field, rawCount) {
    const cut = String(field).indexOf(SEPARATOR);
    const count = Number(rawCount);
    if (cut <= 0 || !Number.isFinite(count) || count <= 0) return null;
    const text = field.slice(cut + 1);
    return text ? { key: field.slice(0, cut), text, count } : null;
}

/**
 * Variante a mostrar: la más escrita; en un empate, la primera por orden alfabético.
 * @param {Map<string, number>} variants - texto -> veces.
 * @returns {string}
 */
function pickDisplayText(variants) {
    let best = null;
    variants.forEach((count, text) => {
        const wins = best === null || count > best.count || (count === best.count && text < best.text);
        if (wins) best = { text, count };
    });
    return best.text;
}

function groupByKey(stats, hidden) {
    const groups = new Map();
    Object.keys(stats || {}).forEach(field => {
        const entry = parseEntry(field, stats[field]);
        if (!entry || hidden.has(entry.key)) return;
        const group = groups.get(entry.key) || { total: 0, variants: new Map() };
        group.total += entry.count;
        group.variants.set(entry.text, (group.variants.get(entry.text) || 0) + entry.count);
        groups.set(entry.key, group);
    });
    return groups;
}

function compareWords(first, second) {
    if (second.count !== first.count) return second.count - first.count;
    if (first.text === second.text) return 0;
    return first.text < second.text ? -1 : 1;
}

/**
 * Convierte el recuento crudo de Redis en la lista de palabras visibles.
 * @param {Object<string, number|string>|null|undefined} stats - Hash `clave<TAB>texto` -> veces.
 * @param {{hiddenKeys?: Iterable<string>}} [options] - Claves ocultas por el presentador.
 * @returns {Array<{key: string, text: string, count: number}>} Ordenadas por veces y texto.
 */
function aggregateWords(stats, options) {
    const hidden = new Set((options && options.hiddenKeys) || []);
    const words = [];
    groupByKey(stats, hidden).forEach((group, key) => {
        words.push({ key, text: pickDisplayText(group.variants), count: group.total });
    });
    return words.sort(compareWords);
}

/**
 * Total de palabras escritas entre las visibles.
 * @param {Array<{count: number}>} entries
 * @returns {number}
 */
function totalWords(entries) {
    return entries.reduce((sum, entry) => sum + entry.count, 0);
}

module.exports = { fieldFor, aggregateWords, totalWords };
