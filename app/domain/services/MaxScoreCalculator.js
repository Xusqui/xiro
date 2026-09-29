/**
 * @fileoverview Calcula la puntuación máxima teórica de una partida: la que se
 * obtendría contestando todas las preguntas correctamente en 1 segundo,
 * respetando el bonus de tiempo y el sistema de rachas configurados en la
 * partida (mismo mecanismo que aplica GameStreakApplicator en producción,
 * ver app/application/commands/submit-answer/streakScoring.js).
 *
 * Usado por el modo Standalone para mostrar "puntos conseguidos de un máximo".
 *
 * IMPORTANTE: la simulación usa tiempo de respuesta = 0s (instantáneo), no 1s.
 * El cliente puede registrar timeElapsed por debajo de 1 segundo (respuesta
 * muy rápida, precisión del timestamp), así que 1s NO es una cota superior
 * real y un jugador podía superar el "máximo" calculado. 0s sí es una cota
 * estricta: timeElapsed nunca puede ser negativo, así que el bonus de tiempo
 * nunca puede superar MAX_TIME_BONUS.
 */

'use strict';

const { SCORING, TIMING } = require('../../config/game-constants');
const { roundScore } = require('./ScoringService');
const { applyStreakBonus } = require('./GameStreakApplicator');
const { isScorable, usesRandomPoints } = require('./QuestionScoringPolicy');

// Respuesta instantánea simulada: 0 segundos (cota superior estricta, ver nota arriba)
const PERFECT_ANSWER_TIME_SECONDS = 0;

function timeBonusFor(timeLimit) {
    const limit = timeLimit || TIMING.DEFAULT_QUESTION_TIME;
    const timeLeft = Math.max(0, limit - PERFECT_ANSWER_TIME_SECONDS);
    const bonusRatio = limit > 0 ? timeLeft / limit : 0;
    return roundScore(bonusRatio * SCORING.MAX_TIME_BONUS);
}

/**
 * Puntos base de una respuesta perfecta, replicando la lógica de cada
 * servicio de dominio usado en app/application/commands/submit-answer/answerEvaluation.js
 */
function calculatePerfectBasePoints(question, game) {
    // Con puntuación aleatoria, la cota superior de una pregunta elegible es el
    // máximo del rango (nunca puede salir un valor mayor en el sorteo).
    if (usesRandomPoints(question, game)) {
        const maxBase = Number(game.random_points_max) || SCORING.BASE_POINTS;
        return maxBase + timeBonusFor(question.time_limit);
    }

    switch (question.question_type) {
        case 'order':
        case 'matching':
            return (question.options?.length || 0) * SCORING.BASE_POINTS;

        case 'word_scramble':
            return SCORING.BASE_POINTS + timeBonusFor(question.time_limit);

        case 'numeric_approximation':
            // NumericApproximationScoring: acierto exacto = maxPoints + exactBonus (fijo, 20)
            return (question.max_points || 0) + 20;

        case 'multiple_choice': {
            const correctCount = (question.options || [])
                .filter(opt => opt.is_correct || opt.isCorrect).length;
            const pointsPerCorrect = question.mc_points_per_correct || 10;
            const perfectBonus = question.mc_perfect_bonus || 20;
            return correctCount * pointsPerCorrect + perfectBonus;
        }

        default: // quiz, true_false, multiple: TimeBasedScoring (estrategia real en producción)
            return SCORING.BASE_POINTS + timeBonusFor(question.time_limit);
    }
}

/**
 * Calcula la puntuación máxima posible de una partida simulando un jugador
 * que acierta todas las preguntas en 1 segundo (máxima racha posible incluida).
 *
 * @param {Object} game - Objeto de juego en memoria (activeGames), con `questions`
 *   y la configuración de rachas (use_streaks, streak_threshold, etc.)
 * @returns {number} Puntuación máxima, redondeada
 */
function calculateMaxPossibleScore(game) {
    const questions = game?.questions || [];
    let total = 0;
    let streak = 0; // racha ANTES de la pregunta actual (nunca falla en la simulación)

    for (const question of questions) {
        if (!isScorable(question)) continue;

        const basePoints = calculatePerfectBasePoints(question, game);
        const { bonusPoints } = applyStreakBonus(basePoints, streak, game);

        total += roundScore(basePoints + bonusPoints);
        streak += 1;
    }

    return roundScore(total);
}

module.exports = { calculateMaxPossibleScore, calculatePerfectBasePoints };
