/**
 * @fileoverview Contadores atómicos de respuestas en Redis para modo individual
 */

const { getRedisClient } = require('../../config/redis');

const DEFAULT_TTL_SECONDS = 2 * 60 * 60; // 2h

/**
 * Claves Redis de los contadores de una sala. El cerrojo de revelado va por pregunta si se indica.
 * @param {string} roomId - ID de sesión
 * @param {number|null} [questionIndex=null] - Pregunta del cerrojo
 * @returns {{expectedKey: string, answeredKey: string, revealLockKey: string}}
 */
function buildKeys(roomId, questionIndex = null) {
    const safeRoomId = String(roomId);
    // El lock de reveal se llava por pregunta para evitar que el TTL del lock
    // de una pregunta previa bloquee el auto-reveal de la siguiente cuando los
    // jugadores contestan en una ventana corta (<8s desde el anterior reveal).
    const lockSuffix = questionIndex === null || questionIndex === undefined ? '' : `:${questionIndex}`;
    return {
        expectedKey: `game:expected:${safeRoomId}`,
        answeredKey: `game:answered:${safeRoomId}`,
        revealLockKey: `game:reveal-lock:${safeRoomId}${lockSuffix}`
    };
}

/**
 * Reinicia los contadores de la pregunta: guarda quién debe responder y vacía quién respondió. Usa la lista de apodos
 * si se pasa; si no, los sockets de la sala (sin HOST).
 * @param {Object} options
 * @param {string} options.roomId - ID de sesión
 * @param {Object} [options.io] - Socket.IO, para leer los sockets si no hay lista
 * @param {number} [options.ttlSeconds=7200] - Caducidad de las claves
 * @param {string[]|null} [options.nicknames=null] - Jugadores esperados (fuente preferida)
 * @returns {Promise<{expectedCount: number, answeredCount: 0, allAnswered: false, nicknames: string[]}>}
 * @throws {Error} Si falla Redis
 */
async function initializeExpectedPlayers({
    roomId,
    io,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    nicknames: nicknamesOverride = null
}) {
    const redis = await getRedisClient();
    const { expectedKey, answeredKey } = buildKeys(roomId);

    // Si el caller pasa una lista explícita de nicknames (fuente de verdad,
    // típicamente lobbyPlayers sincronizado cross-worker), usarla. Esto evita
    // depender únicamente de fetchSockets(), que en clúster PM2 puede devolver
    // un set incompleto por latencia/timeouts del Redis adapter y provocar
    // que el contador "expected" quede por debajo del número real de jugadores.
    let nicknames;
    if (Array.isArray(nicknamesOverride) && nicknamesOverride.length > 0) {
        nicknames = [
            ...new Set(nicknamesOverride.filter(n => typeof n === 'string' && n.trim().length > 0 && n !== 'HOST'))
        ];
    } else {
        const sockets = io ? await io.in(`${roomId}:players`).fetchSockets() : [];

        nicknames = [
            ...new Set(
                sockets
                    .map(s => s?.data?.nickname)
                    .filter(n => typeof n === 'string' && n.trim().length > 0 && n !== 'HOST')
            )
        ];
    }

    const tx = redis.multi();
    tx.del(expectedKey);
    if (nicknames.length > 0) {
        tx.sAdd(expectedKey, nicknames);
    }
    tx.expire(expectedKey, ttlSeconds);

    tx.del(answeredKey);
    tx.expire(answeredKey, ttlSeconds);

    await tx.exec();

    return {
        expectedCount: nicknames.length,
        answeredCount: 0,
        allAnswered: false,
        nicknames
    };
}

async function ensureExpectedPlayers({ roomId, io, ttlSeconds = DEFAULT_TTL_SECONDS, redisClient = null }) {
    const redis = redisClient || (await getRedisClient());
    const { expectedKey } = buildKeys(roomId);

    const expectedCount = await redis.sCard(expectedKey);
    if (expectedCount > 0 || !io) {
        return Number(expectedCount) || 0;
    }

    const initialized = await initializeExpectedPlayers({ roomId, io, ttlSeconds });
    return initialized.expectedCount;
}

const { executeAnswerCounterScript } = require('./answerCounterScript');

