/**
 * @fileoverview Cache helper para datos de bancos de preguntas
 * Evita múltiples llamadas API innecesarias al servidor
 */

// Cache global para bancos con conteo de preguntas
let banksCache = null;
let banksCacheTimestamp = null;
const CACHE_DURATION = 60000; // 60 segundos

/**
 * Obtiene todos los bancos con conteo de preguntas (con caché)
 * @param {boolean} forceRefresh - Forzar recarga desde servidor
 * @returns {Promise<Array>} Array de bancos con question_count
 */
async function getAllBanksWithCounts(forceRefresh = false) {
    const now = Date.now();

    // Usar caché si existe y es válido
    if (!forceRefresh && banksCache && banksCacheTimestamp && (now - banksCacheTimestamp < CACHE_DURATION)) {
        return banksCache;
    }

    // Cargar desde servidor
    const res = await fetchWithAuth('/api/banks?includeCount=true');
    const banks = await res.json();

    // Actualizar caché
    banksCache = banks;
    banksCacheTimestamp = now;

    return banks;
}

/**
 * Invalida el caché de bancos (a llamar después de modificar un banco)
 */
function invalidateBanksCache() {
    banksCache = null;
    banksCacheTimestamp = null;
}

/**
 * Obtiene un banco específico con conteo de preguntas desde el caché
 * @param {number} bankId - ID del banco
 * @returns {Promise<Object|null>} Banco con question_count o null si no existe
 */
async function getBankFromCache(bankId) {
    const banks = await getAllBanksWithCounts();
    return banks.find(b => b.id === bankId) || null;
}

/**
 * Pre-carga los bancos en segundo plano (sin bloquear)
 */
function preloadBanksCache() {
    getAllBanksWithCounts().catch(() => {
        // Silenciar errores en precarga
    });
}
