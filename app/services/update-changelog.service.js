/** @fileoverview Trae de GitHub el CHANGELOG.md (no va en la imagen Docker) y lo guarda en Redis, compartido por los workers.
 *  La clave incluye la versión de destino para que una versión recién publicada nunca lea un historial anterior a ella. */
'use strict';
const logger = require('../config/logger');
const { getRedisClient } = require('../config/redis');
const { isValidVersion, sameVersion } = require('../updater/version');
const { readCache, writeCache } = require('./update-check.service');
const { parseChangelog, selectChangelog } = require('./update-changelog-parser');

const CHANGELOG_URL = 'https://raw.githubusercontent.com/Xusqui/xiro/main/CHANGELOG.md';
const CACHE_PREFIX = 'xiro:update:changelog:';
const CACHE_TTL_S = 3600;
// build-image.sh sube a Docker Hub antes que a GitHub: la entrada que falta suele llegar en minutos
const TARGET_MISSING_TTL_S = 300;
const DOWNLOAD_TIMEOUT_MS = 10000;
const MAX_CHANGELOG_CHARS = 512 * 1024;

/**
 * Descarga CHANGELOG.md desde GitHub.
 * @param {typeof fetch} fetchImpl - Implementación de fetch
 * @returns {Promise<string>} Contenido del fichero
 * @throws {Error} Si GitHub falla, tarda demasiado o el fichero es desproporcionado
 */
async function downloadChangelog(fetchImpl) {
    const response = await fetchImpl(CHANGELOG_URL, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error('GitHub respondió ' + response.status);

    const markdown = await response.text();
    if (markdown.length > MAX_CHANGELOG_CHARS) throw new Error('CHANGELOG.md es demasiado grande');
    return markdown;
}

/**
 * Obtiene las entradas del historial, de la caché si es posible.
 * @param {{latest: string, fetchImpl: typeof fetch, redisGetter: Function}} deps - Destino y dependencias
 * @returns {Promise<import('./update-changelog-parser').ChangelogEntry[]>} Entradas del historial
 * @throws {Error} Si la descarga falla o el fichero no contiene ninguna versión reconocible
 */
async function loadEntries({ latest, fetchImpl, redisGetter }) {
    const cacheKey = CACHE_PREFIX + latest;
    const cached = await readCache(redisGetter, cacheKey);
    if (cached) return cached;

    const entries = parseChangelog(await downloadChangelog(fetchImpl));
    if (entries.length === 0) throw new Error('CHANGELOG.md no contiene versiones reconocibles');

    const documented = entries.some(entry => sameVersion(entry.version, latest));
    await writeCache(redisGetter, cacheKey, entries, documented ? CACHE_TTL_S : TARGET_MISSING_TTL_S);
    return entries;
}

/**
 * Devuelve las novedades que trae la actualización. Nunca lanza: si no se pueden obtener,
 * el panel debe poder actualizar igualmente.
 * @param {Object} options - Opciones
 * @param {string} options.current - Versión instalada
 * @param {string|null} options.latest - Versión de destino
 * @param {typeof fetch} [options.fetchImpl] - Implementación de fetch
 * @param {Function} [options.redisGetter] - Función para obtener el cliente Redis
 * @returns {Promise<{available: boolean, targetDocumented: boolean, newer: Array, older: Array}>} Novedades
 */
async function getChangelog({ current, latest, fetchImpl = globalThis.fetch, redisGetter = getRedisClient }) {
    const unavailable = { available: false, targetDocumented: false, newer: [], older: [] };
    if (!isValidVersion(latest)) return unavailable;

    try {
        const entries = await loadEntries({ latest, fetchImpl, redisGetter });
        return { available: true, ...selectChangelog(entries, { current, latest }) };
    } catch (err) {
        logger.warn('No se pudo obtener el historial de versiones', { error: err.message });
        return unavailable;
    }
}

module.exports = { getChangelog };