/**
 * Registra de forma atómica la respuesta de un jugador y devuelve el progreso. Si faltaba la lista de esperados la
 * reconstruye a partir de los sockets.
 * @param {Object} options
 * @param {string} options.roomId - ID de sesión
 * @param {string} options.nickname - Apodo
 * @param {Object} [options.io] - Socket.IO
 * @param {number} [options.ttlSeconds=7200] - Caducidad de las claves
 * @returns {Promise<{expectedCount: number, answeredCount: number, allAnswered: boolean}>}
 * @throws {Error} Si falla Redis
 */
async function registerAnswerAndGetProgress({ roomId, nickname, io, ttlSeconds = DEFAULT_TTL_SECONDS }) {
    const redis = await getRedisClient();
    const { expectedKey, answeredKey } = buildKeys(roomId);

    let [expectedCount, answeredCount] = await executeAnswerCounterScript(
        redis,
        expectedKey,
        answeredKey,
        nickname,
        ttlSeconds
    );

    if (expectedCount === -1) {
        const initializedCount = await ensureExpectedPlayers({ roomId, io, ttlSeconds, redisClient: redis });

        const tx = redis.multi();
        tx.sAdd(answeredKey, nickname);
        tx.expire(answeredKey, ttlSeconds);
        tx.expire(expectedKey, ttlSeconds);
        tx.sCard(expectedKey);
        tx.sCard(answeredKey);
        const res = await tx.exec();

        expectedCount = Number(res[3]) || initializedCount;
        answeredCount = Number(res[4]) || 0;
    }

    return {
        expectedCount,
        answeredCount,
        allAnswered: expectedCount > 0 && answeredCount >= expectedCount
    };
}

/**
 * Quita a un jugador (p. ej. al salir) de esperados y respondidos y devuelve el progreso recalculado.
 * @param {Object} options
 * @param {string} options.roomId - ID de sesión
 * @param {string} options.nickname - Apodo
 * @param {number} [options.ttlSeconds=7200] - Caducidad de las claves
 * @returns {Promise<{expectedCount: number, answeredCount: number, allAnswered: boolean}>}
 * @throws {Error} Si falla Redis
 */
async function removeExpectedPlayer({ roomId, nickname, ttlSeconds = DEFAULT_TTL_SECONDS }) {
    const redis = await getRedisClient();
    const { expectedKey, answeredKey } = buildKeys(roomId);

    await Promise.all([
        redis.sRem(expectedKey, nickname),
        redis.sRem(answeredKey, nickname),
        redis.expire(expectedKey, ttlSeconds),
        redis.expire(answeredKey, ttlSeconds)
    ]);

    const [expectedCountRaw, answeredCountRaw] = await Promise.all([
        redis.sCard(expectedKey),
        redis.sCard(answeredKey)
    ]);

    const expectedCount = Number(expectedCountRaw) || 0;
    const answeredCount = Number(answeredCountRaw) || 0;

    return {
        expectedCount,
        answeredCount,
        allAnswered: expectedCount > 0 && answeredCount >= expectedCount
    };
}

/**
 * Intenta tomar el cerrojo de revelado para que solo un worker revele la pregunta.
 * @param {Object} options
 * @param {string} options.roomId - ID de sesión
 * @param {number|null} [options.questionIndex=null] - Pregunta
 * @param {number} [options.ttlSeconds=8] - Caducidad del cerrojo
 * @returns {Promise<boolean>} true si lo tomó este worker
 * @throws {Error} Si falla Redis
 */
async function acquireRevealLock({ roomId, questionIndex = null, ttlSeconds = 8 }) {
    const redis = await getRedisClient();
    const { revealLockKey } = buildKeys(roomId, questionIndex);

    const result = await redis.set(revealLockKey, String(process.pid), {
        NX: true,
        EX: ttlSeconds
    });

    return result === 'OK';
}

/**
 * Suelta el cerrojo de revelado. Si Redis falla no hace nada: el cerrojo caduca solo.
 * @param {Object} options
 * @param {string} options.roomId - ID de sesión
 * @param {number|null} [options.questionIndex=null] - Pregunta
 * @returns {Promise<void>}
 */
async function releaseRevealLock({ roomId, questionIndex = null }) {
    try {
        const redis = await getRedisClient();
        const { revealLockKey } = buildKeys(roomId, questionIndex);
        await redis.del(revealLockKey);
    } catch (_) {
        /* best-effort */
    }
}

module.exports = {
    buildKeys,
    initializeExpectedPlayers,
    registerAnswerAndGetProgress,
    removeExpectedPlayer,
    acquireRevealLock,
    releaseRevealLock
};
