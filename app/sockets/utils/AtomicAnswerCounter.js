/**
 * @fileoverview Contadores atómicos de respuestas en Redis para modo individual
 */

const { getRedisClient } = require('../../config/redis');

const DEFAULT_TTL_SECONDS = 2 * 60 * 60; // 2h

function buildKeys(roomId, questionIndex = null) {
    const safeRoomId = String(roomId);
    // El lock de reveal se llava por pregunta para evitar que el TTL del lock
    // de una pregunta previa bloquee el auto-reveal de la siguiente cuando los
    // jugadores contestan en una ventana corta (<8s desde el anterior reveal).
    const lockSuffix = questionIndex === null || questionIndex === undefined
        ? ''
        : `:${questionIndex}`;
    return {
        expectedKey: `game:expected:${safeRoomId}`,
        answeredKey: `game:answered:${safeRoomId}`,
        revealLockKey: `game:reveal-lock:${safeRoomId}${lockSuffix}`
    };
}

async function initializeExpectedPlayers({ roomId, io, ttlSeconds = DEFAULT_TTL_SECONDS, nicknames: nicknamesOverride = null }) {
    const redis = await getRedisClient();
    const { expectedKey, answeredKey } = buildKeys(roomId);

    // Si el caller pasa una lista explícita de nicknames (fuente de verdad,
    // típicamente lobbyPlayers sincronizado cross-worker), usarla. Esto evita
    // depender únicamente de fetchSockets(), que en clúster PM2 puede devolver
    // un set incompleto por latencia/timeouts del Redis adapter y provocar
    // que el contador "expected" quede por debajo del número real de jugadores.
    let nicknames;
    if (Array.isArray(nicknamesOverride) && nicknamesOverride.length > 0) {
        nicknames = [...new Set(
            nicknamesOverride.filter(n => typeof n === 'string' && n.trim().length > 0 && n !== 'HOST')
        )];
    } else {
        const sockets = io
            ? await io.in(`${roomId}:players`).fetchSockets()
            : [];

        nicknames = [...new Set(
            sockets
                .map(s => s?.data?.nickname)
                .filter(n => typeof n === 'string' && n.trim().length > 0 && n !== 'HOST')
        )];
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
    const redis = redisClient || await getRedisClient();
    const { expectedKey } = buildKeys(roomId);

    const expectedCount = await redis.sCard(expectedKey);
    if (expectedCount > 0 || !io) {
        return Number(expectedCount) || 0;
    }

    const initialized = await initializeExpectedPlayers({ roomId, io, ttlSeconds });
    return initialized.expectedCount;
}

const { executeAnswerCounterScript } = require('./answerCounterScript');

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

async function acquireRevealLock({ roomId, questionIndex = null, ttlSeconds = 8 }) {
    const redis = await getRedisClient();
    const { revealLockKey } = buildKeys(roomId, questionIndex);

    const result = await redis.set(revealLockKey, String(process.pid), {
        NX: true,
        EX: ttlSeconds
    });

    return result === 'OK';
}

async function releaseRevealLock({ roomId, questionIndex = null }) {
    try {
        const redis = await getRedisClient();
        const { revealLockKey } = buildKeys(roomId, questionIndex);
        await redis.del(revealLockKey);
    } catch (_) { /* best-effort */ }
}

module.exports = {
    buildKeys,
    initializeExpectedPlayers,
    registerAnswerAndGetProgress,
    removeExpectedPlayer,
    acquireRevealLock,
    releaseRevealLock
};
