/** @fileoverview Comprueba en Docker Hub si hay una versión de Xiro! más nueva que la instalada.
 *  El resultado se guarda en Redis una hora (compartido por todos los workers): como mucho una consulta por hora. */
'use strict';
const logger = require('../config/logger');
const { getRedisClient } = require('../config/redis');
const { version: APP_VERSION } = require('../package.json');
const { isValidVersion, compareVersions } = require('../updater/version');

const CACHE_KEY = 'xiro:update:check';
const CHECK_TTL_S = 3600; // una comprobación por hora como máximo
const ERROR_TTL_S = 900; // si Docker Hub falla, se reintenta a los 15 minutos
const DEFAULT_REPO = 'xusqui/xiro-backend';

/**
 * Selecciona la versión más alta de un array de nombres
 * @param {string[]} names - Array de nombres de versiones
 * @returns {string|null} La versión más alta o null si no hay ninguna válida
 */
function pickLatest(names) {
    if (!Array.isArray(names)) return null;
    let latest = null;
    for (const name of names) {
        if (!isValidVersion(name)) continue;
        if (!latest || compareVersions(name, latest) > 0) latest = name;
    }
    return latest;
}

/**
 * Obtiene la última versión disponible en Docker Hub
 * @param {Object} options - Opciones de configuración
 * @param {Function} [options.fetchImpl] - Implementación de fetch a usar (para testing)
 * @param {string} [options.repo] - Repositorio Docker Hub a consultar
 * @returns {Promise<string>} La última versión disponible
 */
async function fetchLatestVersion(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const repo = options.repo || process.env.XIRO_IMAGE_REPO || DEFAULT_REPO;

    const res = await fetchImpl(`https://hub.docker.com/v2/repositories/${repo}/tags?page_size=100`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) throw new Error('Docker Hub respondió ' + res.status);

    const body = await res.json();
    const names = (Array.isArray(body.results) ? body.results : []).map(t => t && t.name);
    const latest = pickLatest(names);
    if (!latest) throw new Error('No hay versiones publicadas en Docker Hub');

    return latest;
}

/**
 * Lee la información de actualización desde Redis
 * @param {Function} redisGetter - Función para obtener el cliente Redis
 * @returns {Promise<Object|null>} Información de caché o null si no disponible
 */
async function readCache(redisGetter) {
    try {
        const client = await redisGetter();
        const data = await client.get(CACHE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        logger.warn('Caché de actualizaciones no disponible', { error: err.message });
        return null;
    }
}

/**
 * Escribe la información de actualización en Redis
 * @param {Function} redisGetter - Función para obtener el cliente Redis
 * @param {Object} data - Datos a guardar
 * @param {number} ttl - Tiempo de vida en segundos
 */
async function writeCache(redisGetter, data, ttl) {
    try {
        const client = await redisGetter();
        await client.set(CACHE_KEY, JSON.stringify(data), { EX: ttl });
    } catch (err) {
        logger.warn('Caché de actualizaciones no disponible', { error: err.message });
    }
}

/**
 * Obtiene información sobre si hay una nueva versión disponible
 * @param {Object} options - Opciones de configuración
 * @param {boolean} [options.force=false] - Forzar la comprobación incluso si hay caché
 * @param {Function} [options.fetchImpl] - Implementación de fetch a usar (para testing)
 * @param {Function} [options.redisGetter] - Función para obtener el cliente Redis
 * @param {Function} [options.now] - Función para obtener la hora actual (para testing)
 * @param {string} [options.current=APP_VERSION] - Versión actual del backend
 * @returns {Promise<Object>} Información de actualización
 */
async function getUpdateInfo(options = {}) {
    const force = options.force === true;
    const fetchImpl = options.fetchImpl;
    const redisGetter = options.redisGetter || getRedisClient;
    const now = options.now || Date.now;
    const current = options.current || APP_VERSION;

    let entry = force ? null : await readCache(redisGetter);
    if (!entry) {
        try {
            entry = {
                latest: await fetchLatestVersion({ fetchImpl }),
                error: null,
                checkedAt: new Date(now()).toISOString()
            };
            await writeCache(redisGetter, entry, CHECK_TTL_S);
        } catch (err) {
            logger.warn('No se pudo comprobar si hay una versión nueva', { error: err.message });
            const ISO = new Date(now()).toISOString();
            entry = {
                latest: null,
                error: err.message,
                checkedAt: ISO
            };
            await writeCache(redisGetter, entry, ERROR_TTL_S);
        }
    }

    return {
        current,
        latest: entry.latest,
        updateAvailable: Boolean(entry.latest) && compareVersions(entry.latest, current) > 0,
        checkedAt: entry.checkedAt,
        error: entry.error
    };
}

module.exports = {
    getUpdateInfo,
    fetchLatestVersion,
    compareVersions,
    pickLatest
};
