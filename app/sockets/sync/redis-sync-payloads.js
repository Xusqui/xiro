/**
 * @fileoverview Construcción pura de los estados de partida que viajan por Redis Pub/Sub y lectura
 * de mensajes entrantes. Sin estado ni efectos (salvo el log de JSON inválido). Lo usa RedisSyncBus.
 */

const logger = require('../../config/logger');
const { SCORING } = require('../../config/game-constants');

const DEFAULT_DOUBLE_STREAK_BONUS_PERCENTAGE = 1.0;

/**
 * Devuelve el primer valor que no sea undefined ni null.
 * @param {...*} values - Candidatos en orden de preferencia
 * @returns {*} El primero definido, o undefined si ninguno lo está
 */
function firstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}

/**
 * Parsea un mensaje JSON de Redis Pub/Sub. Si no es JSON válido lo registra y devuelve null.
 * @param {string} message - Mensaje recibido
 * @param {string} channel - Canal (solo para el log)
 * @returns {Object|null} Mensaje parseado o null
 */
function parseRedisMessage(message, channel) {
    try {
        return JSON.parse(message);
    } catch (error) {
        logger.warn('RedisSyncBus recibió mensaje JSON inválido', { channel, error: error.message });
        return null;
    }
}

/**
 * Normaliza a Set: los arrays (como llegan por JSON) se convierten; cualquier otro valor da un Set vacío.
 * @param {Set|Array|*} value - Valor recibido
 * @returns {Set} Set con los elementos, o vacío
 */
function toSetOrEmpty(value) {
    if (value instanceof Set) {
        return value;
    }

    if (Array.isArray(value)) {
        return new Set(value);
    }

    return new Set();
}

// Rachas y puntos aleatorios: lo que llega, lo que tenía este worker o el valor por defecto
function syncedScoringSettings(gameState, existing) {
    return {
    use_streaks: firstDefined(gameState.use_streaks, existing?.use_streaks, false),
    streak_threshold: firstDefined(
        gameState.streak_threshold,
        existing?.streak_threshold,
        SCORING.STREAK.DEFAULT_THRESHOLD
    ),
    streak_bonus_percentage: firstDefined(
        gameState.streak_bonus_percentage,
        existing?.streak_bonus_percentage,
        SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE
    ),
    use_double_streaks: firstDefined(gameState.use_double_streaks, existing?.use_double_streaks, false),
    double_streak_threshold: firstDefined(
        gameState.double_streak_threshold,
        existing?.double_streak_threshold,
        SCORING.STREAK.DEFAULT_DOUBLE_THRESHOLD
    ),
    double_streak_bonus_percentage: firstDefined(
        gameState.double_streak_bonus_percentage,
        existing?.double_streak_bonus_percentage,
        DEFAULT_DOUBLE_STREAK_BONUS_PERCENTAGE
    ),
    use_random_points: firstDefined(gameState.use_random_points, existing?.use_random_points, false),
    random_points_min: firstDefined(
        gameState.random_points_min,
        existing?.random_points_min,
        SCORING.RANDOM_POINTS.DEFAULT_MIN
    ),
    random_points_max: firstDefined(
        gameState.random_points_max,
        existing?.random_points_max,
        SCORING.RANDOM_POINTS.DEFAULT_MAX
    ),
    };
}

/**
 * Construye la partida local de un worker a partir del estado recibido por `game-started`.
 * Los campos que no llegan se toman de la copia local previa (`existing`) o de los valores por defecto.
 * @param {string} roomId - ID de sesión
 * @param {Object} gameState - Estado ligero publicado por el worker de origen
 * @param {Object} [existing] - Partida que ya tenía este worker, si la había
 * @returns {Object} Partida lista para guardar en activeGames
 */
