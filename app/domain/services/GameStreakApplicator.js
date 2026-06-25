/**
 * @fileoverview Aplicador de bonus de racha a nivel de juego
 *
 * Aplica el multiplicador de racha (o doble racha) sobre los puntos base
 * ya calculados por la estrategia de puntuación activa.
 *
 * Reglas:
 *   - La doble racha SUSTITUYE a la racha normal (no se acumulan).
 *   - Solo se aplica bonus si la respuesta fue CORRECTA (prevStreak ya fue comprobado fuera).
 *   - El bonus usa la racha ANTERIOR a esta respuesta (prevStreak) para decidir si aplica.
 *     Esto garantiza que el bonus empieza en la respuesta (umbral+1), igual que StreakBonusScoring.
 */

'use strict';

const logger = require('../../config/logger');
const { SCORING } = require('../../config/game-constants');
const { roundScore } = require('./ScoringService');

/**
 * Extrae y normaliza la configuración de rachas del objeto juego en memoria.
 * @param {Object} game
 * @returns {Object}
 */
function extractStreakConfig(game) {
    return {
        use_streaks: !!game.use_streaks,
        streak_threshold: game.streak_threshold ?? SCORING.STREAK.DEFAULT_THRESHOLD,
        streak_bonus_percentage: game.streak_bonus_percentage ?? SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE,
        use_double_streaks: !!game.use_double_streaks,
        double_streak_threshold: game.double_streak_threshold ?? SCORING.STREAK.DEFAULT_DOUBLE_THRESHOLD,
        double_streak_bonus_percentage: game.double_streak_bonus_percentage ?? 1.00,
    };
}

/**
 * Aplica el bonus de racha sobre los puntos base ya calculados.
 * Solo debe llamarse cuando la respuesta fue CORRECTA.
 *
 * @param {number} basePoints   Puntos base ya calculados por la estrategia
 * @param {number} prevStreak   Racha del jugador ANTES de procesar esta respuesta
 * @param {Object} game         Estado del juego en memoria (debe tener campos streak)
 * @param {string} nickname     Nickname del jugador (para logs)
 * @returns {{ bonusPoints: number, bonusType: string|null, bonusPercentage: number }}
 */
function applyStreakBonus(basePoints, prevStreak, game, nickname = '?') {
    if (!basePoints || basePoints <= 0) {
        return { bonusPoints: 0, bonusType: null, bonusPercentage: 0 };
    }

    const cfg = extractStreakConfig(game);
    const ctx = { roomId: game.roomId || game.pin, nickname, prevStreak, basePoints };

    // Doble racha tiene prioridad y SUSTITUYE a la racha normal
    if (cfg.use_double_streaks && prevStreak >= cfg.double_streak_threshold) {
        const bonusPoints = roundScore(basePoints * cfg.double_streak_bonus_percentage);
        logger.debug('🔥🔥Doble racha aplicada', {
            ...ctx,
            bonusType: 'double',
            threshold: cfg.double_streak_threshold,
            bonusPercentage: cfg.double_streak_bonus_percentage,
            bonusPoints,
        });
        return { bonusPoints, bonusType: 'double', bonusPercentage: cfg.double_streak_bonus_percentage };
    }

    // Racha normal
    if (cfg.use_streaks && prevStreak >= cfg.streak_threshold) {
        const bonusPoints = roundScore(basePoints * cfg.streak_bonus_percentage);
        logger.info('🔥 Racha aplicada', {
            ...ctx,
            bonusType: 'normal',
            threshold: cfg.streak_threshold,
            bonusPercentage: cfg.streak_bonus_percentage,
            bonusPoints,
        });
        return { bonusPoints, bonusType: 'normal', bonusPercentage: cfg.streak_bonus_percentage };
    }

    return { bonusPoints: 0, bonusType: null, bonusPercentage: 0 };
}

/**
 * Enriquece el streakInfo devuelto por StreakTrackingService con información
 * de doble racha para el frontend.
 *
 * @param {Object} streakInfo  Resultado de StreakTrackingService.processPlayerStreak
 * @param {Object} game        Estado del juego en memoria
 * @returns {Object}           streakInfo enriquecido
 */
function enrichStreakInfo(streakInfo, game) {
    const cfg = extractStreakConfig(game);
    const prev = streakInfo.previous || 0;
    const curr = streakInfo.current || 0;

    // Si las rachas no están habilitadas, anular todos los indicadores
    if (!cfg.use_streaks) {
        return {
            ...streakInfo,
            threshold: cfg.streak_threshold,
            doubleThreshold: cfg.double_streak_threshold,
            isInStreak: false,
            justEntered: false,
            justLost: false,
            isInDoubleStreak: false,
            justEnteredDoubleStreak: false,
        };
    }

    return {
        ...streakInfo,
        doubleThreshold: cfg.use_double_streaks ? cfg.double_streak_threshold : null,
        isInDoubleStreak: cfg.use_double_streaks && curr >= cfg.double_streak_threshold,
        justEnteredDoubleStreak: cfg.use_double_streaks && prev < cfg.double_streak_threshold
            && curr >= cfg.double_streak_threshold,
    };
}

module.exports = { applyStreakBonus, enrichStreakInfo, extractStreakConfig };
