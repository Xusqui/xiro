/** @fileoverview Convierte CHANGELOG.md en datos y elige qué versiones enseñar antes de actualizar.
 *  Puro (sin E/S). El texto de cada punto conserva su Markdown en línea: lo interpreta el cliente. */
'use strict';
const { compareVersions, sameVersion } = require('../updater/version');

const VERSION = '\\d+\\.\\d+\\.\\d+(?:-?[a-z])?';
const ISO_DATE = '\\d{4}-\\d{2}-\\d{2}';
// Admite «## 3.8.0 — fecha» (algunas entradas van en h2) y rangos «1.0.0 – 1.0.6 — fecha / fecha»
const ENTRY_HEADING = new RegExp(`^#{2,3}\\s+(${VERSION})(?:\\s+–\\s+(${VERSION}))?\\s+—\\s+(${ISO_DATE}(?:\\s*/\\s*${ISO_DATE})?)`);
const ANY_HEADING = /^#{1,6}\s/;
const HORIZONTAL_RULE = /^-{3,}$/;
const BULLET_PREFIX = /^-\s+/;
const NESTED_BULLET = /^\s+-\s+(.*)$/;

/**
 * @typedef {Object} ChangelogItem
 * @property {string} text - Texto del punto, con su Markdown en línea
 * @property {string[]} children - Subpuntos
 */

/**
 * @typedef {Object} ChangelogEntry
 * @property {string} version - Versión (en un rango, la más alta)
 * @property {string} date - Fecha tal como aparece en el fichero
 * @property {ChangelogItem[]} items - Novedades de la versión
 */

/**
 * Crea una entrada a partir de su encabezado.
 * @param {string} line - Línea de encabezado Markdown
 * @returns {ChangelogEntry|null} La entrada, o null si el encabezado no es de versión (ej. «## 3.11.x»)
 */
function parseEntryHeading(line) {
    const match = ENTRY_HEADING.exec(line);
    if (!match) return null;
    return { version: match[2] || match[1], date: match[3], items: [] };
}

/**
 * Añade a una entrada una línea de su cuerpo.
 * @param {ChangelogEntry} entry - Entrada en curso
 * @param {string} line - Línea sin interpretar
 * @returns {void}
 */
function addBodyLine(entry, line) {
    const text = line.trim();
    if (!text || HORIZONTAL_RULE.test(text)) return;

    const nested = NESTED_BULLET.exec(line);
    const parent = entry.items[entry.items.length - 1];
    if (nested && parent) {
        parent.children.push(nested[1].trim());
        return;
    }
    entry.items.push({ text: text.replace(BULLET_PREFIX, ''), children: [] });
}

/**
 * Extrae las versiones de un CHANGELOG.md, ignorando el preámbulo y las secciones que no son de versión.
 * @param {string} markdown - Contenido del fichero
 * @returns {ChangelogEntry[]} Entradas en el orden del fichero
 */
function parseChangelog(markdown) {
    const entries = [];
    let entry = null;
    for (const line of String(markdown).split(/\r?\n/)) {
        if (ANY_HEADING.test(line)) {
            entry = parseEntryHeading(line);
            if (entry) entries.push(entry);
        } else if (entry) {
            addBodyLine(entry, line);
        }
    }
    return entries;
}

/**
 * Separa las versiones que trae la actualización de las que ya están instaladas.
 * Las posteriores a `latest` se descartan: GitHub puede ir por delante de Docker Hub.
 * @param {ChangelogEntry[]} entries - Entradas del historial
 * @param {{current: string, latest: string}} versions - Versión instalada y versión de destino
 * @returns {{newer: ChangelogEntry[], older: ChangelogEntry[], targetDocumented: boolean}} Selección
 */
function selectChangelog(entries, { current, latest }) {
    const reachable = entries.filter(entry => compareVersions(entry.version, latest) <= 0);
    const newer = reachable.filter(entry => compareVersions(entry.version, current) > 0);
    return {
        newer,
        older: reachable.filter(entry => compareVersions(entry.version, current) <= 0),
        targetDocumented: newer.some(entry => sameVersion(entry.version, latest))
    };
}

module.exports = { parseChangelog, selectChangelog };