function buildSyncedGameState(roomId, gameState, existing) {
    const gameStartTime = firstDefined(gameState.gameStartTime, gameState.startTime, Date.now());
    const questionStartTime = firstDefined(
        gameState.questionStartTime,
        gameState.gameStartTime,
        gameState.startTime,
        Date.now()
    );

    return {
        pin: gameState.pin,
        roomId: firstDefined(gameState.roomId, roomId),
        // Lo usa el autoguardado de la sesión (game_type), que puede ejecutarse en cualquier worker
        gameType: firstDefined(gameState.gameType, existing?.gameType, null),
        questions: firstDefined(gameState.questions, []),
        currentIndex: firstDefined(gameState.currentIndex, 0),
        scores: firstDefined(gameState.scores, {}),
        players: firstDefined(gameState.players, []),
        answerStats: firstDefined(gameState.answerStats, {}),
        isTrivial: firstDefined(gameState.isTrivial, false),
        playerAnswers: {},
        teamMode: firstDefined(gameState.teamMode, false),
        trivialMeta: firstDefined(gameState.trivialMeta, null),
        // Lo usa playerAnswerArchive para la columna "Categoría" del CSV de Trivial
        trivialCategoryName: gameState.trivialCategoryName ?? null,
        trivialLastCorrect: firstDefined(existing?.trivialLastCorrect, null),
        trivialQuestionEpoch: firstDefined(gameState.trivialQuestionEpoch, 0),
        canAnswer: firstDefined(gameState.canAnswer, true),
        revealedQuestions: new Set(),
        gameStartTime,
        questionStartTime,
        playerStreaks: firstDefined(gameState.playerStreaks, existing?.playerStreaks, {}),
        playerStreakInfos: firstDefined(gameState.playerStreakInfos, existing?.playerStreakInfos, {}),
        answeredCurrent: new Set(),
        ...syncedScoringSettings(gameState, existing),
        currentRandomPoints: firstDefined(gameState.currentRandomPoints, existing?.currentRandomPoints, null),
        _epoch: firstDefined(gameState._epoch, 1)
    };
}

/**
 * Reduce la partida a los campos que necesitan los demás workers, para publicarla en `game-started`.
 * @param {string} roomId - ID de sesión
 * @param {Object} gameState - Partida completa del worker de origen
 * @returns {Object} Estado serializable sin Sets ni respuestas de jugadores
 */
function buildLightGameState(roomId, gameState) {
    const gameStartTime = firstDefined(gameState.gameStartTime, gameState.startTime, Date.now());
    const questionStartTime = firstDefined(
        gameState.questionStartTime,
        gameState.gameStartTime,
        gameState.startTime,
        Date.now()
    );

    return {
        pin: gameState.pin,
        roomId,
        gameType: gameState.gameType ?? null,
        questions: gameState.questions,
        currentIndex: gameState.currentIndex,
        scores: gameState.scores,
        players: gameState.players,
        answerStats: gameState.answerStats,
        isTrivial: firstDefined(gameState.isTrivial, false),
        teamMode: firstDefined(gameState.teamMode, false),
        canAnswer: firstDefined(gameState.canAnswer, false),
        trivialMeta: firstDefined(gameState.trivialMeta, null),
        trivialCategoryName: gameState.trivialCategoryName ?? null,
        trivialQuestionEpoch: firstDefined(gameState.trivialQuestionEpoch, 0),
        playerStreaks: firstDefined(gameState.playerStreaks, {}),
        playerStreakInfos: firstDefined(gameState.playerStreakInfos, {}),
        use_streaks: firstDefined(gameState.use_streaks, false),
        streak_threshold: firstDefined(gameState.streak_threshold, SCORING.STREAK.DEFAULT_THRESHOLD),
        streak_bonus_percentage: firstDefined(
            gameState.streak_bonus_percentage,
            SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE
        ),
        use_double_streaks: firstDefined(gameState.use_double_streaks, false),
        double_streak_threshold: firstDefined(
            gameState.double_streak_threshold,
            SCORING.STREAK.DEFAULT_DOUBLE_THRESHOLD
        ),
        double_streak_bonus_percentage: firstDefined(
            gameState.double_streak_bonus_percentage,
            DEFAULT_DOUBLE_STREAK_BONUS_PERCENTAGE
        ),
        use_random_points: firstDefined(gameState.use_random_points, false),
        random_points_min: firstDefined(gameState.random_points_min, SCORING.RANDOM_POINTS.DEFAULT_MIN),
        random_points_max: firstDefined(gameState.random_points_max, SCORING.RANDOM_POINTS.DEFAULT_MAX),
        currentRandomPoints: firstDefined(gameState.currentRandomPoints, null),
        gameStartTime,
        questionStartTime,
        _epoch: 1
    };
}

module.exports = {
    firstDefined,
    parseRedisMessage,
    toSetOrEmpty,
    buildSyncedGameState,
    buildLightGameState
};
